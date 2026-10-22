#!/usr/bin/env node
/**
 * Recover historic OpenSea ERC1155 token metadata bytes from original IPFS CID.
 * Kubo verifies content addressing; public HTTP gateway diagnostics are
 * read-only and DO NOT qualify a gateway response as a trusted archive.
 *
 * npm run nft:ipfs:recover      (Kubo, NO blockchain writes)
 * node scripts/recover-historic-ipfs.mjs --diagnose (HTTP headers for ID 1 only)
 */
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,rename,rm,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const OLD_CID='bafybeih7ucalsv5p2xh3zjrslg6fjgz7y3t4q2fivebci56mz3wex4gwj4';
const PATH=resolve(ROOT,'reports/solar-release-staging/historic-originals');
const PLAN=resolve(ROOT,'reports/staging-mint-plan.json');
const args=process.argv.slice(2);
const DIAGNOSE=args.includes('--diagnose');
if(args.some(x=>x!=='--diagnose'))throw Error('Usage: npm run nft:ipfs:recover OR node scripts/recover-historic-ipfs.mjs --diagnose');
const id64=id=>BigInt(id).toString(16).padStart(64,'0');
const sha=b=>createHash('sha256').update(b).digest('hex');
function cat(path){
 return execFileSync('ipfs',['cat',path],{encoding:'buffer',timeout:240000,maxBuffer:2*1024*1024,windowsHide:true,stdio:['ignore','pipe','pipe']});
}
async function diagnosis(){
 const file=id64(1);
 const gateways=[
  'https://gateway.pinata.cloud/ipfs',
  'https://w3s.link/ipfs'
 ];
 const results=[];
 for(const gateway of gateways){
  const target=gateway+'/'+OLD_CID+'/'+file;
  try{
   const r=await fetch(target,{redirect:'error',signal:AbortSignal.timeout(16000),
    headers:{accept:'application/json'}});
   const ct=r.headers.get('content-type');
   const data=Buffer.from(await r.arrayBuffer());
   const asJSON=data.length<500000&&r.ok&&ct?.includes('json')&&
    JSON.parse(data.toString('utf8'));
   results.push({host:new URL(gateway).host,http_status:r.status,
    bytes:data.length,sha256:r.ok?sha(data):null,JSON_valid:!!asJSON?.name&&!!asJSON?.image,
    note:'HTTP response NOT a Kubo-validated CID provenance proof'});
  }catch(e){results.push({host:new URL(gateway).host,error:String(e.message)});}
 }
 console.log(JSON.stringify({diagnostic_only:true,token_id:1,original_cid:OLD_CID,results,
  recommendation:'Use local Kubo ipfs cat for a trusted original metadata archive.'},null,2));
}
async function recover(){
 const plan=JSON.parse(await readFile(PLAN,'utf8'));
 if(plan.mode!=='DRY_RUN_ONLY'||plan.existing_token_mapping?.length!==19)
  throw Error('Expected a complete original 19-token catalog plan');
 const ids=plan.existing_token_mapping.map(x=>String(x.token_id));
 if(ids.join(',')!==Array.from({length:19},(_,i)=>String(i+1)).join(','))
  throw Error('Unexpected historic token mapping');
 const version=execFileSync('ipfs',['version'],{encoding:'utf8',timeout:12000,windowsHide:true}).trim();
 await mkdir(PATH,{recursive:true});
 const records={};let reused=0,fetched=0;
 for(const id of ids){
  const filename=id64(id),dest=join(PATH,filename);
  let raw=null;
  try{raw=await readFile(dest)}catch(e){if(e.code!=='ENOENT')throw e}
  if(raw!==null){
   // Re-validate the IPFS origin if a local byte file already exists.
   const fromCID=cat(OLD_CID+'/'+filename);
   if(sha(raw)!==sha(fromCID))
    throw Error('Historic backup mismatch for token '+id+'; refusing to overwrite');
   reused++;
  }else{
   raw=cat(OLD_CID+'/'+filename);
   const tmp=dest+'.tmp';
   await writeFile(tmp,raw,{flag:'wx'}).catch(async e=>{
    if(e.code==='EEXIST'){await rm(tmp,{force:true});await writeFile(tmp,raw,{flag:'wx'});}
    else throw e;
   });
   await rename(tmp,dest);
   fetched++;
  }
  if(raw.length===0||raw.length>500000)throw Error('Unexpected historic JSON byte count #'+id);
  let parsed;
  try{parsed=JSON.parse(raw.toString('utf8'))}catch{throw Error('Invalid original JSON for ID '+id)}
  if(typeof parsed.name!=='string'||typeof parsed.image!=='string'||
    !parsed.name||!parsed.image)throw Error('Missing name/image in historic JSON #'+id);
  records[filename]={token_id:id,sha256:sha(raw),bytes:raw.length,
    name:parsed.name,image:parsed.image,source:'Kubo ipfs cat '+OLD_CID+'/'+filename};
  console.error('Recovered '+id+'/19 historic original JSON files via Kubo.');
 }
 const manifest={
  status:'KUBO_HISTORIC_19_VERIFIED',
  original_cid:OLD_CID,
  collection_address:plan.target_collection.contract_address,
  recovered_at:new Date().toISOString(),
  records,existing_count:Object.keys(records).length,
  verification:'ipfs cat of original CID and exact path; re-fetched and compared each existing file',
  no_blockchain_transactions:true,no_opensea_uploads:true,kubo_version:version
 };
 const file=join(PATH,'manifest.json'),tmp=file+'.tmp';
 await writeFile(tmp,JSON.stringify(manifest,null,2)+'\n','utf8');
 await rename(tmp,file);
 console.log(JSON.stringify({status:manifest.status,files_verified:19,
  downloaded:fetched,already_cached_and_rechecked:reused,
  original_cid:OLD_CID,manifest:'reports/solar-release-staging/historic-originals/manifest.json',
  mainnet_transactions:0},null,2));
}
(DIAGNOSE?diagnosis():recover()).catch(error=>{
 console.error('HISTORIC IPFS RETRIEVAL STOPPED: '+error.message);process.exitCode=1;
});
