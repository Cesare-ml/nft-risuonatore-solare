#!/usr/bin/env node
/**
 * Build an exact 2377-file Arweave path manifest; optionally upload it.
 * Every previous metadata item must have a Turbo receipt from OUR inventory.
 * Default: DRY RUN. Real manifest upload requires opt-in USD cap + JWK.
 */
import {readFile,writeFile,rename,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname,join,sep,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildManifest,arweaveBaseUri,ARWEAVE_ID,validateInventory,requireOk} from './lib/arweave-release.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const STAGE=resolve(ROOT,'reports/arweave-one-time');
const hash=data=>createHash('sha256').update(data).digest('hex');
const args=process.argv.slice(2);
let upload=false,consent=false,maxUSD=null;
for(let i=0;i<args.length;i++){
 const key=args[i];
 if(key==='--upload')upload=true;
 else if(key==='--accept-one-time-charge')consent=true;
 else if(key==='--max-usd')maxUSD=Number(args[++i]);
 else throw Error('Unknown option: '+key);
}
async function main(){
 const [invBytes,stageBytes,metaReceiptsBytes]=await Promise.all([
  readFile(join(STAGE,'inventory.json')),
  readFile(join(STAGE,'metadata-stage-report.json')),
  readFile(join(STAGE,'receipts-metadata.json'))
 ]);
 const inv=JSON.parse(invBytes),stage=JSON.parse(stageBytes),ledger=JSON.parse(metaReceiptsBytes);
 validateInventory(inv);
 requireOk(stage.status==='LOCAL_ARWEAVE_METADATA_READY'&&stage.count===2377&&
  stage.inventory_sha256===hash(invBytes)&&stage.files.length===2377,
  'Metadata stage does not match inventory');
 requireOk(ledger.kind==='metadata'&&ledger.status==='ARWEAVE_UPLOAD_RECEIPTS'&&
  ledger.inventory_sha256===hash(invBytes)&&
  ledger.metadata_stage_sha256===hash(stageBytes),
  'Metadata upload receipts do not match staged original metadata');
 const records=[];
 for(const item of stage.files){
  const file=join(STAGE,'metadata',item.filename);
  const contents=await readFile(file);
  requireOk(hash(contents)===item.sha256&&contents.length===item.bytes,
   'Staged metadata changed since upload: '+item.filename);
  const receipt=ledger.records[item.filename];
  requireOk(receipt&&ARWEAVE_ID.test(receipt.id)&&receipt.sha256===item.sha256&&
   receipt.bytes===item.bytes,'Missing authentic Arweave receipt for '+item.filename);
  records.push({filename:item.filename,id:receipt.id});
 }
 requireOk(Object.keys(ledger.records).length===2377,'Unexpected metadata receipt entry');
 const manifest=buildManifest(records);
 const bytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
 const manifestPath=join(STAGE,'manifest.json');
 try{
  const prior=await readFile(manifestPath);
  requireOk(hash(prior)===hash(bytes),'Previously created manifest is DIFFERENT; manual audit required');
 }catch(e){
  if(e.code!=='ENOENT')throw e;
  await writeFile(manifestPath,bytes,{flag:'wx'});
 }
 if(!upload){
  console.log(JSON.stringify({status:'LOCAL_ARWEAVE_MANIFEST_READY',
   output:'reports/arweave-one-time/manifest.json',metadata_paths:2377,
   manifest_sha256:hash(bytes),bytes:bytes.length,
   arweave_uploads:0,chain_transactions:0,
   command:'npm run nft:arweave:manifest -- --upload --accept-one-time-charge --max-usd 1'},null,2));
  return;
 }
 requireOk(consent&&Number.isFinite(maxUSD)&&maxUSD>0&&maxUSD<=100,
  'Manifest publishing requires --accept-one-time-charge and --max-usd');
 const wallet=process.env.ARWEAVE_JWK_PATH;
 requireOk(wallet&&isAbsolute(wallet)&&!resolve(wallet).startsWith(ROOT+sep),
  'Arweave JWK wallet file must be outside this repository');
 let JWK;
 try{JWK=JSON.parse(await readFile(wallet,'utf8'))}
 catch{throw Error('Could not read external Arweave JWK')}
 requireOk(JWK?.kty==='RSA'&&JWK?.d&&JWK?.n,'Invalid Arweave JWK');
 let TurboFactory;
 try{({TurboFactory}=await import('@ardrive/turbo-sdk'))}
 catch{throw Error('Install Turbo SDK locally: npm install --no-save @ardrive/turbo-sdk')}
 const turbo=TurboFactory.authenticated({privateKey:JWK,token:'arweave'});
 const price=Number((await turbo.getFiatEstimateForBytes({byteCount:bytes.length,currency:'usd'})).amount);
 requireOk(Number.isFinite(price)&&price>=0&&price<=maxUSD,'Manifest upload quote exceeds budget');
 const result=await turbo.upload({
  data:bytes,
  dataItemOpts:{tags:[{name:'Content-Type',value:'application/x.arweave-manifest+json'}]}
 });
 requireOk(ARWEAVE_ID.test(result?.id),'Turbo returned an invalid Arweave manifest ID');
 const report={
  schema:1,status:'ARWEAVE_UPLOADED_PENDING_INDEPENDENT_VERIFICATION',
  created_at:new Date().toISOString(),
  collection:inv.collection,old_base_uri:inv.old_base_uri,
  proposed_base_uri:arweaveBaseUri(result.id),
  manifest_id:result.id,manifest_sha256:hash(bytes),
  inventory_sha256:hash(invBytes),metadata_stage_sha256:hash(stageBytes),
  metadata_receipts_sha256:hash(metaReceiptsBytes),
  historical_json_bytes_preserved:19,metadata_paths:2377,
  monthly_fees_required:false,production_approved:false,chain_modified:false,
  warning:'A valid Turbo upload ID does not by itself prove permanent inclusion, all file bytes on independent gateways, IPFS availability, or authorization for setBaseURI.'
 };
 const target=join(STAGE,'release-report.json');
 try{
  const old=JSON.parse(await readFile(target,'utf8'));
  if(old.manifest_id!==result.id)throw Error('A different release was already uploaded; do not overwrite proof');
 }catch(e){if(e.code!=='ENOENT')throw e}
 const tmp=target+'.tmp';
 await writeFile(tmp,JSON.stringify(report,null,2)+'\n','utf8');
 await rename(tmp,target);
 console.log(JSON.stringify({status:report.status,proposed_base_uri:report.proposed_base_uri,
  public_polygon_transactions:0,monthly_fees_required:false,quoted_manifest_usd:price},null,2));
}
main().catch(e=>{console.error('ARWEAVE MANIFEST STOPPED: '+e.message);process.exitCode=1});
