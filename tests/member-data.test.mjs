import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleApi} from '../server/api.mjs';
import {handlePreferences} from '../server/preferences.mjs';
import {emptyPortfolio} from '../public/domain.mjs';

const origin='https://moa.test';
const endpoint='/api/portfolio';
const preferences='/api/preferences';

function database(){
  const sqlite=new DatabaseSync(':memory:');
  for(const migration of ['0000_assets.sql','0001_advisor_usage.sql','0002_view_preferences.sql']){
    sqlite.exec(readFileSync(new URL('../drizzle/'+migration,import.meta.url),'utf8'));
  }
  const DB={
    prepare(sql){
      return {bind(...values){
        return {
          first:()=>sqlite.prepare(sql).get(...values),
          run:()=>({meta:sqlite.prepare(sql).run(...values)})
        };
      }};
    },
    async batch(statements){
      sqlite.exec('BEGIN');
      try{
        const results=statements.map(statement=>statement.run());
        sqlite.exec('COMMIT');
        return results;
      }catch(error){
        sqlite.exec('ROLLBACK');
        throw error;
      }
    }
  };
  return {sqlite,DB};
}

function request(path,user,method='GET',body,requestOrigin=origin){
  const headers=new Headers();
  if(user)headers.set('oai-authenticated-user-id',user);
  if(body!==undefined){
    headers.set('Content-Type','application/json');
    headers.set('Origin',requestOrigin);
  }
  return new Request(origin+path,{method,headers,body:JSON.stringify(body)});
}

function ledger(name,balance){
  return {...emptyPortfolio(),deposits:[{id:'fixture-deposit',name,balance,rate:0}]};
}

test('two members with the same record ID can read, save and clear only their own records',async()=>{
  const {sqlite,DB}=database();
  const env={DB};
  const call=(user,method,body)=>handleApi(request(endpoint,user,method,body),env);
  const get=async user=>(await call(user)).json();
  assert.deepEqual((await get('member-a')).data,emptyPortfolio());
  const a=ledger('가상 계좌 A',120000);
  const b=ledger('가상 계좌 B',620000);
  assert.equal((await call('member-a','PUT',{revision:0,data:a,userId:'member-b'})).status,200);
  assert.equal((await call('member-b','PUT',{revision:0,data:b})).status,200);
  assert.equal((await get('member-a')).data.deposits[0].balance,120000);
  assert.equal((await get('member-b')).data.deposits[0].balance,620000);

  for(const member of ['member-a','member-b']){
    sqlite.prepare('INSERT INTO view_preferences (user_id,data,revision) VALUES (?,?,2)')
      .run(member,JSON.stringify({version:1,tables:{all:{sort:'date-desc'}}}));
    sqlite.prepare('INSERT INTO advisor_usage (actor,day,attempts) VALUES (?,?,?)')
      .run('user:'+member,'2026-11-19',1);
  }
  sqlite.prepare('INSERT INTO advisor_usage (actor,day,attempts) VALUES (?,?,?)').run('global','2026-11-19',2);
  const confirmation={confirmation:'erase-my-data',userId:'member-b'};
  assert.equal((await call(null,'DELETE',confirmation)).status,401);
  assert.equal((await handleApi(request(endpoint,'member-a','DELETE',confirmation,'https://another.test'),env)).status,403);
  assert.equal((await call('member-a','DELETE',{})).status,400);
  assert.equal((await get('member-a')).data.deposits[0].balance,120000);

  assert.deepEqual(await (await call('member-a','DELETE',confirmation)).json(),{erased:true});
  const cleared=await get('member-a');
  assert.deepEqual(cleared.data,emptyPortfolio());
  assert.equal(cleared.revision,2);
  assert.equal((await call('member-a','PUT',{revision:1,data:a})).status,409);
  assert.equal((await get('member-b')).data.deposits[0].balance,620000);
  const view=await (await handlePreferences(request(preferences,'member-a'),env)).json();
  assert.deepEqual(view,{data:{version:1,tables:{}},revision:3});
  assert.equal((await handlePreferences(request(preferences,'member-a','PUT',{data:view.data,revision:2}),env)).status,409);
  assert.equal(sqlite.prepare('SELECT revision FROM view_preferences WHERE user_id=?').get('member-b').revision,2);
  assert.deepEqual(sqlite.prepare('SELECT actor FROM advisor_usage ORDER BY actor').all().map(row=>row.actor),['global','user:member-b']);
  assert.equal((await call('member-a','PUT',{revision:cleared.revision,data:ledger('새 가상 계좌',45000)})).status,200);
  assert.equal((await get('member-a')).data.deposits[0].balance,45000);
  sqlite.close();
});
