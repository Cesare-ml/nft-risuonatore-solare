import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateReadiness,sha,COLLECTION,CONFIGURER} from '../scripts/lib/publish-readiness.mjs';
const now=Date.parse('2026-10-22T12:00:00Z');
const ids=Array.from({length:2358},(_,i)=>String(20+i));
const plan={schema_version:2,chain_id:137,collection_address:COLLECTION,
 mode:'OFFLINE_TRANSACTION_DRAFT_NO_SIGNATURE',metadata_release_locally_staged:true,
 selected_token_ids:['20'],totals:{selected:1,expected_total_transactions:1},proposed_base_uri:'ipfs://bafynewcidxxx/{id}',
 operations:[{kind:'atomic_configure_mint',to:CONFIGURER,target_collection:COLLECTION,token_ids:['20']}]};
const catalog={pending:ids.map(id=>({proposed_token_id:id}))};
const release={status:'LOCAL_IPFS_STAGING_COMPLETE',
 historic_json_preserved_byte_identical:19,
 production_approved:false,chain_modified:false,
 old_base_uri:'ipfs://bafybeih7ucalsv5p2xh3zjrslg6fjgz7y3t4q2fivebci56mz3wex4gwj4/{id}',
 proposed_base_uri:plan.proposed_base_uri,media_cid:'bafynewmediacidxxx'};
const releaseBytes=Buffer.from(JSON.stringify(release));
const chain={
 read_only:true,chain_id:137,contract:COLLECTION,configurer:CONFIGURER,
 created_at:new Date(now-30000).toISOString(),
 existing_checked:19,new_ids_checked:2358,
 plan_sha256:sha(Buffer.from(ids.join(','))),all_proposed_ids_unused:true,
 occupied_new_ids:[],
 existing_consistent:true,
 historic:Array.from({length:19},(_,i)=>({token_id:String(i+1),historical_consistent:true})),
 new_token_states:ids.map(id=>({token_id:id,maxSupply:'0',totalMinted:'0',totalSupply:'0',vacant:true}))
};
const remote={schema:2,status:'TWO_GATEWAY_SAMPLES_VERIFIED',checks_passed:true,
 chain_id:137,collection:COLLECTION,proposed_base_uri:release.proposed_base_uri,
 media_cid:release.media_cid,release_report_sha256:sha(releaseBytes),
 historic_json_exact_match_per_gateway:19,
 independent_gateway_hosts:['gateway.pinata.cloud','w3s.link'],
 distinct_gateway_operators:['pinata','storacha'],
 new_metadata_image_sample_ids:['20','609','1199','1788','2377'],
 total_remote_files_verified:58,verified_at:new Date(now-60000).toISOString()};
const abiSourceBytes=Buffer.from('test ABI source fixture');
const forkProof={
 status:'LOCAL_ATOMIC_FORK_PROOF_PASSED',
 scope:'LOCAL_ANVIL_FORK_ONLY',chain_id:137,
 fork_identity:{implementation:'0x9f36ee33fd56c7d9a78facd3249c580b1ca464a2',fork_block_number:'96000000',code_bytes:45},
 collection:COLLECTION,configurer:CONFIGURER,selector:'0xa64dfa75',
 abi_source_sha256:sha(abiSourceBytes),
 configurer_bytecode_keccak256:'0x'+'a'.repeat(64),
 historic_base_uri_unchanged:true,historic_token_1_unchanged:true,
 public_polygon_transactions:0,
 results:[1,5,10].map((tokens,i)=>({
  tokens,tx_count:1,selector:'0xa64dfa75',
  gas_used:100000+i*50000,gas_estimated:110000+i*50000
 })),
 created_at:new Date(now-30000).toISOString()
};
const valid=()=>({plan,catalog,releaseBytes,localVerified:true,remote,chain,
 enableSigning:true,now,forkProof,abiSourceBytes,historicImagesVerified:true});
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
test('fails closed if mint operations drift from the selected catalog IDs',()=>{
 const mutated=structuredClone(plan);
 mutated.operations[0].token_ids=['21'];
 assert.equal(approved({...valid(),plan:mutated}),false);
 const duplicate=structuredClone(plan);
 duplicate.operations.push({...duplicate.operations[0]});
 duplicate.selected_token_ids.push('20');
 duplicate.totals.expected_total_transactions=2;
 duplicate.totals.selected=2;
 assert.equal(approved({...valid(),plan:duplicate}),false);
});
test('fails closed if remote CID or sample set changes',()=>{
 const bad=structuredClone(remote);bad.media_cid='bafyother';
 assert.equal(approved({...valid(),remote:bad}),false);
 const wrong=structuredClone(remote);wrong.new_metadata_image_sample_ids=['20'];
 assert.equal(approved({...valid(),remote:wrong}),false);
});


