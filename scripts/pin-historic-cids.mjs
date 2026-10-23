#!/usr/bin/env node
/**
 * Self-pin exact original IPFS CIDs on own Kubo: NO monthly pinning service.
 * Default read-only preview. Explicit --pin pins on local Kubo, without
 * blockchain transactions or wallet keys.
 */
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readHistoricArchive} from './lib/historic-archive.mjs';
import {historicImageToIpfsPath} from './lib/historic-media.mjs';
import {HISTORIC_CID,requireOk} from './lib/arweave-release.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const HIST=resolve(ROOT,'reports/solar-release-staging/historic-originals');
const APPROVED=process.argv.includes('--pin');
requireOk(process.argv.slice(2).every(x=>x==='--pin'),'Usage: npm run nft:ipfs:pin-originals [-- --pin]');
function ipfs(args,timeout=120000){
 return execFileSync('ipfs',args,{
  encoding:'utf8',timeout,maxBuffer:512*1024,windowsHide:true
 }).trim();
}
async function main(){
 const catalog=JSON.parse(await readFile(resolve(ROOT,'reports/staging-mint-plan.json'),'utf8'));
 const raw=await readHistoricArchive(HIST,catalog.existing_token_mapping);
 const targets=new Set([HISTORIC_CID]);
 for(const item of Object.values(raw)){
  const path=historicImageToIpfsPath(item.archive.image);
  targets.add(path.split('/')[0]);
 }
 const cids=[...targets];
 if(!APPROVED){
  console.log(JSON.stringify({status:'IPFS_SELF_PIN_PREVIEW',
   historical_json_count:19,distinct_cids:cids.length,cids,
   cost_subscription_eur_per_month:0,
   command:'npm run nft:ipfs:pin-originals -- --pin',
   caveat:'Local Kubo must be accessible to peers to provide data. A pin on a powered-off PC is not reliable worldwide availability.',
   onchain_operations:0,ipfs_pins_created:0},null,2));
  return;
 }
 const version=ipfs(['version'],10000);
 let done=0;
 for(const cid of cids){
  ipfs(['pin','add','-r',cid],600000);
  const receipt=ipfs(['pin','ls',cid],30000);
  if(!receipt.toLowerCase().includes('recursive'))
   throw Error('No recursive pin confirmation from Kubo for CID '+cid);
  done++;
  console.error('Self-pin complete '+done+'/'+cids.length);
 }
 const report={status:'LOCAL_HISTORICAL_IPFS_PINS_ACTIVE',
  checked_at:new Date().toISOString(),original_metadata_cid:HISTORIC_CID,
  image_cid_count:cids.length-1,all_cids:cids,verified_recursive_pins:cids.length,
  local_node_version:version,monthly_provider_contract:false,
  caveat:'Local pin confirmation cannot guarantee peer connectivity, uptime or redundancy.',
  chain_transactions:0};
 await mkdir(HIST,{recursive:true});
 await writeFile(join(HIST,'kubo-pin-report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,pinned_cids:cids.length,
   chain_transactions:0,monthly_subscription_required:false},null,2));
}
main().catch(e=>{console.error('HISTORIC CID PINNING FAILED: '+e.message);process.exitCode=1});
