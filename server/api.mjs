import {validatePortfolio, emptyPortfolio, recordCurrentSnapshot} from '../public/domain.mjs';
const responseJSON = (data, status = 200) => new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function handleApi(request, env) {
  if (new URL(request.url).pathname !== '/api/portfolio') return responseJSON({error:'요청한 경로가 없습니다.'},404);
  const userId = request.headers.get('oai-authenticated-user-id');
  if (!userId) return responseJSON({error:'로그인 후 이용해 주세요.'},401);
  if (!env.DB) return responseJSON({error:'저장소 연결을 확인하고 있습니다. 잠시 후 다시 시도해 주세요.'},503);
  const url = new URL(request.url);
  if (url.pathname !== '/api/portfolio') return responseJSON({error:'존재하지 않는 경로입니다.'},404);
  try {
    if (request.method === 'GET') {
      const row = await env.DB.prepare('SELECT data, revision, updated_at FROM portfolios WHERE user_id = ?').bind(userId).first();
      return responseJSON(row ? {data:JSON.parse(row.data),revision:row.revision,updatedAt:row.updated_at} : {data:emptyPortfolio(),revision:0,updatedAt:null});
    }
    if (request.method !== 'PUT') return new Response(null,{status:405,headers:{Allow:'GET, PUT'}});
    if (request.headers.get('Origin') !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') return responseJSON({error:'요청 출처를 확인할 수 없습니다.'},403);
    if (!request.headers.get('Content-Type')?.startsWith('application/json')) return responseJSON({error:'JSON 형식이 필요합니다.'},415);
    const raw = await request.text();
    if (raw.length > 2_000_000) return responseJSON({error:'백업 파일 크기가 너무 큽니다.'},413);
    let body;
    try {body = JSON.parse(raw);} catch {return responseJSON({error:'데이터 형식을 확인해 주세요.'},400);}
    if (!Number.isSafeInteger(body.revision) || body.revision < 0) return responseJSON({error:'저장 버전이 올바르지 않습니다.'},400);
    const dashboardOnly=Object.hasOwn(body,'dashboard');
    if(dashboardOnly){
      const previous=await env.DB.prepare('SELECT data, revision, updated_at FROM portfolios WHERE user_id = ?').bind(userId).first();
      if((previous?.revision||0)!==body.revision)return responseJSON({error:'다른 기기에서 내역이 변경되었습니다. 새로고침한 뒤 다시 저장해 주세요.'},409);
      body.data={...(previous?JSON.parse(previous.data):emptyPortfolio()),dashboard:body.dashboard};
    }
    if(body.data && body.data.dashboard===undefined && body.revision>0){
      const previous=await env.DB.prepare('SELECT data, revision, updated_at FROM portfolios WHERE user_id = ?').bind(userId).first();
      if(!previous||previous.revision!==body.revision)return responseJSON({error:'다른 기기에서 내역이 변경되었습니다. 새로고침한 뒤 다시 저장해 주세요.'},409);
      body.data.dashboard=JSON.parse(previous.data).dashboard??null;
    }
    if (body.data && typeof body.data === 'object' && (['cashflow','fixed','budgets','snapshots','loanPayments'].some(key=>body.data[key]===undefined) || (Array.isArray(body.data.loans)&&body.data.loans.some(row=>row&&(row.interestMode===undefined||row.calculationMode===undefined))) || (Array.isArray(body.data.cashflow)&&body.data.cashflow.some(row=>row&&row.includeInForecast===undefined)) || (Array.isArray(body.data.retirement)&&body.data.retirement.some(row=>row&&(row.monthlyContribution===undefined||row.contributionDate===undefined)))) && body.revision > 0) {
      const previous = await env.DB.prepare('SELECT data, revision, updated_at FROM portfolios WHERE user_id = ?').bind(userId).first();
      if (!previous || previous.revision !== body.revision) return responseJSON({error:'다른 기기에서 내역이 변경되었습니다. 새로고침한 뒤 다시 저장해 주세요.'},409);
      const stored=JSON.parse(previous.data);
      for(const key of ['cashflow','fixed','budgets','snapshots','loanPayments'])if(body.data[key]===undefined)body.data[key]=stored[key]||[];
      const oldFlows=new Map((stored.cashflow||[]).map(row=>[row.id,row]));
      if(Array.isArray(body.data.cashflow))body.data.cashflow=body.data.cashflow.map(row=>row&&row.includeInForecast===undefined?{...row,includeInForecast:oldFlows.get(row.id)?.includeInForecast??true}:row);
      const oldRetirement=new Map((stored.retirement||[]).map(row=>[row.id,row]));
      if(Array.isArray(body.data.retirement))body.data.retirement=body.data.retirement.map(row=>{if(!row)return row;const old=oldRetirement.get(row.id);return {...row,monthlyContribution:row.monthlyContribution===undefined?(old?.monthlyContribution??0):row.monthlyContribution,contributionDate:row.contributionDate===undefined?(old?.contributionDate??''):row.contributionDate};});
      const oldLoans=new Map((stored.loans||[]).map(row=>[row.id,row]));
      if(Array.isArray(body.data.loans))body.data.loans=body.data.loans.map(row=>{if(!row)return row;const old=oldLoans.get(row.id);const kept=row.calculationMode===undefined&&old?.calculationMode==='term'?{calculationMode:old.calculationMode,remainingMonths:old.remainingMonths,graceMonths:old.graceMonths,nextPaymentDate:old.nextPaymentDate}:{};return {...row,...kept,interestMode:row.interestMode??old?.interestMode??'manual'};});
    }
    let clean;
    try {clean = validatePortfolio(body.data);if(!dashboardOnly)clean=recordCurrentSnapshot(clean);} catch(error) {return responseJSON({error:error.message},400);}
    const stamp = new Date().toISOString();
    let result;
    if (body.revision === 0) {
      result = await env.DB.prepare('INSERT INTO portfolios (user_id, data, revision, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(user_id) DO NOTHING').bind(userId,JSON.stringify(clean),stamp).run();
    } else {
      result = await env.DB.prepare('UPDATE portfolios SET data = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND revision = ?').bind(JSON.stringify(clean),stamp,userId,body.revision).run();
    }
    if (!result.meta.changes) return responseJSON({error:'다른 기기에서 내역이 변경되었습니다. 새로고침한 뒤 다시 저장해 주세요.'},409);
    return responseJSON({data:clean,revision:body.revision+1,updatedAt:stamp});
  } catch {return responseJSON({error:'저장소에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'},503);}
}
