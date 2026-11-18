// Server-to-server relay. The existing OpenAI key never leaves this runtime.
const model='gpt-6.1-terra',effort='xhigh';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const failure=(code,status)=>json({error:{code}},status);
async function readBody(request){
 if(!request.body)throw new Error('invalid_body');const reader=request.body.getReader(),chunks=[];let size=0;
 const timer=setTimeout(()=>reader.cancel().catch(()=>{}),10000);
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();throw new Error('request_too_large');}chunks.push(value);}}
 finally{clearTimeout(timer);reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
export function createRelayHandler({expectedTokenHash,readApiKey,fetchImpl=fetch}){
 return async request=>{
  // Browsers do not receive a cross-origin allowance or an OpenAI credential.
  if(request.headers.has('Origin'))return failure('relay_server_only',403);
  const token=request.headers.get('Authorization')?.match(/^Bearer (moa_[A-Za-z0-9_-]{43})$/)?.[1]||'';
  if(!/^moa_[A-Za-z0-9_-]{43}$/.test(token)||!/^\p{ASCII_Hex_Digit}{64}$/u.test(expectedTokenHash||''))return failure('relay_auth_required',401);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
  if(hash!==expectedTokenHash.toLowerCase())return failure('relay_auth_required',401);
  const apiKey=readApiKey()?.trim();
  if(!apiKey||!/^sk-[A-Za-z0-9_-]{20,600}$/.test(apiKey))return failure('relay_missing_key',503);
  if(request.method==='GET')return json({configured:true,model,reasoning:effort});
  if(request.method!=='POST')return failure('method_not_allowed',405);
  if(request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()!=='application/json')return failure('invalid_content_type',415);
  let body;try{body=await readBody(request);}catch(error){return failure(error.message==='request_too_large'?'request_too_large':'invalid_body',error.message==='request_too_large'?413:400);}
  const allowed=['model','store','max_output_tokens','reasoning','instructions','input','text'];
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!allowed.includes(key))||body.model!==model||body.store!==false||body.reasoning?.effort!==effort||Object.keys(body.reasoning||{}).some(key=>key!=='effort')||!Number.isInteger(body.max_output_tokens)||body.max_output_tokens<1||body.max_output_tokens>16384||typeof body.instructions!=='string'||body.instructions.length>4000||typeof body.input!=='string'||body.input.length>55000||body.text?.format?.type!=='json_schema'||!['repayment_advice','asset_advice'].includes(body.text.format.name)||body.text.format.strict!==true)return failure('invalid_relay_payload',400);
  try{
   const upstream=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:'Bearer '+apiKey},body:JSON.stringify({...body,model,reasoning:{effort},store:false}),signal:AbortSignal.any([request.signal,AbortSignal.timeout(140000)])});
   if(!upstream.ok){const detail=await upstream.json().catch(()=>({}));const code=['insufficient_quota','rate_limit_exceeded','model_not_found','invalid_api_key'].includes(detail?.error?.code)?detail.error.code:'provider_error';return failure(code,upstream.status);}
   const result=await upstream.json();return json(result);
  }catch(error){return failure(error?.name==='TimeoutError'?'relay_timeout':'relay_upstream_failed',error?.name==='TimeoutError'?504:502);}
 };
}
