import {handleApi} from './api.mjs';
import {handlePreferences} from './preferences.mjs';
import {handleAdvisor} from './advisor.mjs';
import {assets} from './static-assets.mjs';
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/preferences') return handlePreferences(request,env);
    if (url.pathname === '/api/advisor') return handleAdvisor(request,env);
    if (url.pathname.startsWith('/api/')) return handleApi(request,env);
    const asset = assets[url.pathname === '/' ? '/index.html' : url.pathname];
    if (!asset) return new Response('Not found',{status:404});
    if (!['GET','HEAD'].includes(request.method)) return new Response(null,{status:405});
    let body=null;
    if(request.method==='GET')body=asset.encoding==='base64'?Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)):asset.body;
    return new Response(body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'self'",'Permissions-Policy':'camera=(), microphone=(), geolocation=()'}});
  }
};
