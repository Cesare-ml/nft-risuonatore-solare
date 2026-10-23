#!/usr/bin/env node
/**
 * Arweave no-subscription inventory. OFFLINE and SAFE: never uploads,
 * signs, touches an NFT or changes original JSON bytes.
 *
 * Prerequisites: NFT catalog, all 19 original Kubo JSON + image backups.
 */
import {readFile,writeFile,mkdir,stat,open} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname,join,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readHistoricArchive,historicalId64} from './lib/historic-archive.mjs';
import {COLLECTION,ORIGINAL_URI,HEX_ID,mediaType,validateInventory,requireOk} from './lib/arweave-release.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const STAGE=resolve(ROOT,'reports/arweave-one-time');
const HIST=resolve(ROOT,'reports/solar-release-staging/historic-originals');
const sha=b=>createHash('sha256').update(b).digest('hex');
function safePath(path){
 requireOk(typeof path==='string'&&path.length>0&&!isAbsolute(path),'Unsafe absolute source file');
 const loc=resolve(ROOT,path);
 requireOk(loc.startsWith(ROOT+sep),'Unsafe path outside repository');
 return loc;
}
async function fingerprint(path){
 const s=await stat(path);
 requireOk(s.isFile()&&s.size>8&&s.size<80*1024*1024,'Empty or unexpectedly big NFT image: '+path);
 const handle=await open(path,'r');
 const bytes=Buffer.alloc(16);
 try{await handle.read(bytes,0,bytes.length,0)}
 finally{await handle.close()}
 const kind=mediaType(bytes);
 const h=createHash('sha256');
 for await(const part of createReadStream(path))h.update(part);
 return {bytes:s.size,sha256:h.digest('hex'),content_type:kind};
}
async function main(){
 const [catalogBytes,origReport,mediaReportBytes]=await Promise.all([
  readFile(resolve(ROOT,'reports/staging-mint-plan.json')),
  readFile(join(HIST,'manifest.json')),
  readFile(join(HIST,'media-report.json'))
 ]);
 const catalog=JSON.parse(catalogBytes);
 requireOk(catalog.mode==='DRY_RUN_ONLY'&&catalog.pending.length===2358&&
   catalog.existing_token_mapping.length===19&&
   catalog.target_collection?.contract_address?.toLowerCase()===COLLECTION,
   'Invalid source NFT catalog');
 const original=await readHistoricArchive(HIST,catalog.existing_token_mapping);
 const historyMedia=JSON.parse(mediaReportBytes);
 requireOk(historyMedia.status==='HISTORIC_19_IPFS_MEDIA_VERIFIED'&&
  historyMedia.historic_manifest_sha256===sha(origReport)&&
  historyMedia.original_nft_count===19&&historyMedia.read_only===true&&
  Object.keys(historyMedia.records??{}).length===19,
  'Historical images have not been authenticated via Kubo');
 const mediaMap=new Map(),artworks=[],historical=[];
 async function register(path){
  const stat=await fingerprint(path);
  if(!mediaMap.has(stat.sha256)){
   const rel=relative(ROOT,path).split(sep).join('/');
   mediaMap.set(stat.sha256,{sha256:stat.sha256,bytes:stat.bytes,
    content_type:stat.content_type,path:rel});
  }
  return stat;
 }
 for(const item of catalog.existing_token_mapping){
  const token_id=String(item.token_id),hex=historicalId64(token_id);
  const image=historyMedia.records[hex];
  requireOk(image?.token_id===token_id&&/^[0-9a-f]{64}$/.test(image.image_sha256)&&
    image.archive_file===hex+'.bin','Historical image archive mismatch '+token_id);
  const saved=join(HIST,'images',hex+'.bin');
  const img=await register(saved);
  requireOk(img.sha256===image.image_sha256&&img.bytes===image.bytes,
    'Historic image content differs from Kubo report '+token_id);
  historical.push({token_id,metadata_filename:hex,
   metadata_sha256:sha(original[hex].raw),image_sha256:img.sha256,
   original_image_uri:original[hex].archive.image});
 }
 for(const item of catalog.pending){
  requireOk(item.proposed_metadata_filename===HEX_ID(item.proposed_token_id),
   'Unexpected proposed NFT file name');
  requireOk(item.image_path.startsWith('nft-imgs/'),'Artwork is not from original image collection');
  const image=await register(safePath(item.image_path));
  requireOk(image.content_type==='image/png','Original NFT catalog source must be PNG');
  artworks.push({token_id:String(item.proposed_token_id),artwork_id:item.artwork_id,
   metadata_filename:item.proposed_metadata_filename,image_sha256:image.sha256});
 }
 const media=[...mediaMap.values()];
 const inventory={
  schema:1,status:'LOCAL_ARWEAVE_INVENTORY_READY',
  created_at:new Date().toISOString(),collection:COLLECTION,old_base_uri:ORIGINAL_URI,
  source_catalog_sha256:sha(catalogBytes),
  historic_manifest_sha256:sha(origReport),
  historic_media_report_sha256:sha(mediaReportBytes),
  pending_count:2358,historic_count:19,metadata_count:2377,
  artworks,historical,media,
  duplicate_images_eliminated:2358+19-media.length,
  total_media_bytes_to_upload:media.reduce((a,b)=>a+b.bytes,0),
  total_source_media_bytes:0,monthly_storage_fee_required:false,
  uploaded:false,transaction_count:0,
  warnings:[
   'Permanent Arweave data requires a one-time payment quoted live; no files are uploaded by this command.',
   'The 19 ORIGINAL JSONs remain byte identical, so old image URIs continue to point to IPFS.',
   'Mirroring old images to Arweave preserves bytes but does not automatically keep original IPFS CIDs reachable.',
   'Do not change setBaseURI or mint before the manifest, remote SHA256 checks, and owner authorization.'
  ]
 };
 inventory.total_source_media_bytes=media.reduce((sum,m)=>sum+m.bytes,0);
 validateInventory(inventory);
 await mkdir(STAGE,{recursive:true});
 const dest=join(STAGE,'inventory.json');
 await writeFile(dest,JSON.stringify(inventory,null,2)+'\n');
 console.log(JSON.stringify({status:inventory.status,output:'reports/arweave-one-time/inventory.json',
  original_json_preserved:19,existing_images_backed_up:19,new_artworks:2358,
  unique_image_uploads:media.length,bytes_to_store:inventory.total_media_bytes_to_upload,
  duplicate_images_skipped:inventory.duplicate_images_eliminated,
  monthly_storage_fee_required:false,no_uploads:true,no_chain_transactions:true},null,2));
}
main().catch(e=>{console.error('ARWEAVE INVENTORY STOPPED: '+e.message);process.exitCode=1});