test('a later session can plan only untouched IDs after old batches completed',()=>{
 const past=structuredClone(chain);
 for(let i=0;i<10;i++){
   past.new_token_states[i]={...past.new_token_states[i],
     maxSupply:'1',totalMinted:'1',totalSupply:'1',vacant:false};
 }
 past.all_proposed_ids_unused=false;
 past.occupied_new_ids=past.new_token_states.slice(0,10);
 const remainingPlan=structuredClone(plan);
 remainingPlan.selected_token_ids=['30'];
 remainingPlan.operations[0].token_ids=['30'];
 assert.equal(approved({...valid(),plan:remainingPlan,chain:past}),true);
 // The old batch, once occupied, can never be signed again.
 assert.equal(approved({...valid(),chain:past}),false);
});
test('unexpected partial supply configuration blocks later sessions too',()=>{
 const past=structuredClone(chain);
 past.new_token_states[0]={...past.new_token_states[0],
   maxSupply:'1',totalMinted:'0',totalSupply:'0',vacant:false};
 past.all_proposed_ids_unused=false;
 past.occupied_new_ids=[past.new_token_states[0]];
 const remainingPlan=structuredClone(plan);
 remainingPlan.selected_token_ids=['30'];
 remainingPlan.operations[0].token_ids=['30'];
 assert.equal(approved({...valid(),plan:remainingPlan,chain:past}),false);
});

test('different hostnames of the SAME provider never satisfy gateway gate',()=>{
 const bad=structuredClone(remote);
 bad.distinct_gateway_operators=['storacha','storacha'];
 assert.equal(approved({...valid(),remote:bad}),false);
 const legacy=structuredClone(remote);
 legacy.schema=1;
 assert.equal(approved({...valid(),remote:legacy}),false);
});

test('fork proof and exact ABI source are mandatory to request any signature',()=>{
 assert.equal(approved({...valid(),forkProof:null}),false);
 assert.equal(approved({...valid(),abiSourceBytes:Buffer.from('changed ABI')}),false);
 const wrong=structuredClone(forkProof);
 wrong.historic_base_uri_unchanged=false;
 assert.equal(approved({...valid(),forkProof:wrong}),false);
 const old=structuredClone(forkProof);
 old.created_at=new Date(now-8*24*3600000).toISOString();
 assert.equal(approved({...valid(),forkProof:old}),false);
});

test('standalone Anvil proof without original Polygon fork identity cannot enable signatures',()=>{
 const wrong=structuredClone(forkProof);
 delete wrong.fork_identity;
 assert.equal(approved({...valid(),forkProof:wrong}),false);
 const old=structuredClone(forkProof);
 old.fork_identity.fork_block_number='90000000';
 assert.equal(approved({...valid(),forkProof:old}),false);
 const alt=structuredClone(forkProof);
 alt.fork_identity.implementation='0x0000000000000000000000000000000000000000';
 assert.equal(approved({...valid(),forkProof:alt}),false);
});

test('corrupted fork provenance safely refuses signing rather than crashing the console',()=>{
 const bad=structuredClone(forkProof);
 bad.fork_identity.fork_block_number='invalid';
 assert.equal(approved({...valid(),forkProof:bad}),false);
 const missing=structuredClone(forkProof);
 delete missing.fork_identity.fork_block_number;
 assert.equal(approved({...valid(),forkProof:missing}),false);
});

test('all 19 historic IPFS images must be verified before any mainnet mint',()=>{
 assert.equal(approved({...valid(),historicImagesVerified:false}),false);
 assert.equal(approved({...valid(),historicImagesVerified:true}),true);
});


test('Arweave manifest requires complete, recent, two-provider byte checks',()=>{
 const cid='A'.repeat(43);
 const candidate={status:'ARWEAVE_UPLOADED_PENDING_INDEPENDENT_VERIFICATION',
  production_approved:false,chain_modified:false,
  old_base_uri:release.old_base_uri,historical_json_bytes_preserved:19,
  metadata_paths:2377,manifest_id:cid,manifest_sha256:'a'.repeat(64),
  proposed_base_uri:'https://arweave.net/'+cid+'/{id}'};
 const arPlan={...plan,proposed_base_uri:candidate.proposed_base_uri};
 const releaseContent=Buffer.from(JSON.stringify(candidate));
 const certificate={schema:1,status:'ARWEAVE_2_GATEWAY_BYTES_VERIFIED',
  scope:'FULL',release_report_sha256:sha(releaseContent),
  proposed_base_uri:candidate.proposed_base_uri,
  manifest_id:cid,manifest_sha256:candidate.manifest_sha256,
  entire_historic_archive_verified:true,archive_metadata_count:19,
  archive_image_count:19,checked_metadata_paths:2377,
  checked_media_items:2340,total_remote_files_verified:2*(2377+2340),
  gateway_operators:['arweave.net','ar.io Turbo'],
  gateway_hosts:['arweave.net','turbo-gateway.com'],
  checked_at:new Date(now-30000).toISOString()};
 const params={...valid(),plan:arPlan,releaseBytes:releaseContent,remote:certificate,
  arweaveUriFork:{status:'LOCAL_ARWEAVE_BASEURI_FORK_PASSED',collection:COLLECTION,
    chain_id:137,only_local_fork:true,mainnet_transactions:0,
    manifest_id:cid,proposed_base_uri:candidate.proposed_base_uri,
    old_uri_restored_after_snapshot:true,historic_tokens_unchanged:true,
    fork_identity:forkProof.fork_identity,gas_used:50000,
    created_at:new Date(now-30000).toISOString()}};
 assert.equal(approved(params),true);
 assert.equal(approved({...params,remote:{...certificate,scope:'HISTORIC_ALL_PLUS_SAMPLES'}}),false);
 assert.equal(approved({...params,remote:{...certificate,manifest_sha256:'b'.repeat(64)}}),false);
 assert.equal(approved({...params,remote:{...certificate,gateway_hosts:['arweave.net','arweave.net']}}),false);
});
