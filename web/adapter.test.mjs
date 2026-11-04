import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('failed telemetry stays unavailable rather than becoming zero',async()=>{
  const source=readFileSync(new URL('./generated/collector.js',import.meta.url),'utf8');
  const {fetchQuotaSnapshot}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const originalFetch=globalThis.fetch;
  const originalWarn=console.warn;
  try {
    globalThis.fetch=async()=>Response.json({success:false,errors:[{message:'denied'}]},{status:403});
    console.warn=()=>{};
    const result=await fetchQuotaSnapshot('test-token','test-account');
    assert.equal(result.workers.used,null);
    assert.equal(result.workers.percent,null);
    assert.equal(result.d1.reads,null);
    assert.equal(result.r2.storage,null);
    assert.equal(result.pages.used,null);
  }finally{globalThis.fetch=originalFetch;console.warn=originalWarn;}
});
