#!/usr/bin/env node
/**
 * Validate an IPFS staging release before ANY contract metadata changes.
 * No network requests, wallet, secrets, or transactions. Node >= 18.
 *
 * Usage: node scripts/verify-ipfs-release.mjs [--directory reports/solar-release-staging]
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGINAL_CID='bafybeih7ucalsv5p2xh3zjrslg6fjgz7y3t4q2fivebci56mz3wex4gwj4';
const ORIGINAL_URI='ipfs://'+ORIGINAL_CID+'/{id}';
const PLAN=resolve(ROOT,'reports/staging-mint-plan.json');
function id64(id){return BigInt(id).toString(16).padStart(64,'0')}
function sha(data){return createHash('sha256').update(data).digest('hex')}
function requireCondition(ok,msg){if(!ok)throw new Error(msg)}
function isCid(c){return /^bafy[a-z2-7]+$/.test(c)}
function parseArgs(argv){
 let directory='reports/solar-release-staging';
 for(let i=0;i<argv.length;i++){
   if(argv[i]==='--directory' && argv[i+1])directory=argv[++i];
   else throw new Error('Usage: node scripts/verify-ipfs-release.mjs [--directory PATH]');
 }
 return resolve(directory);
}
async function main(){
 const stage=parseArgs(process.argv.slice(2));
 const [plan,report]=await Promise.all([
   readFile(PLAN,'utf8').then(JSON.parse),
   readFile(join(stage,'release-report.json'),'utf8').then(JSON.parse)
 ]);
 requireCondition(plan.mode==='DRY_RUN_ONLY','Unexpected input plan mode');
 requireCondition(plan.pending.length===2358 && plan.existing_token_mapping.length===19,
   'Input catalog counts changed: re-audit before publication');
 requireCondition(report.status==='LOCAL_IPFS_STAGING_COMPLETE' && report.production_approved===false &&
   report.chain_modified===false,'Release report not a safe local staging record');
 requireCondition(report.old_base_uri===ORIGINAL_URI,'Historic base URI mismatch');
 const expectedPrefix='ipfs://';
 requireCondition(report.proposed_base_uri?.startsWith(expectedPrefix) && report.proposed_base_uri.endsWith('/{id}'),
   'Bad proposed URI');
 const metadataCID=report.proposed_base_uri.slice(expectedPrefix.length,-'/{id}'.length);
 requireCondition(isCid(metadataCID),'Invalid metadata CID');
 requireCondition(isCid(report.media_cid),'Invalid media CID');
 requireCondition(report.proposed_base_uri!==report.old_base_uri,'Staged metadata CID unchanged');
 const metaDir=join(stage,'metadata');
 const mediaDir=join(stage,'media');
 const metaFiles=await readdir(metaDir);
 const mediaFiles=await readdir(mediaDir);
 requireCondition(metaFiles.length===2377,'Expected 2,377 metadata files');
 requireCondition(mediaFiles.length===2358,'Expected 2,358 media files');
 requireCondition(Object.keys(report.archived??{}).length===19,'Historic archive must contain 19 JSON documents');

 const historic=[];
 for(const item of plan.existing_token_mapping){
   const filename=id64(item.token_id);
   const source=await readFile(join(metaDir,filename));
   const archived=report.archived[filename];
   requireCondition(!!archived,'Missing history proof '+filename);
   requireCondition(sha(source)===archived.sha256 && source.length===archived.bytes,
     'Historic bytes differ from original checkpoint token '+item.token_id);
   const parsed=JSON.parse(source.toString('utf8'));
   requireCondition(parsed.name===archived.name && parsed.image===archived.image,
     'Historic metadata not identical to report token '+item.token_id);
   historic.push({id:item.token_id,sha256:archived.sha256,bytes:source.length});
 }
 const proposed=new Set();
 for(const item of plan.pending){
   const filename=item.proposed_metadata_filename;
   requireCondition(!proposed.has(filename),'Duplicate future metadata filename');
   proposed.add(filename);
   const meta=JSON.parse(await readFile(join(metaDir,filename),'utf8'));
   const image='ipfs://'+report.media_cid+'/'+item.artwork_id+'.png';
   requireCondition(meta.name===item.name && meta.image===image,
     'Bad metadata for proposed token '+item.proposed_token_id);
   requireCondition(meta.attributes?.some(a=>a.trait_type==='ID opera' && a.value===item.artwork_id),
     'Missing artwork ID trait for '+item.artwork_id);
   const pngPath=join(mediaDir,item.artwork_id+'.png');
   const s=await stat(pngPath);
   requireCondition(s.isFile()&&s.size>0,'Missing PNG for '+item.artwork_id);
   const [source,staged]=await Promise.all([
     readFile(resolve(ROOT,item.image_path)),
     readFile(pngPath)
   ]);
   requireCondition(source.length===staged.length && sha(source)===sha(staged),
     'Staged PNG differs from source artwork '+item.artwork_id);
 }
 requireCondition(proposed.size===2358,'Not enough future token metadata');
 const data={
   result:'LOCAL_RELEASE_VERIFIED',
   checked_existing_json_count:historic.length,
   checked_new_json_count:proposed.size,
   checked_media_count:mediaFiles.length,
   metadata_base_uri:report.proposed_base_uri,
   media_cid:report.media_cid,
   historic_hashes:historic,
   scope:'local files only; IPFS network availability, pinned replicas and on-chain state NOT verified',
   production_transaction_authorized:false
 };
 console.log(JSON.stringify(data,null,2));
}
main().catch(error=>{console.error('RELEASE VERIFICATION FAILED: '+error.message);process.exitCode=1;});
