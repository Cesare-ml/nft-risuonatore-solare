import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readHistoricArchive,historicalId64,historicalHash} from '../scripts/lib/historic-archive.mjs';
const OLD_CID='bafybeih7ucalsv5p2xh3zjrslg6fjgz7y3t4q2fivebci56mz3wex4gwj4';
const CONTRACT='0xead98e12d3836562ea39c6a6ca5ef1292359a862';
const ids=Array.from({length:19},(_,i)=>({token_id:String(i+1)}));
async function fixture(fn){
 const dir=await mkdtemp(join(tmpdir(),'solar-archive-test-'));
 const manifest={
  status:'KUBO_HISTORIC_19_VERIFIED',original_cid:OLD_CID,
  collection_address:CONTRACT,existing_count:19,no_blockchain_transactions:true,
  records:{}
 };
 for(const {token_id} of ids){
  const file=historicalId64(token_id);
  const raw=Buffer.from(JSON.stringify({name:'Old token '+token_id,image:'ipfs://historic/image/'+token_id}));
  await writeFile(join(dir,file),raw);
  manifest.records[file]={
   token_id,sha256:historicalHash(raw),bytes:raw.length,
   name:'Old token '+token_id,image:'ipfs://historic/image/'+token_id,
   source:'Kubo ipfs cat '+OLD_CID+'/'+file
  };
 }
 await writeFile(join(dir,'manifest.json'),JSON.stringify(manifest));
 try{await fn(dir,manifest)}finally{await rm(dir,{recursive:true,force:true})}
}
test('verified Kubo manifest preserves 19 exact original JSON bytes',async()=>{
 await fixture(async(dir)=>{
  const loaded=await readHistoricArchive(dir,ids);
  assert.equal(Object.keys(loaded).length,19);
  assert.deepEqual(JSON.parse(loaded[historicalId64(3)].raw),{
   name:'Old token 3',image:'ipfs://historic/image/3'
  });
 });
});
test('altered archived JSON rejected, even if file size identical',async()=>{
 await fixture(async(dir)=>{
  const path=join(dir,historicalId64(1));
  const bad=Buffer.from(await readFile(path));
  bad[bad.indexOf('1'.charCodeAt(0))]='9'.charCodeAt(0);
  await writeFile(path,bad);
  await assert.rejects(readHistoricArchive(dir,ids),/SHA256\/size mismatch/);
 });
});
test('changed original CID provenance rejected',async()=>{
 await fixture(async(dir,manifest)=>{
  manifest.records[historicalId64(5)].source='HTTP gateway copy';
  await writeFile(join(dir,'manifest.json'),JSON.stringify(manifest));
  await assert.rejects(readHistoricArchive(dir,ids),/provenance/);
 });
});
