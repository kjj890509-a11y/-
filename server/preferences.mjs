import {validateLedgerPreferences} from '../public/ledger-model.mjs';
const preferencesJSON=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function handlePreferences(request,env){
 const user=request.headers.get('oai-authenticated-user-id');if(!user)return preferencesJSON({error:'로그인 후 이용해 주세요.'},401);
 if(!env.DB)return preferencesJSON({error:'보기 설정에 연결할 수 없습니다.'},503);
 try{
  if(request.method==='GET'){const row=await env.DB.prepare('SELECT data, revision FROM view_preferences WHERE user_id=?').bind(user).first();return preferencesJSON({data:row?JSON.parse(row.data):{version:1,tables:{}},revision:row?.revision||0});}
  if(request.method!=='PUT')return preferencesJSON({error:'지원하지 않는 요청입니다.'},405);
  if(request.headers.get('Origin')!==new URL(request.url).origin||request.headers.get('Sec-Fetch-Site')==='cross-site')return preferencesJSON({error:'요청 출처를 확인해 주세요.'},403);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return preferencesJSON({error:'JSON 형식이 필요합니다.'},415);
  const raw=await request.text();if(raw.length>200000)return preferencesJSON({error:'보기 설정이 너무 큽니다.'},413);
  let body,data;try{body=JSON.parse(raw);data=validateLedgerPreferences(body.data);if(!Number.isSafeInteger(body.revision)||body.revision<0)throw new Error('보기 버전을 확인해 주세요.');}catch(error){return preferencesJSON({error:error.message},400);}
  const result=body.revision===0?await env.DB.prepare('INSERT INTO view_preferences (user_id,data,revision) VALUES (?,?,1) ON CONFLICT(user_id) DO NOTHING').bind(user,JSON.stringify(data)).run():await env.DB.prepare('UPDATE view_preferences SET data=?, revision=revision+1 WHERE user_id=? AND revision=?').bind(JSON.stringify(data),user,body.revision).run();
  if(!result.meta.changes)return preferencesJSON({error:'다른 기기에서 보기가 변경됐습니다. 새로고침 후 다시 저장해 주세요.'},409);
  return preferencesJSON({data,revision:body.revision+1});
 }catch{return preferencesJSON({error:'보기 설정을 불러오거나 저장하지 못했습니다.'},503);}
}
