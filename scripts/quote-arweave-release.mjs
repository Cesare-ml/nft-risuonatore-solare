#!/usr/bin/env node
/**
 * LIVE Turbo estimate of Arweave ONE-TIME storage in USD/EUR.
 * No wallet, no payment, no signing and no upload.
 * Uses official @ardrive/turbo-sdk (install separately, not mandatory for
 * ordinary NFT operations). USD/EUR rates are estimates, NOT invoices.
 */
import {readFile,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateInventory} from './lib/arweave-release.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
async function main(){
 let bytes,files,source;
 let inventoryBytes=null;
 try{inventoryBytes=await readFile(resolve(ROOT,'reports/arweave-one-time/inventory.json'))}
 catch(error){if(error.code!=='ENOENT')throw error}
 if(inventoryBytes){
  // Malformed or mismatched inventories must stop: never silently issue a
  // deceptively reassuring rough quote for a corrupt prepared release.
  const inventory=JSON.parse(inventoryBytes.toString('utf8'));
  validateInventory(inventory);
  bytes=inventory.total_media_bytes_to_upload;
  files=inventory.media.length+2377+1;
  source='SHA256 deduplicated Arweave inventory';
 }else{
  const catalog=JSON.parse(await readFile(resolve(ROOT,'reports/staging-mint-plan.json'),'utf8'));
  if(catalog.pending?.length!==2358)throw Error('Run npm run nft:plan first');
  bytes=0;
  for(const item of catalog.pending){
   if(!/^nft-imgs\/[a-zA-Z0-9_#.-]+\.png$/.test(item.image_path))
    throw Error('Unsafe catalog image path');
   const s=await stat(resolve(ROOT,item.image_path));
   bytes+=s.size;
  }
  files=2358+2377+1+19;
  source='Rough: new PNG source bytes only; old media omitted and duplicates not deducted';
 }
 const overheadEstimate=16*1024*1024; // metadata JSON + manifest allowance
 const quotedBytes=bytes+overheadEstimate;
 let TurboFactory;
 try{({TurboFactory}=await import('@ardrive/turbo-sdk'))}
 catch{throw Error('Install quote-only SDK locally: npm install --no-save @ardrive/turbo-sdk');}
 const turbo=TurboFactory.unauthenticated();
 const [usd,eur]=await Promise.all([
  turbo.getFiatEstimateForBytes({byteCount:quotedBytes,currency:'usd'}),
  turbo.getFiatEstimateForBytes({byteCount:quotedBytes,currency:'eur'})
 ]);
 const amount=x=>Number(x?.amount);
 if(!Number.isFinite(amount(usd))||!Number.isFinite(amount(eur)))
  throw Error('Turbo returned invalid quote; do not fund until price is clear');
 console.log(JSON.stringify({
  status:'LIVE_ONE_TIME_STORAGE_ESTIMATE',
  quoted_at:new Date().toISOString(),
  source,known_media_bytes:bytes,metadata_manifest_overhead_allowance_bytes:overheadEstimate,
  total_bytes_quoted:quotedBytes,approx_data_items:files,
  estimated_usd:amount(usd),estimated_eur:amount(eur),
  estimates_not_guaranteed:true,
  per_item_fee_reference_usd:0.00002,
  per_item_fee_reference_total_usd:Number((files*0.00002).toFixed(5)),
  reference_only_not_live_per_item_rate:true,
  top_up_infrastructure_fee_not_included:true,
  check_free_allowance_and_current_checkout_fees:true,
  recurring_subscription_required:false,
  note:'Quote for storage bytes only. Separate per-item processing, possible top-up infrastructure fees and per-wallet lifetime free allowance must be checked live before buying credits. No subscription.',
  chain_transactions:0,uploads:0,payments:0
 },null,2));
}
main().catch(e=>{console.error('ARWEAVE LIVE QUOTE FAILED: '+e.message);process.exitCode=1});
