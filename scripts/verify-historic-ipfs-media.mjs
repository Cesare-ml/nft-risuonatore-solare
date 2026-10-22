#!/usr/bin/env node
/**
 * Historical NFT image preservation: fetch 19 IMAGE bytes through local Kubo.
 * No transaction, wallet, metadata mutation, HTTP gateway or GitHub Actions.
 * Supply --verify-only for fully offline backup integrity verification.
 */
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {historicImageToIpfsPath} from './lib/historic-media.mjs';
import {readHistoricArchive,historicalId64} from './lib/historic-archive.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const DIR=resolve(ROOT,'reports/solar-release-staging/historic-originals');
const REPORT=join(DIR,'media-report.json');
const OUT=join(DIR,'images');
const PLAN=resolve(ROOT,'reports/staging-mint-plan.json');
const VERIFY_ONLY=process.argv.includes('--verify-only');
if(process.argv.slice(2).some(x=>x!=='--verify-only'))
 throw Error('Only --verify-only is accepted');
const sha=x=>createHash('sha256').update(x).digest('hex');
const limit=25*1024*1024;
function readKubo(path){
 return execFileSync('ipfs',['cat',path],{
  encoding:'buffer',maxBuffer:limit+4096,timeout:300000,windowsHide:true,
  stdio:['ignore','pipe','pipe']
 });
}
async function run(){
 const plan=JSON.parse(await readFile(PLAN,'utf8'));
 if(plan.mode!=='DRY_RUN_ONLY'||plan.existing_token_mapping?.length!==19)
  throw Error('Incomplete original token plan');
 const originals=await readHistoricArchive(DIR,plan.existing_token_mapping);
 const manifestBytes=await readFile(join(DIR,'manifest.json'));
 const manifestSHA=sha(manifestBytes);
 await mkdir(OUT,{recursive:true});
 const already=VERIFY_ONLY?JSON.parse(await readFile(REPORT,'utf8')):null;
 if(!VERIFY_ONLY)await rm(REPORT,{force:true});
 const records={};
 for(const item of plan.existing_token_mapping){
  const id=String(item.token_id);
  const hex=historicalId64(id);
  const path=historicImageToIpfsPath(originals[hex].archive.image);
  const local=join(OUT,hex+'.bin');
  let raw=null;
  try{raw=await readFile(local)}catch(e){if(e.code!=='ENOENT')throw e}
  if(!VERIFY_ONLY){
   const fromKubo=readKubo(path);
   if(fromKubo.length<8||fromKubo.length>limit)
     throw Error('Historic image file unexpectedly small/large: #'+id);
   if(raw!==null&&sha(raw)!==sha(fromKubo))
     throw Error('Historical cached image does not match Kubo CID path: #'+id);
   if(raw===null){
    const tmp=local+'.tmp';
    await writeFile(tmp,fromKubo);
    await rename(tmp,local);
   }
   raw=fromKubo;
  }
  if(!raw||raw.length<8||raw.length>limit)
   throw Error('Missing historical image backup: #'+id);
  const entry={token_id:id,ipfs_path:path,image_sha256:sha(raw),bytes:raw.length,
   archive_file:hex+'.bin'};
  if(VERIFY_ONLY){
    const old=already?.records?.[hex];
    if(!old||JSON.stringify(entry)!==JSON.stringify(old))
     throw Error('Old image report differs from backup: #'+id);
  }
  records[hex]=entry;
  console.error('Historic NFT image checked: '+id+'/19');
 }
 if(VERIFY_ONLY){
  if(already.status!=='HISTORIC_19_IPFS_MEDIA_VERIFIED'||
    already.historic_manifest_sha256!==manifestSHA||
    Object.keys(already.records??{}).length!==19)
   throw Error('Historical image report no longer matches the original Kubo archive');
  console.log(JSON.stringify({status:'HISTORIC_MEDIA_OFFLINE_VERIFIED',
   media_count:19,manifest_sha256:manifestSHA,blockchain_transactions:0},null,2));
  return;
 }
 const result={schema:1,status:'HISTORIC_19_IPFS_MEDIA_VERIFIED',
  created_at:new Date().toISOString(),historic_manifest_sha256:manifestSHA,
  original_nft_count:19,records,read_only:true,blockchain_transactions:0,
  caveat:'IPFS content fetched with local Kubo at check time; independent pinning must be confirmed separately.'
 };
 const tmp=REPORT+'.tmp';
 await writeFile(tmp,JSON.stringify(result,null,2)+'\n','utf8');
 await rename(tmp,REPORT);
 console.log(JSON.stringify({status:result.status,media_count:19,
  report:'reports/solar-release-staging/historic-originals/media-report.json',
  blockchain_transactions:0},null,2));
}
run().catch(e=>{console.error('HISTORIC IMAGE CHECK STOPPED: '+e.message);process.exitCode=1});
