#!/usr/bin/env node
/**
 * Compose all 2377 Arweave metadata files OFFLINE, only once every unique
 * image has an Arweave upload receipt. The 19 original JSON files are copied
 * byte-for-byte from authenticated Kubo archives. No chain operations.
 */
import {readFile,writeFile,mkdir,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readHistoricArchive,historicalId64} from './lib/historic-archive.mjs';
import {validateInventory,ARWEAVE_ID,HEX_ID,newMetadata,cleanHtml,requireOk} from './lib/arweave-release.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const STAGE=resolve(ROOT,'reports/arweave-one-time');
const HIST=resolve(ROOT,'reports/solar-release-staging/historic-originals');
const sha=b=>createHash('sha256').update(b).digest('hex');
async function sameOrWrite(path,bytes){
 try{
  const old=await readFile(path);
  requireOk(sha(old)===sha(bytes),'Staged metadata already exists with DIFFERENT bytes: '+path);
 }catch(e){
  if(e.code!=='ENOENT')throw e;
  await writeFile(path,bytes,{flag:'wx'});
 }
}
async function main(){
 const [invBytes,rcptBytes,catBytes,oldManifest,oldMedia]=await Promise.all([
  readFile(join(STAGE,'inventory.json')),
  readFile(join(STAGE,'receipts-media.json')),
  readFile(resolve(ROOT,'reports/staging-mint-plan.json')),
  readFile(join(HIST,'manifest.json')),
  readFile(join(HIST,'media-report.json'))
 ]);
 const inv=JSON.parse(invBytes),receipts=JSON.parse(rcptBytes),catalog=JSON.parse(catBytes);
 validateInventory(inv);
 requireOk(inv.source_catalog_sha256===sha(catBytes)&&
  inv.historic_manifest_sha256===sha(oldManifest)&&
  inv.historic_media_report_sha256===sha(oldMedia),'Original source data changed since Arweave inventory');
 requireOk(receipts.status==='ARWEAVE_UPLOAD_RECEIPTS'&&receipts.kind==='media'&&
  receipts.inventory_sha256===sha(invBytes),'Media receipts do not belong to this inventory');
 requireOk(catalog.pending.length===2358&&catalog.existing_token_mapping.length===19,'Catalog length changed');
 for(const img of inv.media){
  const item=receipts.records[img.sha256];
  requireOk(item&&ARWEAVE_ID.test(item.id)&&item.sha256===img.sha256&&item.bytes===img.bytes,
   'Missing verified Arweave media receipt for '+img.path);
 }
 requireOk(Object.keys(receipts.records).length===inv.media.length,
  'Unexpected media receipt keys');
 const originals=await readHistoricArchive(HIST,catalog.existing_token_mapping);
 const dest=join(STAGE,'metadata');
 await mkdir(dest,{recursive:true});
 const files=[];
 for(let i=0;i<19;i++){
  const filename=historicalId64(i+1);
  const data=originals[filename].raw;
  requireOk(sha(data)===inv.historical[i].metadata_sha256,
   'Historic NFT metadata bytes changed #'+(i+1));
  await sameOrWrite(join(dest,filename),data);
  files.push({filename,sha256:sha(data),bytes:data.length});
 }
 for(let i=0;i<2358;i++){
  const art=inv.artworks[i],item=catalog.pending[i];
  requireOk(art.artwork_id===item.artwork_id&&art.token_id===String(item.proposed_token_id),
   'Artworks no longer match manifest');
  const uploaded=receipts.records[art.image_sha256];
  const description=cleanHtml(item.description_color_it)+'\n\n'+cleanHtml(item.description_depth_it);
  const metadata=newMetadata(item,uploaded.id,description);
  const bytes=Buffer.from(JSON.stringify(metadata,null,2)+'\n','utf8');
  const filename=HEX_ID(item.proposed_token_id);
  await sameOrWrite(join(dest,filename),bytes);
  files.push({filename,sha256:sha(bytes),bytes:bytes.length});
 }
 const staged=await readdir(dest);
 requireOk(staged.length===2377&&files.every(f=>staged.includes(f.filename)),
   'Arweave metadata directory is not exactly 2377 items');
 const metadataReport={
  schema:1,status:'LOCAL_ARWEAVE_METADATA_READY',inventory_sha256:sha(invBytes),
  media_receipts_sha256:sha(rcptBytes),
  historic_json_exact_bytes:19,new_json_count:2358,count:files.length,
  metadata_bytes:files.reduce((total,f)=>total+f.bytes,0),files,
  uploaded:false,production_approved:false,
  warning:'None of these files have been published on Arweave. The old 19 JSONs still reference original IPFS image URIs.'
 };
 await writeFile(join(STAGE,'metadata-stage-report.json'),
  JSON.stringify(metadataReport,null,2)+'\n','utf8');
 console.log(JSON.stringify({status:metadataReport.status,
   output:'reports/arweave-one-time/metadata/',
   historical_exact:19,created_new:2358,metadata_bytes:metadataReport.metadata_bytes,
   future_base_uri:'https://arweave.net/AFTER_MANIFEST_UPLOADED/{id}',
   transaction_count:0,arweave_uploads:0},null,2));
}
main().catch(e=>{console.error('ARWEAVE COMPOSE STOPPED: '+e.message);process.exitCode=1});
