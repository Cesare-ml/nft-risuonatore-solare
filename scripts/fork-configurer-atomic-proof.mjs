#!/usr/bin/env node
/**
 * Local Anvil fork ONLY. Atomic OpenSea configurer batch mint test.
 * No network transaction signing/broadcast to Polygon mainnet.
 * Start local Anvil: anvil --fork-url https://polygon.drpc.org --chain-id 137
 * Then run npm run nft:fork:atomic
 */
import {Interface,keccak256} from 'ethers';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyPolygonForkIdentity} from './lib/fork-provenance.mjs';
import {CONFIGURER,CONFIGURER_ABI,CONFIGURER_SELECTOR,COLLECTION,makeAtomicMintConfig}
  from './lib/opensea-configurer.mjs';
const RPC='http://127.0.0.1:8545'; // deliberately hard-coded localhost.
const readAbi=new Interface([
 'function owner() view returns(address)',
 'function configurer() view returns(address)',
 'function totalSupply(uint256) view returns(uint256)',
 'function totalMinted(uint256) view returns(uint256)',
 'function maxSupply(uint256) view returns(uint256)',
 'function baseURI() view returns(string)'
]);
const writeAbi=new Interface(CONFIGURER_ABI);
async function rpc(method,params=[]){
 const r=await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('Local fork HTTP '+r.status+' for '+method);
 const j=await r.json();
 if(j.error)throw Error(method+': '+(j.error.message??JSON.stringify(j.error)).slice(0,1500));
 return j.result;
}
async function read(name,args=[]){
 const raw=await rpc('eth_call',[{to:COLLECTION,data:readAbi.encodeFunctionData(name,args)},'latest']);
 return readAbi.decodeFunctionResult(name,raw)[0];
}
async function sendLocal(owner,ids){
 const data=writeAbi.encodeFunctionData('multiConfigure',[COLLECTION,makeAtomicMintConfig(ids,owner)]);
 if(data.slice(0,10)!==CONFIGURER_SELECTOR)throw Error('Mismatching verified configurer selector');
 const gasHex=await rpc('eth_estimateGas',[{from:owner,to:CONFIGURER,data}]);
 const gasEstimated=parseInt(gasHex,16);
 const hash=await rpc('eth_sendTransaction',[{
  from:owner,to:CONFIGURER,data,gas:'0x'+(gasEstimated*2).toString(16)
 }]);
 let receipt=null;
 for(let t=0;t<50;t++){
  receipt=await rpc('eth_getTransactionReceipt',[hash]);
  if(receipt)break;
  await new Promise(done=>setTimeout(done,200));
 }
 if(!receipt){
  await rpc('anvil_mine',[1]);
  receipt=await rpc('eth_getTransactionReceipt',[hash]);
 }
 if(!receipt||receipt.status!=='0x1')throw Error('Fork transaction failed: '+JSON.stringify(receipt));
 return {hash,gas_used:parseInt(receipt.gasUsed,16),gas_estimated:gasEstimated,
  event_count:receipt.logs?.length??0,selector:CONFIGURER_SELECTOR};
}
async function main(){
 const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
 const reportPath=resolve(ROOT,'reports/atomic-fork-proof.json');
 // A failed rerun must NEVER leave a stale green proof.
 await rm(reportPath,{force:true});
 if(!process.argv.includes('--local-fork-only'))
   throw Error('Explicit --local-fork-only required.');
 const anvil=await rpc('anvil_nodeInfo',[]);
 const localChainId=await rpc('eth_chainId');
 const deployedCollection=await rpc('eth_getCode',[COLLECTION,'latest']);
 const forkIdentity=verifyPolygonForkIdentity(anvil,localChainId,deployedCollection);
 const [owner,configurerOnChain,originalURI]=await Promise.all([
  read('owner'),read('configurer'),read('baseURI')
 ]);
 const originalToken1={maxSupply:String(await read('maxSupply',[1])),
  totalSupply:String(await read('totalSupply',[1])),
  totalMinted:String(await read('totalMinted',[1]))};
 if(configurerOnChain.toLowerCase()!==CONFIGURER)throw Error('Unexpected on-chain configurer');
 const deployedCode=await rpc('eth_getCode',[CONFIGURER,'latest']);
 if(deployedCode==='0x')throw Error('Configurer bytecode missing');
 await rpc('anvil_impersonateAccount',[owner]);
 await rpc('anvil_setBalance',[owner,'0x56bc75e2d63100000']);
 const results=[];
 for(const amount of [1,5,10]){
  const ids=Array.from({length:amount},(_,i)=>String(20+i));
  for(const id of ids){
    const [max,minted,supply]=await Promise.all([
      read('maxSupply',[id]),read('totalMinted',[id]),read('totalSupply',[id])
    ]);
    if(max!==0n||minted!==0n||supply!==0n)throw Error('Refuse occupied future token ID '+id);
  }
  const snap=await rpc('evm_snapshot',[]);
  const tx=await sendLocal(owner,ids);
  for(const id of ids){
    const [max,minted,supply]=await Promise.all([
      read('maxSupply',[id]),read('totalMinted',[id]),read('totalSupply',[id])
    ]);
    if(max!==1n||minted!==1n||supply!==1n)
      throw Error('After configurer tx unexpected state on ID '+id);
  }
  if(await read('baseURI')!==originalURI)
   throw Error('Fork mint unexpectedly changed historic baseURI');
  if(String(await read('maxSupply',[1]))!==originalToken1.maxSupply||
     String(await read('totalSupply',[1]))!==originalToken1.totalSupply||
     String(await read('totalMinted',[1]))!==originalToken1.totalMinted)
   throw Error('Fork mint unexpectedly modified historic token #1');
  results.push({tokens:amount,tx_count:1,...tx,
    observed_max_supply:'1 each',observed_total_minted:'1 each'});
  if(!(await rpc('evm_revert',[snap])))throw Error('Local snapshot not restored');
 }
 const abiSource=await readFile(resolve(ROOT,'scripts/lib/opensea-configurer.mjs'));
 const proof={
  status:'LOCAL_ATOMIC_FORK_PROOF_PASSED',created_at:new Date().toISOString(),
  scope:'LOCAL_ANVIL_FORK_ONLY',chain_id:137,collection:COLLECTION,
  fork_identity:forkIdentity,
  configurer:CONFIGURER,selector:CONFIGURER_SELECTOR,
  abi_source_sha256:createHash('sha256').update(abiSource).digest('hex'),
  configurer_bytecode_keccak256:keccak256(deployedCode),
  owner_impersonated_on_local_fork:owner,
  historic_base_uri_unchanged:true,historic_token_1_unchanged:true,
  public_polygon_transactions:0,
  results,
  warning:'Anvil fork proof only, NOT control of the live owner wallet or approval to change metadata.'
 };
 await mkdir(dirname(reportPath),{recursive:true});
 await writeFile(reportPath,JSON.stringify(proof,null,2)+'\n','utf8');
 console.log(JSON.stringify({status:proof.status,
  output:'reports/atomic-fork-proof.json',
  scope:proof.scope,collection:COLLECTION,configurer:CONFIGURER,
  gas_by_batch:proof.results.map(x=>({tokens:x.tokens,gas_used:x.gas_used})),
  historic_base_uri_unchanged:true,public_polygon_transactions:0
 },null,2));
}
main().catch(e=>{console.error('LOCAL ATOMIC MINT TEST STOPPED: '+e.message);process.exitCode=1});
