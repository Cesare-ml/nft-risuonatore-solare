#!/usr/bin/env node
/**
 * Check remote gateway access for an IPFS release (NO uploads / chain writes).
 * Requires two independent HTTPS gateway hosts. Verifies original 19 JSON
 * bytes and deterministic new-artwork metadata+media samples.
 * NOTE: remote retrieval is not a cryptographic IPFS path proof by itself.
 */
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const STAGE=resolve(ROOT,'reports/solar-release-staging');
const REPORT=resolve(ROOT,'reports/ipfs-public-verification.json');
const PLAN=resolve(ROOT,'reports/staging-mint-plan.json');
const sha=b=>createHash('sha256').update(b).digest('hex');
const hexId=id=>BigInt(id).toString(16).padStart(64,'0');
const defaults=['https://ipfs.io/ipfs','https://dweb.link/ipfs'];
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
let chosen=[];
for(let i=0;i<process.argv.slice(2).length;i++){
 const arg=process.argv.slice(2)[i];
 if(arg!=='--gateway')throw Error('Usage: node scripts/verify-public-ipfs-release.mjs [--gateway https://.../ipfs --gateway https://.../ipfs]');
 const v=process.argv.slice(2)[++i];
 if(!v)throw Error('Missing --gateway URL');
 chosen.push(v);
}
if(chosen.length===0)chosen=defaults;
function normalizeGateway(v){
 const u=new URL(v);
 if(u.protocol!=='https:'||!u.hostname||u.username||u.password||u.search||u.hash)
   throw Error('Only HTTPS gateways without credentials or query parameters are accepted');
 const base=(u.origin+u.pathname).replace(/\/$/,'');
 if(!base.endsWith('/ipfs'))throw Error('Gateway URL must end with /ipfs');
 return {base,host:u.hostname};
}
const gateways=chosen.map(normalizeGateway);
if(gateways.length<2||new Set(gateways.map(x=>x.host)).size!==gateways.length)
 throw Error('Two independent HTTPS gateway hosts required');
async function remote(gateway,cid,filename,maxBytes){
 const url=gateway.base+'/'+cid+'/'+filename;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch(url,{headers:{accept:'application/octet-stream'},
    signal:AbortSignal.timeout(24000),redirect:'error'});
   if(!response.ok)throw Error('HTTP '+response.status);
   const len=Number(response.headers.get('content-length')||0);
   if(len>maxBytes)throw Error('Unreasonable content length');
   const data=Buffer.from(await response.arrayBuffer());
   if(data.length>maxBytes)throw Error('Unreasonable file size');
   return data;
  }catch(e){
   if(attempt===2)throw Error(gateway.host+' /'+filename+': '+e.message);
   await sleep(1200*(attempt+1));
  }
 }
}
function requireOk(ok,msg){if(!ok)throw Error(msg)}
async function run(){
 // Erase prior certificate before attempting a fresh verification.
 await rm(REPORT,{force:true});
 const [plan,releaseBytes]=await Promise.all([
  readFile(PLAN,'utf8').then(JSON.parse),
  readFile(join(STAGE,'release-report.json'))
 ]);
 const release=JSON.parse(releaseBytes.toString('utf8'));
 requireOk(plan.mode==='DRY_RUN_ONLY'&&plan.pending.length===2358&&plan.existing_token_mapping.length===19,
   'Invalid source catalog');
 requireOk(release.status==='LOCAL_IPFS_STAGING_COMPLETE'&&release.production_approved===false,
   'Local release has not been safely staged');
 const metaCid=release.proposed_base_uri?.match(/^ipfs:\/\/(bafy[a-z2-7]+)\/\{id\}$/)?.[1];
 const mediaCid=release.media_cid;
 requireOk(!!metaCid&&/^bafy[a-z2-7]+$/.test(mediaCid),'Invalid CID');
 const samples=[0,Math.floor(2358/4),Math.floor(2358/2),Math.floor(2358*3/4),2357];
 const chosenArt=samples.map(i=>plan.pending[i]);
 let count=0;
 for(const gw of gateways){
  console.error('Gateway: '+gw.host);
  // Historical tokens 1–19 must resolve to EXACT original bytes.
  for(const item of plan.existing_token_mapping){
   const filename=hexId(item.token_id);
   const source=await readFile(join(STAGE,'metadata',filename));
   const archived=release.archived?.[filename];
   requireOk(!!archived&&sha(source)===archived.sha256,'Historic local SHA mismatch token '+item.token_id);
   const remoteBytes=await remote(gw,metaCid,filename,500000);
   requireOk(sha(remoteBytes)===archived.sha256,
     'Historic metadata remote bytes differ for '+item.token_id+' on '+gw.host);
   count++;
  }
  // Sample new JSONs and their PNG media against local staged content.
  for(const item of chosenArt){
   const filename=item.proposed_metadata_filename;
   const localJSON=await readFile(join(STAGE,'metadata',filename));
   const fromGW=await remote(gw,metaCid,filename,500000);
   requireOk(sha(localJSON)===sha(fromGW),'New metadata mismatch for '+item.artwork_id+' on '+gw.host);
   const file=item.artwork_id+'.png';
   const originalImage=await readFile(join(STAGE,'media',file));
   const remoteImage=await remote(gw,mediaCid,file,20000000);
   requireOk(sha(originalImage)===sha(remoteImage),'New image mismatch for '+item.artwork_id+' on '+gw.host);
   count+=2;
  }
 }
 const report={
  schema:1,status:'TWO_GATEWAY_SAMPLES_VERIFIED',
  verified_at:new Date().toISOString(),
  release_report_sha256:sha(releaseBytes),
  chain_id:137,collection:'0xead98e12d3836562ea39c6a6ca5ef1292359a862',
  proposed_base_uri:release.proposed_base_uri,
  media_cid:mediaCid,
  independent_gateway_hosts:gateways.map(x=>x.host),
  historic_json_exact_match_per_gateway:19,
  new_metadata_image_sample_ids:chosenArt.map(x=>String(x.proposed_token_id)),
  total_remote_files_verified:count,
  checks_passed:true,transactions_sent:0,
  limitations:'Gateway sampling does not guarantee permanent pin availability or independently prove IPLD path authenticity. Verify durable redundant remote pinning separately.'
 };
 await mkdir(dirname(REPORT),{recursive:true});
 await writeFile(REPORT,JSON.stringify(report,null,2)+'\n','utf8');
 console.log(JSON.stringify({output:'reports/ipfs-public-verification.json',
  status:report.status,gateways:report.independent_gateway_hosts,
  checked_files:count,chain_mutated:false,passed:true},null,2));
}
run().catch(e=>{console.error('PUBLIC IPFS VERIFICATION FAILED: '+e.message);process.exitCode=1;});
