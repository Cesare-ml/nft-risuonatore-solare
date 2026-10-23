import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildMintPlan,group,COLLECTION,CONFIGURER} from '../scripts/lib/mint-plan.mjs';
const snapshot={collection:{contract_address:COLLECTION},items:Array.from({length:19},(_,i)=>({token_id:String(i+1)}))};
const catalog={mode:'DRY_RUN_ONLY',target_collection:{contract_address:COLLECTION},
 pending:Array.from({length:2358},(_,i)=>({
  artwork_id:'RS-TEST-'+i,proposed_token_id:String(i+20)
 }))};
test('atomic configure+mint batch count and contract',()=>{
 const a=buildMintPlan(snapshot,catalog,{batchSize:10,start:0,count:23});
 assert.equal(a.totals.selected,23);
 assert.equal(a.totals.atomic_configure_mint_transactions,3);
 assert.equal(a.totals.expected_total_transactions,3);
 assert.equal(a.totals.direct_owner_legacy_transactions_avoided,23);
 assert.deepEqual(a.operations.at(-1).token_ids,['40','41','42']);
 assert.ok(a.operations.every(o=>o.kind==='atomic_configure_mint'&&o.to===CONFIGURER));
 assert.ok(a.operations.every(o=>o.base_uri_must_remain_unchanged));
 assert.equal(a.preparation_ready_for_live_execution,false);
 assert.equal(a.metadata_release_locally_staged,false);
});
test('final proposed token and partitions',()=>{
 const b=buildMintPlan(snapshot,catalog,{batchSize:30,start:2357,count:1});
 assert.deepEqual(b.selected_token_ids,['2377']);
 assert.equal(group([1,2,3,4,5],2).length,3);
});
test('invalid plans must fail closed',()=>{
 assert.throws(()=>buildMintPlan(snapshot,catalog,{recipient:'bad'}),/recipient/);
 assert.throws(()=>buildMintPlan(snapshot,catalog,{batchSize:31}),/batchSize/);
 const bad=structuredClone(catalog);bad.pending[0].proposed_token_id='1';
 assert.throws(()=>buildMintPlan(snapshot,bad),/Bad proposed/);
});
test('local stage report never authorizes live transactions',()=>{
 const report={status:'LOCAL_IPFS_STAGING_COMPLETE',
  historic_json_preserved_byte_identical:19,
  proposed_base_uri:'ipfs://bafybeih7ucalsv5p2xh3zjrslg6fjgz7y3t4q2fivebci56mz3wex4gwj4/{id}'};
 const c=buildMintPlan(snapshot,catalog,{count:1,release:report});
 assert.equal(c.metadata_release_locally_staged,true);
 assert.equal(c.preparation_ready_for_live_execution,false);
});

test('one-time Arweave manifest is accepted as a DRAFT only, never live approval',()=>{
 const release={
   status:'ARWEAVE_UPLOADED_PENDING_INDEPENDENT_VERIFICATION',
   historical_json_bytes_preserved:19,metadata_paths:2377,
   manifest_id:'a'.repeat(43),
   proposed_base_uri:'https://arweave.net/'+'a'.repeat(43)+'/{id}',
   production_approved:false,chain_modified:false
 };
 const plan=buildMintPlan(snapshot,catalog,{start:0,count:1,release});
 assert.equal(plan.metadata_release_locally_staged,true);
 assert.equal(plan.proposed_base_uri,release.proposed_base_uri);
 assert.equal(plan.preparation_ready_for_live_execution,false);
 release.proposed_base_uri='https://example.com/editable/{id}';
 assert.equal(buildMintPlan(snapshot,catalog,{start:0,count:1,release}).metadata_release_locally_staged,false);
});
