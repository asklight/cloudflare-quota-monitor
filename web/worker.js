import {fetchQuotaSnapshot,buildProfileOverview} from './generated/collector.js';
const PROFILE={id:'asklight',label:'Asklight',accountId:'…203e',apiToken:'configured',enabled:true};
async function readSnapshot(env){const row=await env.USAGE.prepare('SELECT payload FROM quota_monitor_snapshots ORDER BY collected_at DESC LIMIT 1').first();return row?JSON.parse(row.payload):null;}
async function collect(env){
  const last=await readSnapshot(env);
  if(last && Date.now()-last.lastUpdated<600000)return last;
  const quotas=await fetchQuotaSnapshot(env.CF_API_TOKEN,env.CF_ACCOUNT_ID);
  if(quotas.workers.used===null && quotas.d1.reads===null)throw new Error('Cloudflare 采集失败；保留上次数据');
  const snapshot={quotas,lastUpdated:Date.now(),lastError:null};
  const date=new Date().toISOString().slice(0,10);
  await env.USAGE.prepare('INSERT INTO quota_monitor_snapshots(day,collected_at,payload) VALUES (?,?,?) ON CONFLICT(day) DO UPDATE SET collected_at=excluded.collected_at,payload=excluded.payload').bind(date,snapshot.lastUpdated,JSON.stringify(snapshot)).run();
  return snapshot;
}
export default {
  async scheduled(event,env,ctx){ctx.waitUntil(collect(env).catch(e=>console.error('Quota collection failed:',e.message)));},
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/')){
      try{
        if(url.pathname==='/api/health')return Response.json({ok:true});
        if(!['/api/quotas','/api/overview','/api/refresh'].includes(url.pathname))return new Response('Not found',{status:404});
        if(url.pathname==='/api/refresh' && request.method!=='POST')return new Response('Method not allowed',{status:405});
        if(request.method==='POST' && request.headers.get('Origin')!==url.origin)return new Response('Forbidden',{status:403});
        let snapshot=await readSnapshot(env);
        if(url.pathname==='/api/refresh' || !snapshot)snapshot=await collect(env);
        const history=await env.USAGE.prepare('SELECT payload FROM quota_monitor_snapshots ORDER BY day DESC LIMIT 200').all();
        const samples=history.results.reverse().map(r=>{const s=JSON.parse(r.payload);return {timestamp:s.lastUpdated,quotas:s.quotas};});
        if(url.pathname==='/api/overview'){
          const account=buildProfileOverview(PROFILE,snapshot);
          return Response.json({data:{activeProfileId:'asklight',accounts:[account],summary:{total:1,criticalCount:account.criticalCount?1:0,watchCount:account.watchCount?1:0,errorCount:0,topAccount:account,lastUpdated:snapshot.lastUpdated},syncLogs:[]}},{headers:{'Cache-Control':'no-store'}});
        }
        return Response.json({data:snapshot.quotas,history:samples,lastUpdated:snapshot.lastUpdated},{headers:{'Cache-Control':'no-store'}});
      }catch(e){return Response.json({error:e.message},{status:502,headers:{'Cache-Control':'no-store'}});}
    }
    if(url.pathname==='/' || url.pathname==='/index.html')url.pathname='/dashboard.html';
    return env.ASSETS.fetch(new Request(url,request));
  }
};
