#!/usr/bin/env node
/**
 * Builds a proposed ERC-1155 transaction plan. Only reads/writes local JSON.
 * NEVER signs, sends transactions, updates baseURI, or uploads to OpenSea.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildMintPlan} from './lib/mint-plan.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
let size=10,start=0,count=null,recipient=null,releasePath=null;
for(let i=0;i<process.argv.slice(2).length;i++){
 const args=process.argv.slice(2);
 const key=args[i],v=args[i+1];
 if(!['--batch-size','--start','--count','--recipient','--release-report'].includes(key)||!v)
   throw new Error('Unknown argument '+key+' or missing value');
 i++;
 if(key==='--batch-size')size=Number(v);
 if(key==='--start')start=Number(v);
 if(key==='--count')count=Number(v);
 if(key==='--recipient')recipient=v;
 if(key==='--release-report')releasePath=v;
}
try{
 const snapshot=JSON.parse(await readFile(resolve(ROOT,'data/opensea/observed-2026-10-21.json'),'utf8'));
 const catalog=JSON.parse(await readFile(resolve(ROOT,'reports/staging-mint-plan.json'),'utf8'));
 const release=releasePath?JSON.parse(await readFile(resolve(releasePath),'utf8')):null;
 const plan=buildMintPlan(snapshot,catalog,{batchSize:size,start,count,recipient,release});
 const out=resolve(ROOT,'reports/local-mint-batches.json');
 await mkdir(dirname(out),{recursive:true});
 await writeFile(out,JSON.stringify(plan,null,2)+'\n','utf8');
 console.log(JSON.stringify({
  output:'reports/local-mint-batches.json',mode:plan.mode,
  ...plan.totals,recipient:plan.recipient,
  metadata_release_locally_staged:plan.metadata_release_locally_staged,
  live_transaction_allowed:false
 },null,2));
}catch(e){console.error('MINT PLAN FAILED: '+e.message);process.exitCode=1;}
