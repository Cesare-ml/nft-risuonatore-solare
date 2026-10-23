/**
 * Pure off-chain NFT transaction planning functions. No key management.
 * Each ERC-1155 token ID needs its max supply set before a direct owner mint.
 */
export const COLLECTION='0xead98e12d3836562ea39c6a6ca5ef1292359a862';
export const CHAIN_ID=137;
export const CONFIGURER='0x864baa13e01d8f9e26549dc91b458cd15e34eb7c';
export function requireValid(ok,message){if(!ok)throw new Error(message)}
export function group(items,n){
 requireValid(Number.isSafeInteger(n)&&n>=1&&n<=30,'Batch size must be 1..30');
 const result=[];
 for(let i=0;i<items.length;i+=n)result.push(items.slice(i,i+n));
 return result;
}
export function buildMintPlan(snapshot, catalog, {
  batchSize=10, start=0, count=null, recipient=null, release=null
}={}){
 requireValid(snapshot.collection?.contract_address?.toLowerCase()===COLLECTION,'Wrong source contract');
 requireValid(snapshot.items?.length===19,'Historical OpenSea token list changed');
 requireValid(catalog.mode==='DRY_RUN_ONLY' && catalog.target_collection?.contract_address?.toLowerCase()===COLLECTION,
   'Invalid catalog plan');
 requireValid(catalog.pending.length===2358,'Unexpected pending catalog count');
 requireValid(snapshot.items.map(x=>x.token_id).join(',')===Array.from({length:19},(_,i)=>String(i+1)).join(','),
   'Original historical token IDs must be 1 through 19 in the observed snapshot');
 requireValid(Number.isSafeInteger(start)&&start>=0&&start<catalog.pending.length,'Invalid start offset');
 requireValid(count===null||(Number.isSafeInteger(count)&&count>0),'Invalid count');
 const normalizedBatch=Number(batchSize);
 requireValid(Number.isSafeInteger(normalizedBatch)&&normalizedBatch>=1&&normalizedBatch<=30,
   'batchSize must be 1..30');
 if(recipient!==null)requireValid(/^0x[0-9a-f]{40}$/i.test(recipient),'Invalid recipient address');
 const selection=catalog.pending.slice(start,count===null?undefined:start+count);
 requireValid(selection.length>0,'Empty selection');
 const unique=new Set(),existingIDs=new Set(snapshot.items.map(x=>String(x.token_id)));
 for(const item of selection){
   const id=String(item.proposed_token_id);
   requireValid(/^[1-9][0-9]*$/.test(id)&&BigInt(id)>=20n,'Bad proposed token ID '+id);
   requireValid(!unique.has(id)&&!existingIDs.has(id),'Colliding token ID '+id);
   unique.add(id);
 }
 const chunks=group(selection,normalizedBatch);
 const operations=chunks.map(chunk=>({
   kind:'atomic_configure_mint',
   function:'multiConfigure(address,tuple)',
   token_ids:chunk.map(item=>String(item.proposed_token_id)),
   configuration_amounts:chunk.map(()=> '1'),
   mint_amounts:chunk.map(()=> '1'),
   recipient:recipient??null,
   to:CONFIGURER,
   target_collection:COLLECTION,
   expected_sender_role:'contract_owner',
   stage:'AFTER_METADATA_RELEASE_CONFIRMED',
   base_uri_must_remain_unchanged:true,
   warning:'Configures supply and mints selected IDs atomically; never sets baseURI'
 }));

 const isIPFS=!!release &&
   release.status==='LOCAL_IPFS_STAGING_COMPLETE' &&
   release.historic_json_preserved_byte_identical===19 &&
   /^ipfs:\/\/bafy[a-z2-7]+\/\{id\}$/.test(release.proposed_base_uri??'');
 const isArweave=!!release &&
   release.status==='ARWEAVE_UPLOADED_PENDING_INDEPENDENT_VERIFICATION' &&
   release.historical_json_bytes_preserved===19 &&
   release.metadata_paths===2377 &&
   /^https:\/\/arweave\.net\/[a-zA-Z0-9_-]{43}\/\{id\}$/.test(release.proposed_base_uri??'') &&
   release.proposed_base_uri==='https://arweave.net/'+release.manifest_id+'/{id}';
 const validRelease=(isIPFS||isArweave)&&release.production_approved===false&&
   release.chain_modified===false;
 return {
   schema_version:2,mode:'OFFLINE_TRANSACTION_DRAFT_NO_SIGNATURE',
   chain_id:CHAIN_ID,collection_address:COLLECTION,
   recipient:recipient??null,
   preparation_ready_for_live_execution:false,
   metadata_release_locally_staged:validRelease,
   proposed_base_uri:validRelease?release.proposed_base_uri:null,
   current_base_uri_must_equal_proposed_before_mint:true,
   observed_token_ids_preserved:[...existingIDs],
   selected_artwork_ids:selection.map(x=>x.artwork_id),
   selected_token_ids:[...unique],
   totals:{
     selected:selection.length,
     atomic_configure_mint_transactions:chunks.length,
     expected_total_transactions:chunks.length,
     direct_owner_legacy_transactions_avoided:selection.length,
     metadata_update_transactions_not_included:1
   },
   gates:[
     'Confirm control of on-chain owner wallet (public 0x2180747f94c3319162137a0e2ca5b1e8c7efb2ed).',
     'Preserve all 19 original metadata JSON bytes; run nft:ipfs:verify and replicate pinning.',
     'Explicitly approve any setBaseURI operation; historic holders are affected.',
     'Reconcile ALL proposed token IDs onchain with both totalMinted and maxSupply.',
     'Estimate fees per transaction and gas/batch size for ERC1155SeaDropConfigurer.multiConfigure before approving live signing.',
     'Check real Polygon chain ID 137 and exact existing contract before signing.',
     'Do not sign or broadcast directly from this draft file.'
   ],
   operations
 };
}
