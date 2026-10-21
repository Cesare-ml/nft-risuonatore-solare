#!/usr/bin/env node
/**
 * Investigate historic OpenSea Studio mints on Polygon. Read-only HTTPS GET.
 * Fetches NFT mint transfer history, relevant public tx, verified source.
 * NEVER signs, never fetches credentials, never sends a blockchain transaction.
 */
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
const CONTRACT='0xead98e12d3836562ea39c6a6ca5ef1292359a862';
const IMPLEMENTATION='0x9f36ee33fd56c7d9a78facd3249c580b1ca464a2';
const EXPLORER='https://polygon.blockscout.com';
const ZERO='0x0000000000000000000000000000000000000000';
async function getJSON(url) {
  const res=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(18000)});
  if(!res.ok) throw new Error('HTTP '+res.status+' '+new URL(url).pathname);
  return res.json();
}
function address(x){
  return (typeof x==='string'?x:x?.hash ?? x?.address ?? '').toLowerCase();
}
function hashOf(x){return x?.hash ?? x?.transaction_hash ?? x?.tx_hash ?? null}
function describeTransfer(t){
  const from=address(t.from);
  return {
    tx:hashOf(t.total?.transaction ?? t.transaction) || t.tx_hash || t.transaction_hash || null,
    block_number:t.block_number || t.block || null, timestamp:t.timestamp || null,
    id:String(t.total?.token_id ?? t.token_ids?.[0] ?? t.token_id ?? t.token?.id ?? ''),
    from, to:address(t.to),
    type:t.token?.type ?? t.type ?? null,
    total:t.total ?? null, amount:t.amount ?? null,
    is_mint:from===ZERO,
  };
}
function cleanTx(t){
  return {
    hash:hashOf(t),block_number:t.block_number,status:t.status,result:t.result,method:t.method,
    from:address(t.from),to:address(t.to),value:t.value,gas_used:t.gas_used,
    input_selector:typeof t.raw_input==='string'?t.raw_input.slice(0,10):
      typeof t.input==='string'?t.input.slice(0,10):null,
    decoded_input: t.decoded_input ?? null,
    transaction_types:t.transaction_types ?? null
  };
}
function extractPrimaryContracts(payload){
  const sources=payload?.sources ?? payload?.stdJsonInput?.sources ?? {};
  const picks={
    'src/clones/ERC1155SeaDropContractOffererCloneable.sol': [[90,235],[310,420]],
    'src/interfaces/IERC1155SeaDrop.sol': [[10,110]],
    'src/clones/ERC1155SeaDropCloneable.sol': [[1,105]]
  };
  const result={};
  for(const [name,ranges] of Object.entries(picks)){
    const source=sources[name];
    const contents=typeof source==='string'?source:source?.content;
    if(typeof contents!=='string')continue;
    const lines=contents.split('\n');
    result[name]=ranges.map(([start,end])=>({start,end,lines:lines.slice(start-1,end).map((text,i)=>({n:start+i,text}))}));
  }
  return result;
}

function keywordsFromSources(payload){
  const sources=payload?.sources ?? payload?.stdJsonInput?.sources ?? payload?.creationBytecode?.sources ?? {};
  const results=[];
  for(const [name,source] of Object.entries(sources)){
    const code=typeof source==='string'?source:source?.content;
    if(typeof code!=='string')continue;
    const lines=code.split('\n');
    const matches=[];
    for(let i=0;i<lines.length;i++){
      if(/\b(mint|createToken|tokenCreator|auth|factory|_mint|authorized|operator|fallback)\b/i.test(lines[i])){
        matches.push({line:i+1,excerpt:lines[i].trim().slice(0,260)});
      }
    }
    results.push({name,bytes:code.length,matches:matches.slice(0,35),total_match_lines:matches.length});
  }
  return results;
}
async function run(){
  const report={date:new Date().toISOString(),read_only:true,chain_id:137,contract:CONTRACT,
    implementation:IMPLEMENTATION,source_endpoints:[],errors:[],token_transfer_summary:null,
    sampled_transactions:[],verified_source:null,decision:'mint mechanism not yet established'};
  const explorerUrls=[
    EXPLORER+'/api/v2/tokens/'+CONTRACT+'/transfers',
    EXPLORER+'/api/v2/tokens/'+CONTRACT+'/instances/1/transfers',
    EXPLORER+'/api/v2/addresses/'+CONTRACT+'/transactions'
  ];
  let transferData=null;
  for(const url of explorerUrls){
    try{
      const data=await getJSON(url);
      report.source_endpoints.push({url,status:'ok',items:data.items?.length??null});
      if(url===explorerUrls[0]){
        transferData=data;
        const transfers=(data.items??[]).map(describeTransfer);
        report.token_transfer_summary={
          number_returned:transfers.length, next_page_available:!!data.next_page_params,
          mint_items:transfers.filter(x=>x.is_mint),sample:transfers.slice(0,5)
        };
      }else if(url===explorerUrls[1]){
        report.token_1_history=(data.items??[]).slice(0,25).map(describeTransfer);
      }else{
        report.contract_recent_transactions=(data.items??[]).slice(0,8).map(cleanTx);
      }
    }catch(e){report.source_endpoints.push({url,status:'error'});report.errors.push(String(e.message))}
  }
  const transactions=[
    ...(report.token_transfer_summary?.mint_items??[]).map(t=>t.tx),
    ...(report.token_1_history??[]).filter(t=>t.is_mint).map(t=>t.tx)
  ].filter(Boolean);
  for(const hash of [...new Set(transactions)].slice(0,5)){
    const url=EXPLORER+'/api/v2/transactions/'+hash;
    try{
      const j=await getJSON(url);
      report.sampled_transactions.push(cleanTx(j));
      report.source_endpoints.push({url,status:'ok'});
    }catch(e){report.errors.push(String(e.message))}
  }
  const sourceUrl='https://sourcify.dev/server/v2/contract/137/'+IMPLEMENTATION+'?fields=all';
  try{
    const j=await getJSON(sourceUrl);
    report.verified_source={match:j.match??null,contract_name:j.name??j.contractIdentifier??null,
      compiler:j.compiler??null,source_files:keywordsFromSources(j),
      source_file_count:Object.keys(j.sources??j.stdJsonInput?.sources??{}).length,
      source_focus:extractPrimaryContracts(j),
      abi_functions:(j.abi??[]).filter(x=>x.type==='function').map(x=>({
        name:x.name,inputs:(x.inputs??[]).map(i=>i.type),mutability:x.stateMutability
      }))};
    report.source_endpoints.push({url:sourceUrl,status:'ok'});
  }catch(e){report.errors.push(String(e.message));report.source_endpoints.push({url:sourceUrl,status:'error'})}
  if(report.sampled_transactions.length){
    report.decision='MINT TRANSACTIONS FOUND: Inspect transaction destinations, selector and issuer role BEFORE attempting any write';
  }
  const out=resolve('reports/opensea-studio-forensics.json');
  await mkdir(dirname(out),{recursive:true});
  await writeFile(out,JSON.stringify(report,null,2)+'\n','utf8');
  console.log(JSON.stringify({
    readonly:true,source_focus:report.verified_source?.source_focus,transfer_summary:report.token_transfer_summary,
    token_1_history:report.token_1_history,
    sample_txs:report.sampled_transactions,
    verified_source:report.verified_source,
    errors:report.errors,decision:report.decision
  },null,2));
}
run().catch(e=>{console.error('FORENSICS FAILED: '+e.message);process.exitCode=1});
