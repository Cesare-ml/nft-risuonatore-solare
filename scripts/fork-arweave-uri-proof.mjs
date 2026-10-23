#!/usr/bin/env node
/**
 * 100% LOCAL Polygon Anvil fork proof for an Arweave ERC1155 baseURI.
 * Tests actual owner-only setBaseURI on fork, URI for old/current token IDs,
 * then ALWAYS reverts to the original chain state. No private key or mainnet.
 *
 * anvil --fork-url https://polygon.drpc.org --chain-id 137
 * npm run nft:fork:arweave
 */
import {Interface} from 'ethers';
import {readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {COLLECTION,ARWEAVE_ID,HEX_ID} from './lib/arweave-release.mjs';
import {verifyPolygonForkIdentity} from './lib/fork-provenance.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const RPC='http://127.0.0.1:8545';
const REPORT=resolve(ROOT,'reports/arweave-one-time/baseuri-fork-proof.json');
const iface=new Interface([
 'function owner() view returns(address)',
 'function baseURI() view returns(string)',
 'function uri(uint256) view returns(string)',
 'function totalSupply(uint256) view returns(uint256)',
 'function totalMinted(uint256) view returns(uint256)',
 'function setBaseURI(string)'
]);
async function rpc(method,params=[]){
 const response=await fetch(RPC,{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),
  signal:AbortSignal.timeout(45000)
 });
 if(!response.ok)throw Error('Local Anvil HTTP '+response.status);
 const data=await response.json();
 if(data.error)throw Error(method+': '+String(data.error.message).slice(0,500));
 return data.result;
}
async function read(name,args=[]){
 const data=iface.encodeFunctionData(name,args);
 const v=await rpc('eth_call',[{to:COLLECTION,data},'latest']);
 return iface.decodeFunctionResult(name,v)[0];
}
async function main(){
 await rm(REPORT,{force:true});
 if(!process.argv.includes('--local-fork-only')||process.argv.length>3)
  throw Error('Only --local-fork-only for explicit localhost Anvil fork is allowed');
 const release=JSON.parse(await readFile(resolve(ROOT,'reports/arweave-one-time/release-report.json'),'utf8'));
 const id=release.manifest_id;
 if(!ARWEAVE_ID.test(id)||release.proposed_base_uri!=='https://arweave.net/'+id+'/{id}')
  throw Error('Prepare a REAL Arweave manifest and release report first');
 const fork=verifyPolygonForkIdentity(await rpc('anvil_nodeInfo'),
  await rpc('eth_chainId'),await rpc('eth_getCode',[COLLECTION,'latest']));
 const owner=await read('owner');
 const beforeURI=await read('baseURI');
 const historic={};
 for(const id of [1,19]){
  historic[id]={minted:String(await read('totalMinted',[id])),
   supply:String(await read('totalSupply',[id]))};
 }
 const snap=await rpc('evm_snapshot');
 let success=false,gasUsed=0;
 try{
  await rpc('anvil_impersonateAccount',[owner]);
  await rpc('anvil_setBalance',[owner,'0x56bc75e2d63100000']);
  const data=iface.encodeFunctionData('setBaseURI',[release.proposed_base_uri]);
  const estimate=BigInt(await rpc('eth_estimateGas',[{
   from:owner,to:COLLECTION,data
  }]));
  const transaction=await rpc('eth_sendTransaction',[{
   from:owner,to:COLLECTION,data,gas:'0x'+(estimate*2n).toString(16)
  }]);
  let receipt=null;
  for(let i=0;i<40;i++){
   receipt=await rpc('eth_getTransactionReceipt',[transaction]);
   if(receipt)break;
   await new Promise(r=>setTimeout(r,150));
  }
  if(!receipt||receipt.status!=='0x1')throw Error('Fork setBaseURI transaction failed');
  gasUsed=Number(BigInt(receipt.gasUsed));
  if(await read('baseURI')!==release.proposed_base_uri)
    throw Error('Contract refused or changed proposed Arweave baseURI');
  for(const id of [1,19,20,2377]){
    const got=await read('uri',[id]);
    const target=release.proposed_base_uri;
    const resolved=target.replace('{id}',HEX_ID(id));
    if(got!==target&&got!==resolved)
      throw Error('ERC1155 token uri('+id+') unexpected: '+got);
  }
  for(const id of [1,19]){
   if(String(await read('totalMinted',[id]))!==historic[id].minted||
     String(await read('totalSupply',[id]))!==historic[id].supply)
    throw Error('Historic token '+id+' mutated during URI fork test');
  }
  success=true;
 }finally{
  if(!(await rpc('evm_revert',[snap])))
   throw Error('FORK SNAPSHOT REVERT FAILED: discard this local fork');
 }
 if(!success)throw Error('Arweave URI fork test unsuccessful');
 if(await read('baseURI')!==beforeURI)
  throw Error('Local Anvil baseURI not restored');
 const result={
  status:'LOCAL_ARWEAVE_BASEURI_FORK_PASSED',
  created_at:new Date().toISOString(),collection:COLLECTION,chain_id:137,
  manifest_id:id,proposed_base_uri:release.proposed_base_uri,
  fork_identity:fork,gas_used:gasUsed,old_uri_restored_after_snapshot:true,
  historic_tokens_unchanged:true,only_local_fork:true,mainnet_transactions:0
 };
 await mkdir(dirname(REPORT),{recursive:true});
 await writeFile(REPORT,JSON.stringify(result,null,2)+'\n','utf8');
 console.log(JSON.stringify({status:result.status,gas_used:result.gas_used,
  manifest_id:result.manifest_id,mainnet_transactions:0,restored:true},null,2));
}
main().catch(e=>{console.error('ARWEAVE FORK URI TEST FAILED: '+e.message);process.exitCode=1});
