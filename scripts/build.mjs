import {readFile,writeFile,mkdir,readdir,cp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const assets={};
for(const filename of await readdir(path.join(root,'public'))){
 const mime={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',mjs:'text/javascript; charset=utf-8',svg:'image/svg+xml'}[filename.split('.').at(-1)];
 if(mime)assets['/'+filename]={body:await readFile(path.join(root,'public',filename),'utf8'),type:mime};
}
await writeFile(path.join(root,'server/static-assets.mjs'),'export const assets='+JSON.stringify(assets)+';\n');
const domain=(await readFile(path.join(root,'public/domain.mjs'),'utf8')).replaceAll('export ','');
const api=(await readFile(path.join(root,'server/api.mjs'),'utf8')).replace(/^import .*;\n/m,'').replaceAll('export ','');
const worker=(await readFile(path.join(root,'server/worker.mjs'),'utf8')).replace(/^import .*;\n/gm,'');
await mkdir(path.join(root,'dist/server'),{recursive:true});
await mkdir(path.join(root,'dist/.openai'),{recursive:true});
await writeFile(path.join(root,'dist/server/index.js'),domain+'\n'+api+'\nconst assets='+JSON.stringify(assets)+';\n'+worker);
await cp(path.join(root,'.openai/hosting.json'),path.join(root,'dist/.openai/hosting.json'));
await cp(path.join(root,'drizzle'),path.join(root,'dist/drizzle'),{recursive:true});
console.log('Built Worker with '+Object.keys(assets).length+' local assets.');
