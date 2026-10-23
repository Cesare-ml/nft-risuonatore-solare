#!/usr/bin/env node
/**
 * Verify the on-disk candidate Arweave release WITHOUT accessing a gateway.
 * Full 2377 JSON check + original 19 SHA256 + every source image hash.
 * Does not imply remote availability or permission to setBaseURI.
 */
import {readFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readHistoricArchive} from './lib/historic-archive.mjs';
import {validateInventory,ARWEAVE_ID,requireOk,arweaveBaseUri} from './lib/arweave-release.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const STAGE=resolve(ROOT,'reports/arweave-one-time');
const HIST=resolve(ROOT,'reports/solar-release-staging/historic-originals');
const sha=b=>createHash('sha256').update(b).digest('hex');
async function hashFile(path){
 const h=createHash('sha256');
 for await(const b of createReadStream(path))h.update(b);
 return h.digest('hex');
}
async function main(){
 const [iv,rel,met,rc,ir,manifest,cat,origManifest,origMedia]=await Promise.all([
  readFile(join(STAGE,'inventory.json')),
  readFile(join(STAGE,'release-report.json')),
  readFile(join(STAGE,'metadata-stage-report.json')),
  readFile(join(STAGE,'receipts-metadata.json')),
  readFile(join(STAGE,'receipts-media.json')),
  readFile(join(STAGE,'manifest.json')),
  readFile(resolve(ROOT,'reports/staging-mint-plan.json')),
  readFile(join(HIST,'manifest.json')),
  readFile(join(HIST,'media-report.json'))
 ]);
 const inv=JSON.parse(iv),release=JSON.parse(rel),staged=JSON.parse(met),
  metadataReceipts=JSON.parse(rc),mediaReceipts=JSON.parse(ir),
  m=JSON.parse(manifest),catalog=JSON.parse(cat);
 validateInventory(inv);
 requireOk(inv.source_catalog_sha256===sha(cat)&&
  inv.historic_manifest_sha256===sha(origManifest)&&
  inv.historic_media_report_sha256===sha(origMedia),
  'Catalog or authenticated original archive no longer matches inventory');
 requireOk(release.status==='ARWEAVE_UPLOADED_PENDING_INDEPENDENT_VERIFICATION'&&
  release.proposed_base_uri===arweaveBaseUri(release.manifest_id)&&
  release.inventory_sha256===sha(iv)&&
  release.metadata_stage_sha256===sha(met)&&
  release.metadata_receipts_sha256===sha(rc)&&
  release.manifest_sha256===sha(manifest)&&
  release.historical_json_bytes_preserved===19,
  'Arweave release report is missing or inconsistent');
 requireOk(staged.inventory_sha256===sha(iv)&&staged.count===2377&&
  staged.files.length===2377&&m.manifest==='arweave/paths'&&
  m.version==='0.2.0'&&Object.keys(m.paths??{}).length===2377,
  'Wrong manifest or staged file count');
 requireOk(metadataReceipts.metadata_stage_sha256===sha(met)&&
  metadataReceipts.inventory_sha256===sha(iv)&&
  mediaReceipts.inventory_sha256===sha(iv),'Receipts do not match this release');
 const originals=await readHistoricArchive(HIST,catalog.existing_token_mapping);
 const artworks=new Map(inv.artworks.map(a=>[a.metadata_filename,a]));
 for(const item of staged.files){
  const path=join(STAGE,'metadata',item.filename);
  const bytes=await readFile(path);
  requireOk(bytes.length===item.bytes&&sha(bytes)===item.sha256,
   'Arweave metadata bytes differ from uploaded receipt '+item.filename);
  const receipt=metadataReceipts.records[item.filename];
  requireOk(receipt?.sha256===item.sha256&&receipt.bytes===item.bytes&&
   ARWEAVE_ID.test(receipt.id)&&m.paths[item.filename]?.id===receipt.id,
   'Incorrect manifest mapping for '+item.filename);
  if(originals[item.filename]){
   requireOk(sha(originals[item.filename].raw)===item.sha256,
    'Historical NFT JSON changed under Arweave');
  }else{
   const art=artworks.get(item.filename);
   requireOk(!!art,'Unknown future metadata path '+item.filename);
   const json=JSON.parse(bytes.toString('utf8'));
   const image=mediaReceipts.records[art.image_sha256];
   requireOk(ARWEAVE_ID.test(image?.id)&&json.image==='ar://'+image.id,
    'New metadata does not point to original Arweave image receipt');
  }
 }
 for(const file of inv.media){
  const rec=mediaReceipts.records[file.sha256];
  const path=resolve(ROOT,file.path);
  requireOk(rec?.sha256===file.sha256&&rec.bytes===file.bytes&&
   ARWEAVE_ID.test(rec.id),'Unverified media receipt for '+file.path);
  const s=await stat(path);
  requireOk(s.isFile()&&s.size===file.bytes&&
   (await hashFile(path))===file.sha256,'Source artwork changed after upload: '+file.path);
 }
 console.log(JSON.stringify({
  status:'ARWEAVE_LOCAL_RELEASE_VERIFIED',
  manifest_id:release.manifest_id,proposed_base_uri:release.proposed_base_uri,
  checked_metadata_files:2377,checked_originals:19,checked_media_files:inv.media.length,
  production_approved:false,chain_modified:false
 },null,2));
}
main().catch(e=>{console.error('ARWEAVE LOCAL RELEASE INVALID: '+e.message);process.exitCode=1});
