#!/usr/bin/env node
/**
 * NFT operator console: localhost only. Serves static UI + offline draft.
 * All wallet requests happen in the user's injected browser wallet.
 * NO server-side signer, seed, private key, or network transaction.
 */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
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
const sha=raw=>createHash('sha256').update(raw).digest('hex');
const fresh=(timestamp,maxHours)=>{
 const t=Date.parse(timestamp);
 return Number.isFinite(t)&&t<=Date.now()+60000&&Date.now()-t>=0&&Date.now()-t<=maxHours*3600000;
};
async function optionalJSON(path){
 try{return JSON.parse(await readFile(resolve(ROOT,path),'utf8'))}
 catch{return null}
}
async function localState(){
 const [raw,archive,chain,remote,releaseBuf,catalog]=await Promise.all([
  readFile(resolve(ROOT,'reports/local-mint-batches.json'),'utf8'),
  optionalJSON('reports/staging-mint-plan.json'),
  optionalJSON('reports/onchain-new-ids-audit.json'),
  optionalJSON('reports/ipfs-public-verification.json'),
  readFile(resolve(ROOT,'reports/solar-release-staging/release-report.json')).catch(()=>null),
  optionalJSON('reports/staging-mint-plan.json')
 ]);
 const plan=JSON.parse(raw);
 if(plan.chain_id!==137||plan.schema_version!==2||
    plan.collection_address?.toLowerCase()!==CONTRACT||
    plan.mode!=='OFFLINE_TRANSACTION_DRAFT_NO_SIGNATURE'||
    !Array.isArray(plan.operations)||!plan.operations.length||
    !plan.operations.every(o=>o.kind==='atomic_configure_mint'&&
      o.to?.toLowerCase()===CONFIGURER&&o.target_collection?.toLowerCase()===CONTRACT))
   throw Error('Invalid atomic OpenSea mint plan');
 const validIds=(catalog?.pending??[]).map(item=>String(item.proposed_token_id));
 const idsHash=sha(Buffer.from(validIds.join(',')));
 const chainVerified=!!(chain&&chain.read_only&&chain.chain_id===137&&
   chain.contract?.toLowerCase()===CONTRACT&&
   chain.configurer?.toLowerCase()===CONFIGURER&&
   chain.plan_sha256===idsHash&&
   chain.new_ids_checked===2358&&chain.existing_checked===19&&
   chain.new_token_states?.length===2358&&
   chain.new_token_states.every(x=>x.vacant===true)&&
   chain.all_proposed_ids_unused===true&&chain.existing_consistent===true&&
   fresh(chain.created_at,12));
 let proof=false;
 if(releaseBuf&&catalog?.pending?.length===2358){
  try{
   const s=execFileSync(process.execPath,[script],{cwd:ROOT,encoding:'utf8',timeout:60000,
     maxBuffer:5*1024*1024,stdio:['ignore','pipe','ignore']});
   proof=JSON.parse(s).result==='LOCAL_RELEASE_VERIFIED';
  }catch{proof=false}
 }
 const release=releaseBuf?JSON.parse(releaseBuf.toString('utf8')):null;
 const remoteVerified=!!(remote&&releaseBuf&&
   remote.status==='TWO_GATEWAY_SAMPLES_VERIFIED'&&remote.checks_passed===true&&
   remote.chain_id===137&&remote.collection?.toLowerCase()===CONTRACT&&
   remote.proposed_base_uri===release?.proposed_base_uri&&
   remote.release_report_sha256===sha(releaseBuf)&&
   remote.historic_json_exact_match_per_gateway===19&&
   remote.total_remote_files_verified>=58&&
   remote.independent_gateway_hosts?.length>=2&&
   new Set(remote.independent_gateway_hosts).size>=2&&
   fresh(remote.verified_at,24));
 const releaseBound=!!(proof&&release&&plan.metadata_release_locally_staged&&
   plan.proposed_base_uri===release.proposed_base_uri);
 const signingEnabled=process.env.NFT_ENABLE_SIGNING==='YES-I-REVIEWED-THE-RELEASE';
 const readiness={
   local_ipfs_bytes_verified:proof,
   two_public_gateways_verified:remoteVerified,
   entire_id_space_audited:chainVerified,
   local_release_matches_mint_plan:releaseBound,
   explicit_local_signing_opt_in:signingEnabled
 };
 return {plan,readiness,ipfs_local_bytes_verified:proof,
  tx_gates_satisfied_for_ui:Object.values(readiness).every(Boolean)};
}
const routes={
 '/':['text/html; charset=utf-8',resolve(ROOT,'tools/nft-operator.html')],
 '/operator.js':['text/javascript; charset=utf-8',resolve(ROOT,'tools/nft-operator.js')],
 '/ethers.js':['text/javascript; charset=utf-8',resolve(ROOT,'node_modules/ethers/dist/ethers.umd.min.js')],
 '/configurer.js':['text/javascript; charset=utf-8',resolve(ROOT,'scripts/lib/opensea-configurer.mjs')]
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
