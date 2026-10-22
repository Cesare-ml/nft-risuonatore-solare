import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeMintProgress} from '../scripts/lib/mint-progress.mjs';
const rows=Array.from({length:2358},(_,i)=>({
 token_id:String(i+20),vacant:true,maxSupply:'0',totalMinted:'0',totalSupply:'0'
}));
test('first session begins with token ID 20',()=>{
 const p=analyzeMintProgress(rows);
 assert.equal(p.first_unminted_token_id,'20');
 assert.equal(p.remaining_token_count,2358);
});
test('after 10 fully minted IDs resume at 30',()=>{
 const r=structuredClone(rows);
 for(let i=0;i<10;i++)r[i]={...r[i],vacant:false,maxSupply:'1',totalMinted:'1',totalSupply:'1'};
 const p=analyzeMintProgress(r);
 assert.equal(p.fully_minted_prefix_count,10);
 assert.equal(p.first_unminted_token_id,'30');
 assert.equal(p.remaining_token_count,2348);
});
test('refuse holes, partial states, duplicates and incomplete audit',()=>{
 const g=structuredClone(rows);g[3]={...g[3],vacant:false,maxSupply:'1',totalMinted:'1',totalSupply:'1'};
 assert.throws(()=>analyzeMintProgress(g),/Non-contiguous/);
 const b=structuredClone(rows);b[0]={...b[0],vacant:false,maxSupply:'1'};
 assert.throws(()=>analyzeMintProgress(b),/Unsafe/);
 const bad=structuredClone(rows);bad[10].token_id='20';
 assert.throws(()=>analyzeMintProgress(bad),/ordering mismatch/);
 assert.throws(()=>analyzeMintProgress(rows.slice(10)),/2358/);
});
