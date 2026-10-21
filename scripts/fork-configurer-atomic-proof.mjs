#!/usr/bin/env node
/**
 * Local Anvil fork ONLY. Atomic OpenSea configurer batch mint test.
 * No network transaction signing/broadcast to Polygon mainnet.
 * Start local Anvil: anvil --fork-url https://polygon.drpc.org --chain-id 137
 * Then run npm run nft:fork:atomic
 */
import {Interface} from 'ethers';
import {CONFIGURER,CONFIGURER_ABI,CONFIGURER_SELECTOR,COLLECTION,makeAtomicMintConfig}
  from './lib/opensea-configurer.mjs';
const RPC='http://127.0.0.1:8545'; // deliberately hard-coded localhost.
const readAbi=new Interface([
 'function owner() view returns(address)',
 'function configurer() view returns(address)',
 'function totalSupply(uint256) view returns(uint256)',
 'function totalMinted(uint256) view returns(uint256)',
 'function maxSupply(uint256) view returns(uint256)'
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
 if(!process.argv.includes('--local-fork-only'))
   throw Error('Explicit --local-fork-only required.');
 const anvil=await rpc('anvil_nodeInfo',[]);
 if(!anvil||typeof anvil!=='object')throw Error('Not an Anvil local node');
 if(BigInt(await rpc('eth_chainId'))!==137n)throw Error('Local fork must represent Polygon 137');
 const [owner,configurerOnChain]=await Promise.all([read('owner'),read('configurer')]);
 if(configurerOnChain.toLowerCase()!==CONFIGURER)throw Error('Unexpected on-chain configurer');
 if((await rpc('eth_getCode',[CONFIGURER,'latest']))==='0x')throw Error('Configurer bytecode missing');
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
  results.push({tokens:amount,tx_count:1,...tx,
    observed_max_supply:'1 each',observed_total_minted:'1 each'});
  if(!(await rpc('evm_revert',[snap])))throw Error('Local snapshot not restored');
 }
 console.log(JSON.stringify({scope:'LOCAL_ANVIL_FORK_ONLY',collection:COLLECTION,
  configurer:CONFIGURER,owner_impersonated_on_local_fork:owner,
  public_polygon_transactions:0,results,
  note:'Fork proof only. Metadata availability, ownership, gas fees and old NFTs must be verified before mainnet.'
 },null,2));
}
main().catch(e=>{console.error('LOCAL ATOMIC MINT TEST STOPPED: '+e.message);process.exitCode=1});
