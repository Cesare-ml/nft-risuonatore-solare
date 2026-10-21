#!/usr/bin/env node
/* PROOF ON LOCAL ANVIL FORK ONLY. Sends NO live Polygon transactions. */
import {Interface} from 'ethers';
const LOCAL='http://127.0.0.1:8545';
const CONTRACT='0xead98e12d3836562ea39c6a6ca5ef1292359a862';
const abi=new Interface([
  'function owner() view returns(address)',
  'function totalSupply(uint256) view returns(uint256)',
  'function maxSupply(uint256) view returns(uint256)',
  'function setMaxSupply(uint256,uint256)',
  'function multiConfigureMint(address,uint256[],uint256[])'
]);
async function rpc(method,params=[]){
 const res=await fetch(LOCAL,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(25000)});
 if(!res.ok)throw new Error('LOCAL RPC HTTP '+res.status+' on '+method);
 const j=await res.json();
 if(j.error)throw new Error(method+' '+JSON.stringify(j.error).slice(0,1500));
 return j.result;
}
async function read(name,args=[]){
 const encoded=abi.encodeFunctionData(name,args);
 const raw=await rpc('eth_call',[{to:CONTRACT,data:encoded},'latest']);
 return abi.decodeFunctionResult(name,raw)[0];
}
async function sendLocal(from,name,args){
 const info=await rpc('anvil_nodeInfo',[]);
 if(!info?.forkConfig && !info?.forkConfig?.forkUrl) {
   // Assert anvil method exists. When using fork the object may be absent for
   // certain Anvil versions; verify chain and bytecode separately below.
 }
 const hash=await rpc('eth_sendTransaction',[{to:CONTRACT,from,data:abi.encodeFunctionData(name,args),
   gas:'0x4c4b40'}]);
 const receipt=await rpc('eth_getTransactionReceipt',[hash]);
 if(!receipt || receipt.status!=='0x1')throw new Error('Local fork receipt status != success: '+JSON.stringify(receipt));
 return {method:name,hash,gas_used:parseInt(receipt.gasUsed,16),
   emitted_events:receipt.logs?.length??0};
}
async function main(){
 // The method below MUST exist. Real public Polygon nodes reject it.
 const info=await rpc('anvil_nodeInfo',[]);
 if(!info || typeof info!=='object')throw new Error('Not an Anvil instance');
 const chain=BigInt(await rpc('eth_chainId',[]));
 if(chain!==137n)throw new Error('Wrong fork chain '+chain);
 const code=await rpc('eth_getCode',[CONTRACT,'latest']);
 if(code==='0x')throw new Error('Contract missing on fork');
 const owner=await read('owner');
 const id=20n;
 const beforeSupply=String(await read('totalSupply',[id]));
 const beforeMax=String(await read('maxSupply',[id]));
 if(beforeSupply!=='0'||beforeMax!=='0')throw new Error('Fork token #20 is no longer empty; refusing proof');
 await rpc('anvil_impersonateAccount',[owner]);
 await rpc('anvil_setBalance',[owner,'0x56bc75e2d63100000']);
 const set=await sendLocal(owner,'setMaxSupply',[id,1n]);
 const maxAfter=String(await read('maxSupply',[id]));
 if(maxAfter!=='1')throw new Error('Local setMaxSupply failed');
 const mint=await sendLocal(owner,'multiConfigureMint',[owner,[id],[1n]]);
 const afterSupply=String(await read('totalSupply',[id]));
 if(afterSupply!=='1')throw new Error('Local mint did not update supply');
 console.log(JSON.stringify({scope:'LOCAL_ANVIL_FORK_ONLY',
  polygon_mainnet_modified:false,
  collection:CONTRACT,caller:owner,token_id:'20',
  before:{total_supply:beforeSupply,max_supply:beforeMax},
  after:{total_supply:afterSupply,max_supply:maxAfter},
  local_receipts:[set,mint],
  next_steps:['Verify wallet ownership with user via public wallet address only',
    'Archive all 19 existing metadata bytes; repin new metadata without changing content',
    'Create staging manifest; gas/cost simulation; explicit permission before live actions']
 },null,2));
}
main().catch(e=>{console.error('LOCAL FORK PROOF FAILED: '+e.message);process.exitCode=1;});
