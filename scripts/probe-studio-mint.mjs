#!/usr/bin/env node
/**
 * Simulate, NEVER send, ERC1155SeaDrop multiConfigureMint in the EXISTING
 * Polygon collection. Uses the verified Solidity fallback interface, not
 * the incomplete implementation ABI (fallback routes hidden selectors).
 * A passing eth_call is NOT an authorization to mint on mainnet.
 */
import {Interface} from 'ethers';
const CONTRACT='0xead98e12d3836562ea39c6a6ca5ef1292359a862';
const CHAIN_ID=137n;
const RPC=process.env.POLYGON_RPC_URL||'https://polygon.drpc.org';
const CONTRACT_ABI=[
  'function owner() view returns (address)',
  'function configurer() view returns (address)',
  'function multiConfigureMint(address recipient,uint256[] tokenIds,uint256[] amounts)',
  'function totalSupply(uint256) view returns (uint256)',
  'function maxSupply(uint256) view returns (uint256)',
  'function totalMinted(uint256) view returns (uint256)',
  'function baseURI() view returns (string)'
];
const iface=new Interface(CONTRACT_ABI);
async function rpc(method,params){
  const resp=await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(23000)});
  if(!resp.ok)throw new Error('HTTP '+resp.status+' for '+method);
  const body=await resp.json();
  if(body.error)throw new Error(body.error.message||JSON.stringify(body.error));
  if(body.result===undefined)throw new Error('RPC missing result');
  return body.result;
}
async function call(data,from){
  const tx={to:CONTRACT,data};
  if(from)tx.from=from;
  return rpc('eth_call',[tx,'latest']);
}
async function readFn(name,args=[]){
  const raw=await call(iface.encodeFunctionData(name,args));
  return iface.decodeFunctionResult(name,raw);
}
async function simulateMint(from,recipient,id=20n,amount=1n){
  try{
    const data=iface.encodeFunctionData('multiConfigureMint',[recipient,[id],[amount]]);
    const result=await call(data,from);
    return {caller:from,recipient,selector:data.slice(0,10),calldata_length_bytes:(data.length-2)/2,
      eth_call_succeeded:true,result,real_transaction_sent:false};
  }catch(error){
    return {caller:from,recipient,selector:iface.getFunction('multiConfigureMint').selector,
      eth_call_succeeded:false,error:String(error.message).slice(0,550),real_transaction_sent:false};
  }
}
async function main(){
  const chainId=BigInt(await rpc('eth_chainId',[]));
  if(chainId!==CHAIN_ID)throw new Error('Wrong network: '+chainId);
  const bytecode=await rpc('eth_getCode',[CONTRACT,'latest']);
  if(bytecode==='0x')throw new Error('Contract not deployed');
  const owner=(await readFn('owner'))[0];
  const configurer=(await readFn('configurer'))[0];
  const supply20=String((await readFn('totalSupply',[20n]))[0]);
  const supplyLimits={};
  for(const id of [1n,19n,20n,21n]){
    supplyLimits[String(id)]={
      max:String((await readFn('maxSupply',[id]))[0]),
      total_minted:String((await readFn('totalMinted',[id]))[0]),
      current_supply:String((await readFn('totalSupply',[id]))[0])
    };
  }
  const baseURI=(await readFn('baseURI'))[0];
  if(supply20!=='0')throw new Error('Token 20 already has supply '+supply20+'; update read-only test choice manually');
  const result={read_only:true,chain_id:Number(chainId),collection:CONTRACT,
    owner_onchain:owner,configurer_onchain:configurer,token_id_for_simulation_only:'20',
    supply_limits:supplyLimits,base_uri:baseURI,
    supply_before_simulation:supply20,
    function_signature:'multiConfigureMint(address,uint256[],uint256[])',
    derived_selector:iface.getFunction('multiConfigureMint').selector,
    owner_simulation:await simulateMint(owner,owner),
    configurer_simulation:configurer.toLowerCase()===owner.toLowerCase()?null:await simulateMint(configurer,owner),
    source_note:'In verified ERC1155SeaDropContractOffererCloneable fallback this selector calls _onlyOwnerOrConfigurer and _multiConfigureMint.',
    constraints:['No state was changed','Not proof of control over onchain owner private key',
      'No guarantee the IPFS metadata for ID 20 exists','No production mint without approval and metadata migration plan']};
  console.log(JSON.stringify(result,null,2));
}
main().catch(error=>{console.error('READ-ONLY PROBE FAILED: '+error.message);process.exitCode=1;});
