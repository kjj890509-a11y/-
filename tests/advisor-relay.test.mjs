import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRelayHandler} from '../supabase/functions/moa-advisor-relay/relay.mjs';
const token='moa_'+'t'.repeat(43),key='sk-test-relay-'+'x'.repeat(32),hash=createHash('sha256').update(token).digest('hex');
const body={model:'gpt-6.1-terra',reasoning:{effort:'xhigh'},store:false,max_output_tokens:16384,instructions:'테스트 상담 지시',input:JSON.stringify({question:'검증용 질문'}),text:{format:{type:'json_schema',name:'repayment_advice',strict:true,schema:{type:'object',properties:{},additionalProperties:false}}}};
const request=(payload=body,{method='POST',auth=token,origin}={})=>new Request('https://relay.test/moa-advisor-relay',{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{}),...(origin?{Origin:origin}:{})},body:method==='POST'?typeof payload==='string'?payload:JSON.stringify(payload):undefined});
test('relay authenticates its dedicated service before key access, blocks browsers and exposes no secret in health responses',async()=>{
 let keyReads=0,calls=0;const relay=createRelayHandler({expectedTokenHash:hash,readApiKey:()=>{keyReads++;return key;},fetchImpl:async()=>{calls++;throw Error();}});
 assert.equal((await relay(request(body,{auth:''}))).status,401);assert.equal((await relay(request(body,{auth:'moa_'+'w'.repeat(43)}))).status,401);assert.equal(keyReads,0);assert.equal((await relay(request(body,{origin:'https://moa.test'}))).status,403);
 const health=await relay(request(body,{method:'GET'})),text=await health.text();assert.equal(health.status,200);assert.match(text,/gpt-6.1-terra/);assert.match(text,/xhigh/);assert.ok(!text.includes(key)&&!text.includes(token));assert.equal(calls,0);
 const missing=createRelayHandler({expectedTokenHash:hash,readApiKey:()=>undefined});assert.equal((await missing(request(body,{method:'GET'}))).status,503);
});
test('relay reuses the server-held key only for the fixed model and keeps service credentials out of the provider request',async()=>{
 const relay=createRelayHandler({expectedTokenHash:hash,readApiKey:()=>key,fetchImpl:async(url,init)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(init.headers.Authorization,'Bearer '+key);assert.equal(init.headers['X-Moa-Relay-Token'],undefined);const payload=JSON.parse(init.body);assert.equal(payload.model,'gpt-6.1-terra');assert.equal(payload.reasoning.effort,'xhigh');assert.equal(payload.store,false);assert.equal(payload.max_output_tokens,16384);assert.ok(!init.body.includes(token));return Response.json({status:'completed',output_text:'검증용 응답'});
 }});const response=await relay(request());assert.equal(response.status,200);assert.equal((await response.json()).output_text,'검증용 응답');
});
test('relay rejects model, reasoning, retention and tool overrides as well as malformed and oversized requests before provider calls',async()=>{
 let calls=0;const relay=createRelayHandler({expectedTokenHash:hash,readApiKey:()=>key,fetchImpl:async()=>{calls++;throw Error();}});
 for(const patch of [{model:'other'},{reasoning:{effort:'none'}},{store:true},{tools:[{type:'web_search'}]},{stream:true},{max_output_tokens:16385},{text:{format:{type:'text'}}}])assert.equal((await relay(request({...body,...patch}))).status,400);
 assert.equal((await relay(request('invalid json'))).status,400);assert.equal((await relay(request('x'.repeat(65537)))).status,413);assert.equal(calls,0);
});
test('relay returns actionable provider status and safe codes without upstream error text or key material',async()=>{
 const relay=createRelayHandler({expectedTokenHash:hash,readApiKey:()=>key,fetchImpl:async()=>Response.json({error:{code:'insufficient_quota',message:key}},{status:429})});const response=await relay(request());assert.equal(response.status,429);const raw=await response.text();assert.match(raw,/insufficient_quota/);assert.ok(!raw.includes(key));
 const timeout=createRelayHandler({expectedTokenHash:hash,readApiKey:()=>key,fetchImpl:async()=>{throw new DOMException('slow','TimeoutError');}});assert.equal((await timeout(request())).status,504);
});
test('relay accepts asset consultation schema and continues to reject unrelated response modes',async()=>{
 let calls=0;const relay=createRelayHandler({expectedTokenHash:hash,readApiKey:()=>key,fetchImpl:async(url,init)=>{calls++;assert.equal(JSON.parse(init.body).text.format.name,'asset_advice');return Response.json({status:'completed',output_text:'{}'});}});
 const payload={...body,text:{format:{...body.text.format,name:'asset_advice'}}};assert.equal((await relay(request(payload))).status,200);assert.equal(calls,1);
 assert.equal((await relay(request({...payload,text:{format:{...payload.text.format,name:'unrelated'}}}))).status,400);assert.equal(calls,1);
});
