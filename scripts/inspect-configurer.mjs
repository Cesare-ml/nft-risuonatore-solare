#!/usr/bin/env node
/**
 * Public read-only inspection of OpenSea Studio configurer used by the
 * existing Polygon ERC-1155 collection. Never signs or sends transactions.
 * Requires Node 18+ and npm install (ethers v6).
 */
import {JsonRpcProvider,Contract} from 'ethers';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
const CONTRACT='0xead98e12d3836562ea39c6a6ca5ef1292359a862';
const EXPECTED_CONFIGURER='0x864baa13e01d8f9e26549dc91b458cd15e34eb7c';
const RPC=process.env.POLYGON_RPC_URL||'https://polygon.drpc.org';
const provider=new JsonRpcProvider(RPC,137,{staticNetwork:true});
async function fetchJSON(url){
 const r=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('HTTP '+r.status);
 return r.json();
}
const contract=new Contract(CONTRACT,[
 'function owner() view returns(address)',
 'function configurer() view returns(address)',
 'function maxSupply(uint256) view returns(uint256)',
 'function totalMinted(uint256) view returns(uint256)'
],provider);
async function run(){
 const chain=await provider.getNetwork();
 if(chain.chainId!==137n)throw Error('Wrong chain ID');
 const [configurer,owner]=await Promise.all([contract.configurer(),contract.owner()]);
 if(configurer.toLowerCase()!==EXPECTED_CONFIGURER)
   throw Error('Configurer address changed onchain. Stop and inspect manually.');
 const bytecode=await provider.getCode(configurer);
 if(bytecode==='0x')throw Error('Configurer has no code');
 const info={
  read_only:true,checked_at:new Date().toISOString(),chain_id:137,
  collection:CONTRACT,owner_address:owner,configurer_address:configurer,
  configurer_bytecode_bytes:(bytecode.length-2)/2,
  abi_source:'not_found',
  abi_verified:false,functions:[],batch_candidates:[],
  docs:'Does not prove this configurer can safely batch owner-only setMaxSupply; inspect source and simulate on fork.'
 };
 const url='https://sourcify.dev/server/v2/contract/137/'+configurer+'?fields=abi';
 try{
  const meta=await fetchJSON(url);
  if(meta.match && Array.isArray(meta.abi)){
    info.abi_source='sourcify_v2';info.abi_verified=true;
    info.match=meta.match;
    info.functions=meta.abi.filter(x=>x.type==='function').map(x=>({
      signature:x.name+'('+(x.inputs??[]).map(y=>y.type).join(',')+')',
      mutability:x.stateMutability,
      inputs:(x.inputs??[]).map(y=>({name:y.name,type:y.type}))
    }));
    info.batch_candidates=info.functions.filter(f=>/batch|multi|configure|token|mint|supply/i.test(f.signature));
  }else{info.error_note='Sourcify responded without verified ABI';}
 }catch(e){
  info.error_note='Sourcify ABI not available: '+String(e.message);
 }
 if(!info.abi_verified){
  info.recommended_next_step='Inspect verified source on PolygonScan/Blockscout or supply a verified ABI locally; do not infer batch support from a name alone.';
 }else{
  info.recommended_next_step='Review access checks, configurer method semantics, and local Anvil fork simulation before any real mint.';
 }
 const out=resolve('reports/configurer-inspection.json');
 await mkdir(dirname(out),{recursive:true});
 await writeFile(out,JSON.stringify(info,null,2)+'\n','utf8');
 console.log(JSON.stringify({
  output:'reports/configurer-inspection.json',
  chain_id:info.chain_id,configurer:info.configurer_address,
  bytecode_bytes:info.configurer_bytecode_bytes,
  abi_verified:info.abi_verified,number_of_functions:info.functions.length,
  batch_candidates:info.batch_candidates.map(f=>f.signature),
  error_note:info.error_note??null,
  no_mainnet_transactions:true
 },null,2));
}
run().catch(e=>{console.error('CONFIGURER INSPECTION FAILED: '+String(e.message));process.exitCode=1});
