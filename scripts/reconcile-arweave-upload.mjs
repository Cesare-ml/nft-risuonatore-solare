#!/usr/bin/env node
/**
 * Reconcile ONE ambiguous Turbo upload with an exact data item ID supplied
 * by the operator. Two independent gateway reads must match the ORIGINAL
 * source SHA256 before removing inflight. No wallet, upload or payment.
 */
import {readFile,writeFile,rename,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ARWEAVE_ID,validateInventory,requireOk} from './lib/arweave-release.mjs';
import {fetchVerifiedArweaveBytes} from './lib/arweave-gateway.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const STAGE=resolve(ROOT,'reports/arweave-one-time');
const sha=b=>createHash('sha256').update(b).digest('hex');
let kind=null,transactionId=null;
for(let i=2;i<process.argv.length;i++){
 const f=process.argv[i];
 if(f==='--kind')kind=process.argv[++i];
 else if(f==='--id')transactionId=process.argv[++i];
 else throw Error('Only --kind media|metadata and --id CONFIRMED_ARWEAVE_ID are supported');
}
requireOk(['media','metadata'].includes(kind)&&ARWEAVE_ID.test(transactionId??''),
 'Supply valid upload kind and confirmed 43-character Arweave transaction ID');
async function main(){
 const invBytes=await readFile(join(STAGE,'inventory.json'));
 const inv=JSON.parse(invBytes);validateInventory(inv);
 const ledgerPath=join(STAGE,'receipts-'+kind+'.json');
 const ledger=JSON.parse(await readFile(ledgerPath,'utf8'));
 const inflight=ledger.inflight;
 requireOk(ledger.kind===kind&&ledger.status==='ARWEAVE_UPLOAD_RECEIPTS'&&
   ledger.inventory_sha256===sha(invBytes)&&inflight?.key&&!ledger.records[inflight.key],
   'No unresolved paid upload for this inventory');
 let expected,localPath,stageHash=null;
 if(kind==='media'){
  const media=inv.media.find(x=>x.sha256===inflight.key);
  requireOk(!!media,'The in-flight image does not belong to inventory');
  expected=media;localPath=resolve(ROOT,media.path);
 }else{
  const stageBytes=await readFile(join(STAGE,'metadata-stage-report.json'));
  const stage=JSON.parse(stageBytes);
  stageHash=sha(stageBytes);
  requireOk(ledger.metadata_stage_sha256===stageHash&&stage.count===2377,
   'Staged metadata changed while upload was interrupted');
  const meta=stage.files.find(x=>x.filename===inflight.key);
  requireOk(!!meta,'The in-flight metadata file does not belong to inventory');
  expected=meta;localPath=join(STAGE,'metadata',meta.filename);
 }
 requireOk(inflight.sha256===expected.sha256&&inflight.bytes===expected.bytes,
  'In-flight hash/size differs from inventory');
 const local=await readFile(localPath);
 requireOk(local.length===expected.bytes&&sha(local)===expected.sha256,
  'Local source changed since Turbo upload began');
 for(const host of ['https://arweave.net','https://turbo-gateway.com']){
  const bytes=await fetchVerifiedArweaveBytes(host+'/'+transactionId,
   Math.min(expected.bytes+1024,100*1024*1024));
  requireOk(bytes.length===expected.bytes&&sha(bytes)===expected.sha256,
   'Remote Arweave item differs on '+host+'. Do not reconcile.');
 }
 ledger.records[inflight.key]={
  id:transactionId,sha256:expected.sha256,bytes:expected.bytes,
  content_type:kind==='media'?expected.content_type:'application/json',
  uploaded_at:inflight.started_at,quote_usd:inflight.quote_usd,
  upload_service:'ArDrive Turbo / Arweave',
  reconciled_at:new Date().toISOString(),
  reconciliation:'Two gateway exact content SHA256 and original local bytes'
 };
 ledger.inflight=null;
 const tmp=ledgerPath+'.tmp';
 await writeFile(tmp,JSON.stringify(ledger,null,2)+'\n');
 await rename(tmp,ledgerPath);
 console.log(JSON.stringify({status:'ARWEAVE_AMBIGUOUS_UPLOAD_RECONCILED',
  kind,transaction_id:transactionId,source_sha256:expected.sha256,
  receipts_total:Object.keys(ledger.records).length,payments:0,uploads:0},null,2));
}
main().catch(e=>{console.error('ARWEAVE RECONCILIATION STOPPED: '+e.message);process.exitCode=1});
