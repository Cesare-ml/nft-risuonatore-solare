#!/usr/bin/env node
/**
 * NFT operator console: localhost only. Serves static UI + offline draft.
 * All wallet requests happen in the user's injected browser wallet.
 * NO server-side signer, seed, private key, or network transaction.
 */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {evaluateReadiness} from './lib/publish-readiness.mjs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const HOST='127.0.0.1';
const PORT=Number(process.env.NFT_CONSOLE_PORT??'8765');
if(!Number.isInteger(PORT)||PORT<1024||PORT>65535)throw Error('Invalid NFT_CONSOLE_PORT');
const script=resolve(ROOT,'scripts/verify-ipfs-release.mjs');
const mimeHeaders={
  'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'DENY',
  'Cross-Origin-Resource-Policy':'same-origin',
  'Referrer-Policy':'no-referrer',
  'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
};
const CONTRACT='0xead98e12d3836562ea39c6a6ca5ef1292359a862';
const CONFIGURER='0x864baa13e01d8f9e26549dc91b458cd15e34eb7c';
async function optionalJSON(path){
 try{return JSON.parse(await readFile(resolve(ROOT,path),'utf8'))}
 catch{return null}
}
async function localState(){
 const [raw,chain,remote,releaseBytes,catalog,forkProof,abiSourceBytes]=await Promise.all([
   readFile(resolve(ROOT,'reports/local-mint-batches.json'),'utf8'),
   optionalJSON('reports/onchain-new-ids-audit.json'),
   optionalJSON('reports/ipfs-public-verification.json'),
   readFile(resolve(ROOT,'reports/solar-release-staging/release-report.json')).catch(()=>null),
   optionalJSON('reports/staging-mint-plan.json'),
   optionalJSON('reports/atomic-fork-proof.json'),
   readFile(resolve(ROOT,'scripts/lib/opensea-configurer.mjs'))
 ]);
 const plan=JSON.parse(raw);
 const usesArweave=/^https:\/\/arweave\.net\/[A-Za-z0-9_-]{43}\/\{id\}$/.test(plan.proposed_base_uri??'');
 const chosenRelease=usesArweave?
    await readFile(resolve(ROOT,'reports/arweave-one-time/release-report.json')).catch(()=>null):
    releaseBytes;
 const chosenRemote=usesArweave?
    await optionalJSON('reports/arweave-one-time/remote-verification.json'):
    remote;
 const localVerifier=usesArweave?
    resolve(ROOT,'scripts/verify-arweave-local.mjs'):script;
 if(plan.chain_id!==137||plan.schema_version!==2||
    plan.collection_address?.toLowerCase()!==CONTRACT||
    plan.mode!=='OFFLINE_TRANSACTION_DRAFT_NO_SIGNATURE'||
    !Array.isArray(plan.operations)||plan.operations.length===0||
    !plan.operations.every(o=>o.kind==='atomic_configure_mint'&&
      o.to?.toLowerCase()===CONFIGURER&&o.target_collection?.toLowerCase()===CONTRACT))
    throw Error('Invalid atomic OpenSea mint plan');
 let verifiedLocal=false;
 if(chosenRelease&&catalog?.pending?.length===2358){
  try{
   const out=execFileSync(process.execPath,[localVerifier],{
      cwd:ROOT,encoding:'utf8',timeout:60000,maxBuffer:5*1024*1024,
      stdio:['ignore','pipe','ignore']});
   const checked=JSON.parse(out);
   verifiedLocal=checked.result==='LOCAL_RELEASE_VERIFIED'||checked.status==='ARWEAVE_LOCAL_RELEASE_VERIFIED';
  }catch{verifiedLocal=false}
 }
 let historicImagesVerified=false;
 if(verifiedLocal){
  try{
   const evidence=execFileSync(process.execPath,[
    resolve(ROOT,'scripts/verify-historic-ipfs-media.mjs'),'--verify-only'
   ],{cwd:ROOT,encoding:'utf8',timeout:60000,
      maxBuffer:2*1024*1024,stdio:['ignore','pipe','ignore']});
   historicImagesVerified=JSON.parse(evidence).status==='HISTORIC_MEDIA_OFFLINE_VERIFIED';
  }catch{historicImagesVerified=false}
 }
 const readiness=evaluateReadiness({
  plan,catalog,releaseBytes:chosenRelease,localVerified:verifiedLocal,
  chain,remote:chosenRemote,forkProof,abiSourceBytes,historicImagesVerified,
  enableSigning:process.env.NFT_ENABLE_SIGNING==='YES-I-REVIEWED-THE-RELEASE'
 });
 return {
  plan,readiness,ipfs_local_bytes_verified:verifiedLocal,
  expected_configurer_code_hash:readiness.atomic_fork_proof_verified ? forkProof.configurer_bytecode_keccak256 : null,
  tx_gates_satisfied_for_ui:Object.values(readiness).every(Boolean)
 };
}
const routes={
 '/':['text/html; charset=utf-8',resolve(ROOT,'tools/nft-operator.html')],
 '/operator.js':['text/javascript; charset=utf-8',resolve(ROOT,'tools/nft-operator.js')],
 '/ethers.js':['text/javascript; charset=utf-8',resolve(ROOT,'node_modules/ethers/dist/ethers.umd.min.js')],
 '/configurer.js':['text/javascript; charset=utf-8',resolve(ROOT,'scripts/lib/opensea-configurer.mjs')],
 '/fork-identity.js':['text/javascript; charset=utf-8',resolve(ROOT,'scripts/lib/fork-provenance.mjs')]
};
const server=createServer(async(req,res)=>{
 const url=(req.url||'').split('?')[0];
 if(req.method!=='GET'||!(url in routes||url==='/plan')){
   res.writeHead(404,mimeHeaders);res.end('Not found');return;
 }
 try{
   if(url==='/plan'){
     const payload=await localState();
     res.writeHead(200,{...mimeHeaders,'Content-Type':'application/json; charset=utf-8'});
     res.end(JSON.stringify(payload));return;
   }
   const [mime,path]=routes[url];
   const raw=await readFile(path);
   res.writeHead(200,{...mimeHeaders,'Content-Type':mime});
   res.end(raw);
 }catch(error){
   res.writeHead(503,{...mimeHeaders,'Content-Type':'text/plain; charset=utf-8'});
   res.end('Unable to prepare console. Run npm install, npm run nft:plan and npm run nft:mint:plan. '+error.message);
 }
});
server.listen(PORT,HOST,()=>{
 console.log('Local NFT operator: http://'+HOST+':'+PORT+'/');
 console.log('Browser wallet authorizes each transaction; no wallet secrets in this process.');
 console.log('Close this terminal to stop the local console.');
});
