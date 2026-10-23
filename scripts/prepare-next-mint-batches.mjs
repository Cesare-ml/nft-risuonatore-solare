#!/usr/bin/env node
/**
 * npm run nft:mint:resume -- --batch-size 10 --count 100
 * Reads the last COMPLETE Polygon ID audit, refuses gaps/unusual supply,
 * writes only an OFFLINE transaction draft for the next untouched IDs.
 * NEVER creates transactions or sends keys.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildMintPlan,COLLECTION,CONFIGURER} from './lib/mint-plan.mjs';
import {analyzeMintProgress} from './lib/mint-progress.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const readJSON=path=>readFile(resolve(ROOT,path),'utf8').then(JSON.parse);
const sha=s=>createHash('sha256').update(s).digest('hex');
const args=process.argv.slice(2);
let batchSize=10,count=100,recipient=null,releaseReport='reports/solar-release-staging/release-report.json';
for(let i=0;i<args.length;i++){
 const flag=args[i],value=args[++i];
 if(value===undefined)throw Error('Missing argument value for '+flag);
 if(flag==='--batch-size')batchSize=Number(value);
 else if(flag==='--count')count=Number(value);
 else if(flag==='--recipient')recipient=value;
 else if(flag==='--release-report')releaseReport=value;
 else throw Error('Unknown argument '+flag);
}
async function run(){
 if(!Number.isSafeInteger(count)||count<1||count>2358)
  throw Error('Count must be 1..2358');
 const [snapshot,catalog,audit,release]=await Promise.all([
  readJSON('data/opensea/observed-2026-10-21.json'),
  readJSON('reports/staging-mint-plan.json'),
  readJSON('reports/onchain-new-ids-audit.json'),
  readJSON(releaseReport).catch(()=>null)
 ]);
 const ids=catalog.pending.map(x=>String(x.proposed_token_id));
 const received=Date.parse(audit.created_at);
 if(!Number.isFinite(received)||received>Date.now()||
   Date.now()-received>12*3600000)
  throw Error('Polygon ID audit expired: rerun npm run nft:ids:audit');
 if(audit.chain_id!==137||audit.read_only!==true||
   audit.contract?.toLowerCase()!==COLLECTION||
   audit.configurer?.toLowerCase()!==CONFIGURER||
   audit.existing_checked!==19||audit.new_ids_checked!==2358||
   audit.existing_consistent!==true||
   audit.plan_sha256!==sha(ids.join(',')))
  throw Error('Polygon ID audit does not match the original collection/catalog');
 const progress=analyzeMintProgress(audit.new_token_states);
 if(progress.remaining_token_count===0){
   console.log('All 2358 proposed token IDs have supply 1; reconcile receipts and holders before claiming completion.');
   return;
 }
 const draft=buildMintPlan(snapshot,catalog,{
   start:progress.fully_minted_prefix_count,
   count:Math.min(count,progress.remaining_token_count),
   batchSize,recipient,release
 });
 const out=resolve(ROOT,'reports/local-mint-batches.json');
 await mkdir(dirname(out),{recursive:true});
 await writeFile(out,JSON.stringify(draft,null,2)+'\n','utf8');
 console.log(JSON.stringify({
  result:'OFFLINE_NEXT_BATCHES_PREPARED',
  output:'reports/local-mint-batches.json',
  first_token_id:draft.selected_token_ids[0],
  last_token_id:draft.selected_token_ids.at(-1),
  ...progress,planned_count:draft.totals.selected,
  atomic_transactions:draft.totals.expected_total_transactions,
  local_release_staged:draft.metadata_release_locally_staged,
  signing_authorized:false
 },null,2));
}
run().catch(e=>{console.error('RESUME STOPPED: '+e.message);process.exitCode=1;});
