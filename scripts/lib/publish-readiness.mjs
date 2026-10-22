/**
 * Pure safety gates for the local NFT operator. Fail-closed: every required
 * report must be present, fresh and tied to the same exact 2,358 token IDs.
 * No network, no signing. Independently unit-testable.
 */
import {createHash} from 'node:crypto';
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
 enableSigning=false,now=Date.now()
}){
 const release=releaseBytes?JSON.parse(releaseBytes.toString('utf8')):null;
 const validIds=(catalog?.pending??[]).map(item=>String(item.proposed_token_id));
 const exactIds=validIds.length===2358&&validIds.every((id,i)=>id===String(i+20));
 const validPlan=!!(plan&&plan.schema_version===2&&plan.chain_id===137&&
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
 const chainVerified=!!(exactIds&&chain&&chain.read_only===true&&
  chain.chain_id===137&&lower(chain.contract)===COLLECTION&&
  lower(chain.configurer)===CONFIGURER&&
  chain.plan_sha256===sha(Buffer.from(validIds.join(',')))&&
  chain.new_ids_checked===2358&&chain.existing_checked===19&&
  chain.new_token_states?.length===2358&&
  chain.new_token_states.every((x,i)=>x.token_id===validIds[i]&&
   x.vacant===true&&x.maxSupply==='0'&&
   x.totalMinted==='0'&&x.totalSupply==='0')&&
  historicValid&&chain.all_proposed_ids_unused===true&&
  chain.existing_consistent===true&&ageValid(chain.created_at,12,now));
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
  remote.status==='TWO_GATEWAY_SAMPLES_VERIFIED'&&
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
  ageValid(remote.verified_at,24,now));
 return {
  valid_offline_atomic_plan:validPlan,
  local_ipfs_bytes_verified:!!localVerified,
  local_release_matches_mint_plan:releaseBound,
  two_public_gateways_verified:remoteVerified,
  entire_id_space_audited:chainVerified,
  explicit_local_signing_opt_in:enableSigning===true
 };
}
