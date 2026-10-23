#!/usr/bin/env node
/**
 * Arweave gateway evidence, no signing, no uploads, no onchain changes.
 * Default: 19 original JSONs + 19 original images + 5 new JSON/image pairs
 * on TWO distinct public gateway operators. Use --full for every single image
 * and 2377 metadata path before considering contract changes.
 */
import {readFile,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ARWEAVE_ID,HEX_ID,validateInventory,requireOk,arweaveBaseUri} from './lib/arweave-release.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const STAGE=resolve(ROOT,'reports/arweave-one-time');
const sha=b=>createHash('sha256').update(b).digest('hex');
const FULL=process.argv.includes('--full');
requireOk(process.argv.slice(2).every(s=>s==='--full'),'Only --full is allowed');
const GATEWAYS=['https://arweave.net','https://turbo-gateway.com'];
const REPORT=join(STAGE,'remote-verification.json');
async function download(url,limit){
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch(url,{
    signal:AbortSignal.timeout(30000),redirect:'error',
    headers:{accept:'application/octet-stream'}
   });
   requireOk(response.ok,'HTTP '+response.status);
   const headerLen=Number(response.headers.get('content-length')||0);
   requireOk(headerLen<=limit,'Content-Length exceeds safe limit');
   const raw=Buffer.from(await response.arrayBuffer());
   requireOk(raw.length>0&&raw.length<=limit,'Remote file exceeds safe limit');
   return raw;
  }catch(e){
   if(attempt===2)throw Error(url+': '+e.message);
   await new Promise(r=>setTimeout(r,1500*(attempt+1)));
  }
 }
}
async function main(){
 // Remove stale positive evidence BEFORE attempting a fresh verification.
 await rm(REPORT,{force:true});
 const [invBytes,releaseBytes,metaReportBytes,mediaBytes,metaBytes,manifestBytes]=await Promise.all([
  readFile(join(STAGE,'inventory.json')),
  readFile(join(STAGE,'release-report.json')),
  readFile(join(STAGE,'metadata-stage-report.json')),
  readFile(join(STAGE,'receipts-media.json')),
  readFile(join(STAGE,'receipts-metadata.json')),
  readFile(join(STAGE,'manifest.json'))
 ]);
 const inv=JSON.parse(invBytes),release=JSON.parse(releaseBytes),
  meta=JSON.parse(metaReportBytes),images=JSON.parse(mediaBytes),
  metas=JSON.parse(metaBytes),manifest=JSON.parse(manifestBytes);
 validateInventory(inv);
 requireOk(release.status==='ARWEAVE_UPLOADED_PENDING_INDEPENDENT_VERIFICATION'&&
  release.production_approved===false&&release.chain_modified===false&&
  release.inventory_sha256===sha(invBytes)&&
  release.metadata_stage_sha256===sha(metaReportBytes)&&
  release.metadata_receipts_sha256===sha(metaBytes)&&
  release.manifest_sha256===sha(manifestBytes)&&
  release.proposed_base_uri===arweaveBaseUri(release.manifest_id)&&
  release.historical_json_bytes_preserved===19,'Release proof mismatch');
 requireOk(manifest.manifest==='arweave/paths'&&
  manifest.version==='0.2.0'&&
  Object.keys(manifest.paths??{}).length===2377,'Invalid manifest contents');
 requireOk(meta.files?.length===2377&&images.inventory_sha256===sha(invBytes),
  'Missing metadata or image receipt sources');
 const records=[];
 for(const f of meta.files){
  const rec=metas.records[f.filename];
  requireOk(rec?.id&&ARWEAVE_ID.test(rec.id)&&
   rec.sha256===f.sha256&&rec.bytes===f.bytes&&
   manifest.paths[f.filename]?.id===rec.id,'Manifest receipt mismatch for '+f.filename);
  records.push(f);
 }
 const mediaBySha=new Map(inv.media.map(x=>[x.sha256,x]));
 const imageFiles=inv.media.map(x=>{
  const entry=images.records[x.sha256];
  requireOk(entry?.id&&ARWEAVE_ID.test(entry.id)&&
   entry.sha256===x.sha256&&entry.bytes===x.bytes,
   'Media receipt mismatch '+x.sha256);
  return {...x,id:entry.id};
 });
 const mustCheckJson=FULL?records:[
  ...records.slice(0,19),
  ...[0,Math.floor(2358/4),Math.floor(2358/2),Math.floor(2358*3/4),2357]
     .map(i=>records[19+i])
 ];
 const mediaSha=new Set(FULL?inv.media.map(x=>x.sha256):[
  ...inv.historical.map(x=>x.image_sha256),
  ...[0,Math.floor(2358/4),Math.floor(2358/2),Math.floor(2358*3/4),2357]
     .map(i=>inv.artworks[i].image_sha256)
 ]);
 const mustCheckImages=imageFiles.filter(x=>mediaSha.has(x.sha256));
 let checked=0;
 for(const gw of GATEWAYS){
  const work=[
   ...mustCheckJson.map(x=>({
    url:gw+'/'+release.manifest_id+'/'+x.filename,
    expected:x.sha256,limit:500000,key:x.filename
   })),
   ...mustCheckImages.map(x=>({
    url:gw+'/'+x.id,expected:x.sha256,
    limit:Math.max(x.bytes+1024,500000),key:x.sha256
   }))
  ];
  for(let i=0;i<work.length;i+=5){
   const batch=work.slice(i,i+5);
   await Promise.all(batch.map(async x=>{
    const downloaded=await download(x.url,x.limit);
    if(sha(downloaded)!==x.expected)
     throw Error('REMOTE SHA256 differs for '+x.key+' from '+gw);
    checked++;
   }));
   if((i+5)%200===0)console.error(gw+': '+Math.min(i+5,work.length)+'/'+work.length+' checks');
  }
 }
 const proof={
  schema:1,status:'ARWEAVE_2_GATEWAY_BYTES_VERIFIED',
  scope:FULL?'FULL':'HISTORIC_ALL_PLUS_SAMPLES',
  checked_at:new Date().toISOString(),
  release_report_sha256:sha(releaseBytes),
  manifest_id:release.manifest_id,manifest_sha256:sha(manifestBytes),
  proposed_base_uri:release.proposed_base_uri,
  archive_metadata_count:19,archive_image_count:19,
  new_sample_metadata_count:FULL?2358:5,
  gateway_operators:['arweave.net','ar.io Turbo'],
  gateway_hosts:GATEWAYS.map(x=>new URL(x).host),
  total_remote_files_verified:checked,
  production_approved:false,chain_transactions:0,
  limitations:'Gateway checks attest byte reachability at check time; not a guarantee of future availability or independent Arweave full network inclusion. Original historic image URIs still use IPFS.'
 };
 await writeFile(REPORT,JSON.stringify(proof,null,2)+'\n','utf8');
 console.log(JSON.stringify({status:proof.status,scope:proof.scope,
  checks:checked,gateways:GATEWAYS,
  proposed_base_uri:release.proposed_base_uri,
  chain_transactions:0,authorization_for_mint:false},null,2));
}
main().catch(e=>{console.error('ARWEAVE VERIFY STOPPED: '+e.message);process.exitCode=1});
