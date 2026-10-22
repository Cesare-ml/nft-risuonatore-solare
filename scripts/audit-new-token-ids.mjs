#!/usr/bin/env node
/**
 * Full read-only Polygon audit for ALL proposed ERC1155 IDs using Multicall3.
 * 2,358 new IDs x (maxSupply,totalMinted,totalSupply), plus IDs 1..19.
 * ~60 eth_call requests instead of thousands of individual RPC requests.
 * No wallet, keys, tx, GitHub Actions, or metadata mutation.
 */
import {Interface, keccak256} from 'ethers';
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {analyzeMintProgress} from './lib/mint-progress.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const PLAN=resolve(ROOT,'reports/staging-mint-plan.json');
const OUT=resolve(ROOT,'reports/onchain-new-ids-audit.json');
const COLLECTION='0xead98e12d3836562ea39c6a6ca5ef1292359a862';
const CONFIGURER='0x864baa13e01d8f9e26549dc91b458cd15e34eb7c';
const MULTICALL='0xca11bde05977b3631167028862be2a173976ca11';
const RPC=process.env.POLYGON_RPC_URL||'https://polygon.drpc.org';
const CHUNK=40;
const INTERFACE=new Interface([
 'function owner() view returns(address)',
 'function configurer() view returns(address)',
 'function maxSupply(uint256) view returns(uint256)',
 'function totalMinted(uint256) view returns(uint256)',
 'function totalSupply(uint256) view returns(uint256)'
]);
const MULTI=new Interface([
 'function aggregate3(tuple(address target,bool allowFailure,bytes callData)[] calls) payable returns (tuple(bool success,bytes returnData)[] returnData)'
]);
const METHODS=['maxSupply','totalMinted','totalSupply'];
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function rpc(method,params){
 for(let attempt=0;attempt<5;attempt++){
  try{
   const res=await fetch(RPC,{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),
    signal:AbortSignal.timeout(35000)
   });
   if([429,502,503,504].includes(res.status))throw Error('Transient RPC HTTP '+res.status);
   if(!res.ok)throw Error('RPC HTTP '+res.status);
   const j=await res.json();
   if(j.error)throw Error('RPC '+method+': '+JSON.stringify(j.error).slice(0,450));
   if(typeof j.result!=='string')throw Error('Malformed RPC response: '+method);
   return j.result;
  }catch(error){
   if(attempt===4)throw error;
   await delay(600*Math.pow(2,attempt));
  }
 }
}
async function direct(method,args,block){
 const raw=await rpc('eth_call',[{
  to:COLLECTION,data:INTERFACE.encodeFunctionData(method,args)
 },block]);
 return INTERFACE.decodeFunctionResult(method,raw)[0];
}
function indexHash(ids){
 return createHash('sha256').update(ids.join(',')).digest('hex');
}
function inspectRow(row){
 const [max,minted,supply]=METHODS.map(k=>BigInt(row[k]));
 const vacant=max===0n&&minted===0n&&supply===0n;
 const historical=(max===1n&&minted>=1n&&supply<=minted);
 return {...row,vacant,historical_consistent:historical};
}
async function auditRange(ids,block){
 const calls=ids.flatMap(id=>METHODS.map(method=>[
  COLLECTION,false,INTERFACE.encodeFunctionData(method,[BigInt(id)])
 ]));
 const raw=await rpc('eth_call',[{to:MULTICALL,data:MULTI.encodeFunctionData('aggregate3',[calls])},block]);
 const results=MULTI.decodeFunctionResult('aggregate3',raw)[0];
 if(results.length!==calls.length)throw Error('Multicall3 response size mismatch');
 const rows=[];
 for(let i=0;i<ids.length;i++){
  const row={token_id:ids[i]};
  for(let k=0;k<3;k++){
   const answer=results[i*3+k];
   if(!answer.success)throw Error('Failed '+METHODS[k]+' on token '+ids[i]);
   row[METHODS[k]]=INTERFACE.decodeFunctionResult(METHODS[k],answer.returnData)[0].toString();
  }
  rows.push(inspectRow(row));
 }
 return rows;
}
async function main(){
 const snapshot=JSON.parse(await readFile(PLAN,'utf8'));
 if(snapshot.mode!=='DRY_RUN_ONLY'||snapshot.pending?.length!==2358||
   snapshot.existing_token_mapping?.length!==19||
   snapshot.target_collection?.contract_address?.toLowerCase()!==COLLECTION)
   throw Error('Expected the validated 2358-token plan from this exact collection');
 const newIds=snapshot.pending.map(item=>String(item.proposed_token_id));
 if(new Set(newIds).size!==2358)throw Error('Duplicate proposed token IDs');
 if(newIds.some((id,i)=>id!==String(20+i)))
   throw Error('Proposed IDs changed. Do not infer historical availability.');
 const chain=BigInt(await rpc('eth_chainId',[]));
 if(chain!==137n)throw Error('Wrong chain ID');
 const block=await rpc('eth_blockNumber',[]);
 const [owner,configurer,code,mcCode]=await Promise.all([
  direct('owner',[],block),
  direct('configurer',[],block),
  rpc('eth_getCode',[COLLECTION,block]),
  rpc('eth_getCode',[MULTICALL,block])
 ]);
 if(configurer.toLowerCase()!==CONFIGURER)throw Error('Onchain configurer mismatch');
 if(code==='0x'||mcCode==='0x')throw Error('Expected deployed code missing');
 const allIds=[...Array.from({length:19},(_,i)=>String(i+1)),...newIds];
 const rows=[];
 for(let i=0;i<allIds.length;i+=CHUNK){
  const part=await auditRange(allIds.slice(i,i+CHUNK),block);
  rows.push(...part);
  if((i/CHUNK)%5===0)console.error('Audited '+rows.length+'/'+allIds.length+' IDs at block '+block);
 }
 const prior=rows.slice(0,19),future=rows.slice(19);
 const existingConsistent=prior.every(x=>x.historical_consistent);
 const occupied=future.filter(x=>!x.vacant);
 let progress=null,progress_error=null;
 try{progress=analyzeMintProgress(future)}
 catch(e){progress_error=e.message}
 const report={
  format:'polygon-erc1155-proposed-id-readonly-v1',
  created_at:new Date().toISOString(),read_only:true,chain_id:137,
  contract:COLLECTION,configurer,owner,
  pinned_block_number:Number(BigInt(block)),block_tag:block,
  multicall3_address:MULTICALL,
  plan_sha256:indexHash(newIds),
  existing_checked:prior.length,
  new_ids_checked:future.length,
  existing_consistent:existingConsistent,
  all_proposed_ids_unused:occupied.length===0,
  occupied_new_ids:occupied,
  mint_progress:progress,
  mint_progress_error:progress_error,
  historic:prior,
  new_token_states:future,
  warning:'READ-ONLY POINT-IN-TIME SNAPSHOT; repeat state checks on each ID at signing time. This does not approve a transaction or validate IPFS.'
 };
 const tmp=OUT+'.tmp';
 await mkdir(dirname(OUT),{recursive:true});
 await writeFile(tmp,JSON.stringify(report,null,2)+'\n','utf8');
 await rename(tmp,OUT);
 console.log(JSON.stringify({
  report:'reports/onchain-new-ids-audit.json',chain_id:137,
  block:report.pinned_block_number,existing_consistent:existingConsistent,
  new_ids_checked:future.length,unused:future.length-occupied.length,
  occupied:occupied.length,first_occupied:occupied.slice(0,10),
  completed_prefix:progress?.fully_minted_prefix_count??null,
  next_free_token_id:progress?.first_unminted_token_id??null,
  progress_error,
  owner,configurer,read_only:true
 },null,2));
 if(!existingConsistent||progress_error)process.exitCode=2;
}
main().catch(error=>{console.error('READ-ONLY ID AUDIT FAILED: '+error.message);process.exitCode=1;});
