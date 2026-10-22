#!/usr/bin/env node
/**
 * NFT Windows preflight doctor. Offline/local only, zero transactions or uploads.
 * Reports executable prerequisites and what is still missing. Exit zero even
 * with expected blockers: this is an informational tool, not an authorization.
 */
import {readFile,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {evaluateReadiness} from './lib/publish-readiness.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const pathFor=s=>resolve(ROOT,s);
async function readOptional(path){
 try{return await readFile(pathFor(path))}
 catch{return null}
}
function executable(command,parameters=['--version']){
 const p=spawnSync(command,parameters,{encoding:'utf8',windowsHide:true,timeout:8000});
 return {
  installed:!p.error&&p.status===0,
  version:(!p.error&&p.status===0)?(p.stdout||p.stderr||'').trim().split('\n')[0].slice(0,110):null,
  note:p.error?.code==='ENOENT'?'not found on PATH':p.error?.message??(p.status!==0?'exit '+p.status:null)
 };
}
async function main(){
 const [catalog,plan,remote,chain,releaseBytes,forkRaw,abiSourceBytes]=await Promise.all([
  readOptional('reports/staging-mint-plan.json'),
  readOptional('reports/local-mint-batches.json'),
  readOptional('reports/ipfs-public-verification.json'),
  readOptional('reports/onchain-new-ids-audit.json'),
  readOptional('reports/solar-release-staging/release-report.json'),
  readOptional('reports/atomic-fork-proof.json'),
  readOptional('scripts/lib/opensea-configurer.mjs')
 ]);
 function parseOrNull(b){if(!b)return null;try{return JSON.parse(b.toString('utf8'))}catch{return null}}
 const contents={
  catalog:parseOrNull(catalog),plan:parseOrNull(plan),remote:parseOrNull(remote),
  chain:parseOrNull(chain),releaseBytes,
  forkProof:parseOrNull(forkRaw),abiSourceBytes
 };
 const report={
  mode:'LOCAL_READ_ONLY_DIAGNOSTICS',
  current_node:process.version,
  prerequisites:{
   node_18_or_later:Number(process.versions.node.split('.')[0])>=18,
   ipfs_kubo:executable('ipfs',['version']),
   anvil_local_fork:executable('anvil',['--version']),
   ethers_library:!!(await access(pathFor('node_modules/ethers')).then(()=>true).catch(()=>false))
  },
  files:{
   catalog_present:!!catalog,
   atomic_mint_plan_present:!!plan,
   historical_release_report_present:!!releaseBytes,
   all_token_ids_audit_present:!!chain,
   remote_ipfs_verification_present:!!remote,
   atomic_anvil_fork_proof_present:!!forkRaw
  },
  next_steps:[],
  signing_permitted_by_doctor:false
 };
 // Doctor does not run the expensive hash verification itself. It can only
 // report readiness blockers: publishing always performs full verify itself.
 const checks=evaluateReadiness({
  plan:contents.plan,catalog:contents.catalog,releaseBytes,
  chain:contents.chain,remote:contents.remote,
  forkProof:contents.forkProof,abiSourceBytes:contents.abiSourceBytes,
  localVerified:false,enableSigning:false
 });
 report.gates=checks;
 if(!report.prerequisites.ipfs_kubo.installed)
   report.next_steps.push('Install IPFS Kubo and start its daemon for CID verified metadata recovery.');
 if(!report.files.catalog_present)report.next_steps.push('npm run nft:plan');
 if(report.files.catalog_present&&!report.files.historical_release_report_present)
   report.next_steps.push('npm run nft:ipfs:recover; inspect 19 historic JSON files, then explicitly run staging.');
 if(!report.files.all_token_ids_audit_present)report.next_steps.push('npm run nft:ids:audit');
 if(!report.files.remote_ipfs_verification_present)
   report.next_steps.push('Once IPFS staging is complete: npm run nft:ipfs:public');
 if(!report.files.atomic_anvil_fork_proof_present)
   report.next_steps.push('Run local Anvil fork: npm run nft:fork:atomic (never mainnet).');
 if(!report.prerequisites.anvil_local_fork.installed)
   report.next_steps.push('Install Foundry Anvil and run the local fork test before any real mint.');
 if(!report.prerequisites.ethers_library)
   report.next_steps.push('npm install');
 console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error('LOCAL DOCTOR ERROR: '+e.message);process.exitCode=1});
