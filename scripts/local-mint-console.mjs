#!/usr/bin/env node
/**
 * NFT operator console: localhost only. Serves static UI + offline draft.
 * All wallet requests happen in the user's injected browser wallet.
 * NO server-side signer, seed, private key, or network transaction.
 */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
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
async function localState(){
  const [raw,proof]=await Promise.all([
    readFile(resolve(ROOT,'reports/local-mint-batches.json'),'utf8'),
    Promise.resolve().then(()=>{
      try{
        const s=execFileSync(process.execPath,[script],{cwd:ROOT,encoding:'utf8',timeout:60000,
          maxBuffer:5*1024*1024,stdio:['ignore','pipe','ignore']});
        return JSON.parse(s).result==='LOCAL_RELEASE_VERIFIED';
      }catch{return false;}
    })
  ]);
  const plan=JSON.parse(raw);
  if(plan.chain_id!==137 ||
     plan.collection_address?.toLowerCase()!=='0xead98e12d3836562ea39c6a6ca5ef1292359a862' ||
     plan.mode!=='OFFLINE_TRANSACTION_DRAFT_NO_SIGNATURE')throw Error('Mint plan invalid');
  return {plan,ipfs_local_bytes_verified:proof,
    tx_gates_satisfied_for_ui:!!(proof&&plan.metadata_release_locally_staged&&plan.proposed_base_uri)};
}
const routes={
 '/':['text/html; charset=utf-8',resolve(ROOT,'tools/nft-operator.html')],
 '/operator.js':['text/javascript; charset=utf-8',resolve(ROOT,'tools/nft-operator.js')],
 '/ethers.js':['text/javascript; charset=utf-8',resolve(ROOT,'node_modules/ethers/dist/ethers.umd.min.js')]
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
