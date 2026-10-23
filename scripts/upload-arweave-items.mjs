#!/usr/bin/env node
/**
 * One-time Arweave Turbo upload: EXPLICIT opt-in, single-file receipts,
 * fail-closed SHA256, USD budget, no top-ups, no blockchain NFT operations.
 * Wallet JWK file must be outside this repository.
 *
 * Dry run: npm run nft:arweave:upload -- --kind media
 * Real upload: --kind media --upload --accept-one-time-charge
 *              --max-usd 1 --limit 1
 */
import {readFile,writeFile,rename,stat,open,rm} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname,join,sep,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateInventory,ARWEAVE_ID,SHA256,requireOk} from './lib/arweave-release.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const STAGE=resolve(ROOT,'reports/arweave-one-time');
const args=process.argv.slice(2);
let kind=null,upload=false,consent=false,maxUSD=null,limit=1;
for(let i=0;i<args.length;i++){
 const flag=args[i];
 if(flag==='--kind')kind=args[++i];
 else if(flag==='--limit')limit=Number(args[++i]);
 else if(flag==='--max-usd')maxUSD=Number(args[++i]);
 else if(flag==='--upload')upload=true;
 else if(flag==='--accept-one-time-charge')consent=true;
 else throw Error('Unexpected argument: '+flag);
}
requireOk(['media','metadata'].includes(kind),'Use --kind media or --kind metadata');
requireOk(Number.isInteger(limit)&&limit>=1&&limit<=200,'--limit must be 1..200');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fileHash(path){
 const h=createHash('sha256');
 for await(const chunk of createReadStream(path))h.update(chunk);
 return h.digest('hex');
}
async function atomicWrite(path,obj){
 const tmp=path+'.tmp';
 await writeFile(tmp,JSON.stringify(obj,null,2)+'\n',{flag:'w'});
 await rename(tmp,path);
}
async function main(){
 const inventoryBytes=await readFile(join(STAGE,'inventory.json'));
 const inventory=JSON.parse(inventoryBytes);
 validateInventory(inventory);
 const inventorySha=hash(inventoryBytes);
 const stageReportBytes=kind==='metadata'?await readFile(join(STAGE,'metadata-stage-report.json')):null;
 let entries;
 if(kind==='media'){
  entries=inventory.media.map(x=>({
    key:x.sha256,path:resolve(ROOT,x.path),sha256:x.sha256,bytes:x.bytes,
    content_type:x.content_type
  }));
 }else{
  const report=JSON.parse(stageReportBytes);
  requireOk(report.status==='LOCAL_ARWEAVE_METADATA_READY'&&
   report.inventory_sha256===inventorySha&&
   report.count===2377&&report.files.length===2377,'Metadata staging report invalid');
  entries=report.files.map(x=>({
   key:x.filename,path:join(STAGE,'metadata',x.filename),
   sha256:x.sha256,bytes:x.bytes,content_type:'application/json'
  }));
 }
 const receiptPath=join(STAGE,'receipts-'+kind+'.json');
 let old=null;
 try{old=JSON.parse(await readFile(receiptPath,'utf8'))}
 catch(e){if(e.code!=='ENOENT')throw e}
 const stageSha=stageReportBytes?hash(stageReportBytes):null;
 if(old)requireOk(old.status==='ARWEAVE_UPLOAD_RECEIPTS'&&
   old.kind===kind&&old.inventory_sha256===inventorySha&&
   old.metadata_stage_sha256===stageSha&&old.records&&
   typeof old.records==='object','Prior receipts mismatch; do not overwrite');
 const ledger=old??{
  status:'ARWEAVE_UPLOAD_RECEIPTS',kind,
  inventory_sha256:inventorySha,metadata_stage_sha256:stageSha,
  records:{},inflight:null,created_at:new Date().toISOString()
 };
 // A crash can occur after Turbo accepted an item but before a local receipt
 // was written. Never upload that same SHA again automatically.
 requireOk(!ledger.inflight,
  'UNRESOLVED UPLOAD: '+JSON.stringify(ledger.inflight)+
  '. Check Turbo history and reconcile the exact item ID before trying again.');
 const pending=entries.filter(x=>!ledger.records[x.key]);
 for(const [key,value] of Object.entries(ledger.records)){
   requireOk(ARWEAVE_ID.test(value.id)&&SHA256.test(value.sha256)&&
    entries.some(e=>e.key===key&&e.sha256===value.sha256&&e.bytes===value.bytes),
    'A saved receipt differs from its original file: '+key);
 }
 if(!upload){
  console.log(JSON.stringify({mode:'DRY_RUN_NO_UPLOAD',kind,total:entries.length,
   already_uploaded:Object.keys(ledger.records).length,pending:pending.length,
   first_next:pending[0]?.key,command:'npm run nft:arweave:upload -- --kind '+kind+
    ' --upload --accept-one-time-charge --max-usd 1 --limit 1',
   note:'This does not fund a wallet or upload anything. Real upload needs ARWEAVE_JWK_PATH outside the repo.'},null,2));
  return;
 }
 requireOk(consent&&Number.isFinite(maxUSD)&&maxUSD>0&&maxUSD<=5000,
  'Real uploads require --accept-one-time-charge AND --max-usd positive');
 const walletFile=process.env.ARWEAVE_JWK_PATH;
 requireOk(walletFile&&isAbsolute(walletFile)&&
  !resolve(walletFile).startsWith(ROOT+sep),
  'Set ARWEAVE_JWK_PATH to an ABSOLUTE Arweave wallet JWK outside the repo. Never commit private keys.');
 let JWK;
 try{JWK=JSON.parse(await readFile(walletFile,'utf8'))}
 catch{throw Error('Unable to read Arweave wallet JWK from your external path')}
 requireOk(JWK?.kty==='RSA'&&JWK?.d&&JWK?.n,'Invalid Arweave signing wallet JWK');
 let TurboFactory;
 try{({TurboFactory}=await import('@ardrive/turbo-sdk'))}
 catch{throw Error('Install SDK locally: npm install --no-save @ardrive/turbo-sdk');}
 const turbo=TurboFactory.authenticated({privateKey:JWK,token:'arweave'});
 // Process lock stops two local upload processes from spending against the
 // same inventory simultaneously. A force-killed process leaves the lock so
 // an operator must inspect receipts before another paid attempt.
 const lock=receiptPath+'.lock';
 let handle;
 try{handle=await open(lock,'wx')}
 catch(e){if(e.code==='EEXIST')throw Error('Existing uploader lock: '+lock+
  '. Check for a previous interrupted upload before retrying.');throw e}
 await handle.writeFile(JSON.stringify({pid:process.pid,kind,started_at:new Date().toISOString()})+'\n');
 await handle.close();
 // The pending list was built BEFORE acquiring this lock. Re-read the
 // receipt file now to prevent a second process from acting on stale state.
 // This is particularly important if another uploader just finished a batch.
 let latest=null;
 try{latest=JSON.parse(await readFile(receiptPath,'utf8'))}
 catch(e){if(e.code!=='ENOENT')throw e}
 if(JSON.stringify(latest)!==JSON.stringify(old)){
   await rm(lock,{force:true});
   throw Error('Upload ledger changed before lock acquisition: rerun to refresh receipts. No files uploaded.');
 }
 let authorizedSpendEstimate=0,completed=0;
 try{
 for(const x of pending.slice(0,limit)){
  const current=await stat(x.path);
  requireOk(current.isFile()&&current.size===x.bytes&&
   (await fileHash(x.path))===x.sha256,'Local file changed since inventory: '+x.key);
  const quote=await turbo.getFiatEstimateForBytes({byteCount:x.bytes,currency:'usd'});
  const price=Number(quote.amount);
  requireOk(Number.isFinite(price)&&price>=0&&authorizedSpendEstimate+price<=maxUSD,
   'LIVE estimate exceeds --max-usd budget. Nothing further uploaded.');
  // No token top-up is allowed. Turbo requires prepaid credits or a free
  // allowance in the selected wallet; payment errors halt immediately.
  // Durable journal BEFORE external charge. An ambiguous network failure
  // leaves this entry in place and blocks further automatic uploads.
  ledger.inflight={key:x.key,sha256:x.sha256,bytes:x.bytes,
   quote_usd:price,started_at:new Date().toISOString()};
  await atomicWrite(receiptPath,ledger);
  console.error('Uploading confirmed '+kind+' '+(completed+1)+
    ', '+x.bytes+' bytes, quoted USD '+price.toFixed(6));
  const result=await turbo.uploadFile({
   fileStreamFactory:()=>createReadStream(x.path),
   fileSizeFactory:()=>x.bytes,
   dataItemOpts:{tags:[{name:'Content-Type',value:x.content_type}]}
  });
  requireOk(ARWEAVE_ID.test(result?.id),'Turbo did not return a valid permanent data-item ID');
  ledger.records[x.key]={id:result.id,sha256:x.sha256,bytes:x.bytes,
   content_type:x.content_type,uploaded_at:new Date().toISOString(),
   quote_usd:price,upload_service:'ArDrive Turbo / Arweave'};
  ledger.inflight=null;
  await atomicWrite(receiptPath,ledger);
  completed++;authorizedSpendEstimate+=price;
 }
 console.log(JSON.stringify({
  status:'ARWEAVE_PARTIAL_UPLOADS_RECORDED',kind,completed_this_run:completed,
  completed_total:Object.keys(ledger.records).length,
  remaining:entries.length-Object.keys(ledger.records).length,
  quoted_usd_this_run:authorizedSpendEstimate,max_usd_for_this_run:maxUSD,
  subscription_required:false,chain_transactions:0,
  warning:'Actual charges can differ from a fiat estimate. Examine each receipt and verify gateway bytes before using any Arweave CID.'},null,2));
 } finally {
  // If the process exits unexpectedly, the lock remains for manual review.
  // Any durable inflight entry is preserved, even though the lock is removed.
  await rm(lock,{force:true});
 }
}
main().catch(e=>{console.error('ARWEAVE UPLOAD STOPPED: '+e.message);process.exitCode=1});
