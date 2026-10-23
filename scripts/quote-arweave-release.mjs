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
 try{
  const inventory=JSON.parse(await readFile(resolve(ROOT,'reports/arweave-one-time/inventory.json'),'utf8'));
  validateInventory(inventory);
  bytes=inventory.total_media_bytes_to_upload;
  files=inventory.media.length+2377+1;
  source='SHA256 deduplicated Arweave inventory';
 }catch(error){
  const catalog=JSON.parse(await readFile(resolve(ROOT,'reports/staging-mint-plan.json'),'utf8'));
  if(catalog.pending?.length!==2358)throw Error('Run npm run nft:plan first');
  bytes=0;
  for(const item of catalog.pending){
   if(!item.image_path.startsWith('nft-imgs/'))throw Error('Unsafe catalog path');
   const s=await stat(resolve(ROOT,item.image_path));
   bytes+=s.size;
  }
  files=2358+2377+1+19;
  source='New PNG source files only; 19 old images omitted and duplicate media not deducted';
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
  estimates_not_guaranteed:true,extra_small_file_fees_possible:true,
  recurring_subscription_required:false,
  note:'Pricing may change before upload. Exact per-item cost is checked before each manual upload. Neither an invoice nor a guarantee of permanent access.',
  chain_transactions:0,uploads:0,payments:0
 },null,2));
}
main().catch(e=>{console.error('ARWEAVE LIVE QUOTE FAILED: '+e.message);process.exitCode=1});
