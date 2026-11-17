import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync,readdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
execFileSync(process.execPath,['scripts/build.mjs'],{stdio:'inherit'});
mkdirSync('.local',{recursive:true});
const db=new DatabaseSync('.local/preview.sqlite');
for(const file of readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8').replace('CREATE TABLE portfolios','CREATE TABLE IF NOT EXISTS portfolios'));
const DB={prepare(sql){return{bind(...values){return{async first(){return db.prepare(sql).get(...values)||null;},async run(){const result=db.prepare(sql).run(...values);return {meta:{changes:Number(result.changes)}};}};}};}};
const worker=(await import(pathToFileURL(path.resolve('server/worker.mjs')).href)).default;
const args=process.argv.slice(2),port=Number(args[args.indexOf('--port')+1])||4173;
const server=createServer(async(req,res)=>{
 try{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const headers=new Headers(req.headers);headers.set('oai-authenticated-user-id','local-preview-only');
  const request=new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
  const response=await worker.fetch(request,{DB,OPENAI_API_KEY:process.env.OPENAI_API_KEY,ADVISOR_RELAY_URL:process.env.ADVISOR_RELAY_URL,ADVISOR_RELAY_TOKEN:process.env.ADVISOR_RELAY_TOKEN,ADVISOR_USER_DAILY_LIMIT:process.env.ADVISOR_USER_DAILY_LIMIT,ADVISOR_GLOBAL_DAILY_LIMIT:process.env.ADVISOR_GLOBAL_DAILY_LIMIT});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('Preview error');}
});
server.listen(port,'0.0.0.0',()=>console.log(`Preview listening on ${port}`));
