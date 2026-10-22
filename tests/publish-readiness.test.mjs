import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateReadiness,sha,COLLECTION,CONFIGURER} from '../scripts/lib/publish-readiness.mjs';
const now=Date.parse('2026-10-22T12:00:00Z');
const ids=Array.from({length:2358},(_,i)=>String(20+i));
const plan={schema_version:2,chain_id:137,collection_address:COLLECTION,
 mode:'OFFLINE_TRANSACTION_DRAFT_NO_SIGNATURE',metadata_release_locally_staged:true,
 selected_token_ids:['20'],proposed_base_uri:'ipfs://bafynewcidxxx/{id}',
 operations:[{kind:'atomic_configure_mint',to:CONFIGURER,target_collection:COLLECTION,token_ids:['20']}]};
const catalog={pending:ids.map(id=>({proposed_token_id:id}))};
const release={status:'LOCAL_IPFS_STAGING_COMPLETE',
 production_approved:false,chain_modified:false,
 old_base_uri:'ipfs://bafybeih7ucalsv5p2xh3zjrslg6fjgz7y3t4q2fivebci56mz3wex4gwj4/{id}',
 proposed_base_uri:plan.proposed_base_uri,media_cid:'bafynewmediacidxxx'};
const releaseBytes=Buffer.from(JSON.stringify(release));
const chain={
 read_only:true,chain_id:137,contract:COLLECTION,configurer:CONFIGURER,
 created_at:new Date(now-30000).toISOString(),
 existing_checked:19,new_ids_checked:2358,
 plan_sha256:sha(Buffer.from(ids.join(','))),all_proposed_ids_unused:true,
 existing_consistent:true,
 historic:Array.from({length:19},(_,i)=>({token_id:String(i+1),historical_consistent:true})),
 new_token_states:ids.map(id=>({token_id:id,maxSupply:'0',totalMinted:'0',totalSupply:'0',vacant:true}))
};
const remote={status:'TWO_GATEWAY_SAMPLES_VERIFIED',checks_passed:true,
 chain_id:137,collection:COLLECTION,proposed_base_uri:release.proposed_base_uri,
 media_cid:release.media_cid,release_report_sha256:sha(releaseBytes),
 historic_json_exact_match_per_gateway:19,independent_gateway_hosts:['ipfs.io','dweb.link'],
 new_metadata_image_sample_ids:['20','609','1199','1788','2377'],
 total_remote_files_verified:58,verified_at:new Date(now-60000).toISOString()};
const valid=()=>({plan,catalog,releaseBytes,localVerified:true,remote,chain,enableSigning:true,now});
const approved=(opts)=>Object.values(evaluateReadiness(opts)).every(Boolean);
test('only all exact bound, current proofs can unlock',()=>{
 assert.equal(approved(valid()),true);
});
test('fails closed with missing data or expired reports',()=>{
 assert.equal(approved({...valid(),remote:null}),false);
 assert.equal(approved({...valid(),chain:null}),false);
 assert.equal(approved({...valid(),enableSigning:false}),false);
 assert.equal(approved({...valid(),now:now+25*3600000}),false);
 assert.equal(approved({...valid(),localVerified:false}),false);
});
test('fails closed with occupied ID or switched address',()=>{
 const bad=structuredClone(chain);
 bad.new_token_states[234].totalMinted='1';
 assert.equal(approved({...valid(),chain:bad}),false);
 const bad2=structuredClone(chain);
 bad2.configurer='0x0000000000000000000000000000000000000000';
 assert.equal(approved({...valid(),chain:bad2}),false);
 const badPlan=structuredClone(plan);
 badPlan.operations[0].to='0x0000000000000000000000000000000000000000';
 assert.equal(approved({...valid(),plan:badPlan}),false);
});
test('fails closed if remote CID or sample set changes',()=>{
 const bad=structuredClone(remote);bad.media_cid='bafyother';
 assert.equal(approved({...valid(),remote:bad}),false);
 const wrong=structuredClone(remote);wrong.new_metadata_image_sample_ids=['20'];
 assert.equal(approved({...valid(),remote:wrong}),false);
});
