import assert from 'node:assert/strict';
import {buildMintPlan,group,COLLECTION} from '../scripts/lib/mint-plan.mjs';
const snapshot={collection:{contract_address:COLLECTION},items:Array.from({length:19},(_,i)=>({token_id:String(i+1)}))};
const catalog={mode:'DRY_RUN_ONLY',target_collection:{contract_address:COLLECTION},
 pending:Array.from({length:2358},(_,i)=>({
  artwork_id:'RS-TEST-'+i,proposed_token_id:String(i+20)
 }))};
const a=buildMintPlan(snapshot,catalog,{batchSize:10,start:0,count:23});
assert.equal(a.totals.configuration_transactions,23);
assert.equal(a.totals.batch_mint_transactions,3);
assert.deepEqual(a.operations.at(-1).token_ids,['40','41','42']);
assert.equal(a.preparation_ready_for_live_execution,false);
assert.equal(a.metadata_release_locally_staged,false);
const b=buildMintPlan(snapshot,catalog,{batchSize:30,start:2357,count:1});
assert.deepEqual(b.selected_token_ids,['2377']);
assert.equal(group([1,2,3,4,5],2).length,3);
assert.throws(()=>buildMintPlan(snapshot,catalog,{recipient:'bad'}),/recipient/);
assert.throws(()=>buildMintPlan(snapshot,catalog,{batchSize:31}),/Batch size|batchSize/);
const bad=structuredClone(catalog);bad.pending[0].proposed_token_id='1';
assert.throws(()=>buildMintPlan(snapshot,bad),/Bad proposed/);
const report={status:'LOCAL_IPFS_STAGING_COMPLETE',
 historic_json_preserved_byte_identical:19,
 proposed_base_uri:'ipfs://bafybeih7ucalsv5p2xh3zjrslg6fjgz7y3t4q2fivebci56mz3wex4gwj4/{id}'};
const c=buildMintPlan(snapshot,catalog,{count:1,release:report});
assert.equal(c.metadata_release_locally_staged,true);
console.log('PASS: offline mint planning / batch partitioning / token collision / fail-closed release gates');
