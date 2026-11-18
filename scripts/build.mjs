import {readFile,writeFile,mkdir,readdir,cp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const assets={};
for(const filename of await readdir(path.join(root,'public'))){
 if(filename.startsWith('finance-brand-')&&filename.endsWith('.png')){
   assets['/'+filename]={body:await readFile(path.join(root,'public',filename),'base64'),type:'image/png',encoding:'base64'};
   continue;
 }
 const mime={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',mjs:'text/javascript; charset=utf-8',svg:'image/svg+xml'}[filename.split('.').at(-1)];
 if(mime)assets['/'+filename]={body:await readFile(path.join(root,'public',filename),'utf8'),type:mime};
}
// A new stylesheet gets a new URL even when an existing tab has cached the previous release.
const indexPage = assets['/index.html'];
indexPage.body = indexPage.body.replace(/href="(\/[^"?#]+\.css)"/g, (_, pathname) => {
  const version = createHash('sha256').update(assets[pathname].body).digest('hex').slice(0, 12);
  return `href="${pathname}?v=${version}"`;
});
assets['/sortable.mjs']={body:await readFile(path.join(root,'node_modules/sortablejs/modular/sortable.esm.js'),'utf8'),type:'text/javascript; charset=utf-8'};
assets['/sortable-license.txt']={body:await readFile(path.join(root,'node_modules/sortablejs/LICENSE'),'utf8'),type:'text/plain; charset=utf-8'};
await writeFile(path.join(root,'server/static-assets.mjs'),'export const assets='+JSON.stringify(assets)+';\n');
const domain=(await readFile(path.join(root,'public/domain.mjs'),'utf8')).replaceAll('export ','');
const api=(await readFile(path.join(root,'server/api.mjs'),'utf8')).replace(/^import .*;\n/m,'').replaceAll('export ','');
const repayment=(await readFile(path.join(root,'public/repayment.mjs'),'utf8')).replace(/^import .*;\n/gm,'').replaceAll('export ','');
const advisor=(await readFile(path.join(root,'server/advisor.mjs'),'utf8')).replace(/^import .*;\n/gm,'').replaceAll('export ','');
const recordLayoutModel=(await readFile(path.join(root,'public/record-layout-model.mjs'),'utf8')).replace(/^import .*;\n/gm,'').replaceAll('export ','');
const ledgerModel=(await readFile(path.join(root,'public/ledger-model.mjs'),'utf8')).replace(/^import .*;\n/gm,'').replaceAll('export ','');
const preferences=(await readFile(path.join(root,'server/preferences.mjs'),'utf8')).replace(/^import .*;\n/gm,'').replaceAll('export ','');
const worker=(await readFile(path.join(root,'server/worker.mjs'),'utf8')).replace(/^import .*;\n/gm,'');
await mkdir(path.join(root,'dist/server'),{recursive:true});
await mkdir(path.join(root,'dist/.openai'),{recursive:true});
await writeFile(path.join(root,'dist/server/index.js'),domain+'\n'+recordLayoutModel+'\n'+ledgerModel+'\n'+preferences+'\n'+repayment+'\n'+api+'\n'+advisor+'\nconst assets='+JSON.stringify(assets)+';\n'+worker);
await cp(path.join(root,'.openai/hosting.json'),path.join(root,'dist/.openai/hosting.json'));
await cp(path.join(root,'drizzle'),path.join(root,'dist/drizzle'),{recursive:true});
console.log('Built Worker with '+Object.keys(assets).length+' local assets.');
