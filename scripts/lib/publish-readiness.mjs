/**
 * Pure safety gates for the local NFT operator. Fail-closed: every required
 * report must be present, fresh and tied to the same exact 2,358 token IDs.
 * No network, no signing. Independently unit-testable.
 */
import {createHash} from 'node:crypto';
import {ORIGINAL_IMPLEMENTATION,HISTORIC_BLOCK_FLOOR} from './fork-provenance.mjs';
export const COLLECTION='0xead98e12d3836562ea39c6a6ca5ef1292359a862';
export const CONFIGURER='0x864baa13e01d8f9e26549dc91b458cd15e34eb7c';
export const sha=b=>createHash('sha256').update(b).digest('hex');
const lower=s=>typeof s==='string'?s.toLowerCase():null;
const ageValid=(date,hours,now)=>{
 const t=Date.parse(date);
 return Number.isFinite(t)&&now>=t&&now-t<=hours*3600000;
};
export function evaluateReadiness({
 plan,catalog,releaseBytes,localVerified=false,remote=null,chain=null,
 enableSigning=false,now=Date.now(),forkProof=null,abiSourceBytes=null
}){
 const release=releaseBytes?JSON.parse(releaseBytes.toString('utf8')):null;
 const validIds=(catalog?.pending??[]).map(item=>String(item.proposed_token_id));
 const exactIds=validIds.length===2358&&validIds.every((id,i)=>id===String(i+20));
 const flattenedIds=(plan?.operations??[]).flatMap(op=>
  Array.isArray(op.token_ids)?op.token_ids.map(String):[]);
 const planTokens=(plan?.selected_token_ids??[]).map(String);
 const planIdsMatch=planTokens.length>0&&
  new Set(flattenedIds).size===flattenedIds.length&&
  flattenedIds.length===planTokens.length&&
  flattenedIds.every((id,i)=>id===planTokens[i])&&
  planTokens.every(id=>validIds.includes(id))&&
  plan?.totals?.selected===planTokens.length&&
  plan?.totals?.expected_total_transactions===plan.operations.length;
 const validPlan=!!(plan&&planIdsMatch&&plan.schema_version===2&&plan.chain_id===137&&
  lower(plan.collection_address)===COLLECTION&&
  plan.mode==='OFFLINE_TRANSACTION_DRAFT_NO_SIGNATURE'&&
  Array.isArray(plan.operations)&&plan.operations.length>0&&
  Array.isArray(plan.selected_token_ids)&&plan.selected_token_ids.length>0&&
  plan.operations.every(o=>
   o.kind==='atomic_configure_mint'&&lower(o.to)===CONFIGURER&&
   lower(o.target_collection)===COLLECTION&&
   Array.isArray(o.token_ids)&&o.token_ids.length>0&&o.token_ids.length<=30)&&
  plan.selected_token_ids.every(id=>validIds.includes(String(id))));
 const historicValid=chain?.historic?.length===19&&chain.historic.every((row,i)=>
  row.token_id===String(i+1)&&row.historical_consistent===true);
 // After earlier batches have been minted, those IDs are occupied forever.
 // Only the IDs selected in the CURRENT plan must be vacant. Other planned
 // IDs may be fully minted (max=1, minted=1, supply=1), but partial or
 // unexpected states fail closed. Ownership/provenance of those earlier mints
 // must be reconciled separately; this gate never certifies who received them.
 const selected=new Set(planTokens);
 const classified=(chain?.new_token_states??[]).map((row,i)=>{
  const vacant=row.token_id===validIds[i]&&row.vacant===true&&
   row.maxSupply==='0'&&row.totalMinted==='0'&&row.totalSupply==='0';
  const fullyMinted=row.token_id===validIds[i]&&row.vacant===false&&
   row.maxSupply==='1'&&row.totalMinted==='1'&&row.totalSupply==='1';
  return {vacant,fullyMinted,selected:selected.has(row.token_id)};
 });
 const validProgress=classified.length===2358&&classified.every(x=>
  x.selected?x.vacant:(x.vacant||x.fullyMinted));
 const occupiedCount=classified.filter(x=>x.fullyMinted).length;
 const occupancyMatches=chain?.occupied_new_ids?.length===occupiedCount&&
   chain?.all_proposed_ids_unused===(occupiedCount===0);
 const chainVerified=!!(validProgress&&occupancyMatches&&exactIds&&chain&&chain.read_only===true&&
  chain.chain_id===137&&lower(chain.contract)===COLLECTION&&
  lower(chain.configurer)===CONFIGURER&&
  chain.plan_sha256===sha(Buffer.from(validIds.join(',')))&&
  chain.new_ids_checked===2358&&chain.existing_checked===19&&
  chain.new_token_states?.length===2358&&
  historicValid&&
  chain.existing_consistent===true&&ageValid(chain.created_at,12,now));
 const rawForkBlock=forkProof?.fork_identity?.fork_block_number;
 const forkBlockFormat=typeof rawForkBlock==='string'&&/^[0-9]+$/.test(rawForkBlock);
 const forkBlockIsRecentEnough=forkBlockFormat&&BigInt(rawForkBlock)>=HISTORIC_BLOCK_FLOOR;
 const batches=[1,5,10];
 const forkVerified=!!(forkProof&&abiSourceBytes&&
  forkProof.status==='LOCAL_ATOMIC_FORK_PROOF_PASSED'&&
  forkProof.scope==='LOCAL_ANVIL_FORK_ONLY'&&
  forkProof.chain_id===137&&
  forkProof.fork_identity?.implementation===ORIGINAL_IMPLEMENTATION&&
  forkBlockIsRecentEnough&&
  forkProof.fork_identity?.code_bytes===45&&
  lower(forkProof.collection)===COLLECTION&&
  lower(forkProof.configurer)===CONFIGURER&&
  forkProof.selector==='0xa64dfa75'&&
  forkProof.abi_source_sha256===sha(abiSourceBytes)&&
  forkProof.historic_base_uri_unchanged===true&&
  forkProof.historic_token_1_unchanged===true&&
  forkProof.public_polygon_transactions===0&&
  /^0x[a-fA-F0-9]{64}$/.test(forkProof.configurer_bytecode_keccak256??'')&&
  forkProof.results?.length===3&&
  forkProof.results.every((r,i)=>r.tokens===batches[i]&&
    r.tx_count===1&&r.selector==='0xa64dfa75'&&
    Number.isSafeInteger(r.gas_used)&&r.gas_used>0&&
    Number.isSafeInteger(r.gas_estimated)&&r.gas_estimated>=r.gas_used)&&
  ageValid(forkProof.created_at,168,now));
 const approvedOriginalCID='ipfs://bafybeih7ucalsv5p2xh3zjrslg6fjgz7y3t4q2fivebci56mz3wex4gwj4/{id}';
 const releaseBound=!!(validPlan&&localVerified&&release&&releaseBytes&&
  release.status==='LOCAL_IPFS_STAGING_COMPLETE'&&
  release.production_approved===false&&release.chain_modified===false&&
  release.old_base_uri===approvedOriginalCID&&
  plan.metadata_release_locally_staged===true&&
  plan.proposed_base_uri===release.proposed_base_uri&&
  /^ipfs:\/\/bafy[a-z2-7]+\/\{id\}$/.test(plan.proposed_base_uri));
 const expectedSample=[20,609,1199,1788,2377].map(String);
 const remoteVerified=!!(releaseBound&&remote&&
  remote.schema===2&&remote.status==='TWO_GATEWAY_SAMPLES_VERIFIED'&&
  remote.checks_passed===true&&remote.chain_id===137&&
  lower(remote.collection)===COLLECTION&&
  remote.proposed_base_uri===release.proposed_base_uri&&
  remote.media_cid===release.media_cid&&
  remote.release_report_sha256===sha(releaseBytes)&&
  remote.historic_json_exact_match_per_gateway===19&&
  remote.new_metadata_image_sample_ids?.join(',')===expectedSample.join(',')&&
  remote.total_remote_files_verified>=58&&
  remote.independent_gateway_hosts?.length>=2&&
  new Set(remote.independent_gateway_hosts).size>=2&&
  remote.distinct_gateway_operators?.length===remote.independent_gateway_hosts.length&&
  new Set(remote.distinct_gateway_operators).size>=2&&
  new Set(remote.distinct_gateway_operators).size===remote.distinct_gateway_operators.length&&
  ageValid(remote.verified_at,24,now));
 return {
  valid_offline_atomic_plan:validPlan,
  atomic_fork_proof_verified:forkVerified,
  local_ipfs_bytes_verified:!!localVerified,
  local_release_matches_mint_plan:releaseBound,
  two_public_gateways_verified:remoteVerified,
  entire_id_space_audited:chainVerified,
  explicit_local_signing_opt_in:enableSigning===true
 };
}
