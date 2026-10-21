#!/usr/bin/env node
/**
 * Stage a full IPFS metadata directory for the SAME ERC-1155 contract.
 * DOES NOT mint or change baseURI. Local Kubo/IPFS is required for --stage.
 * Historic 19 JSON blobs are read BYTES from the old CID and written unchanged.
 * New media gets filename RS-Cxxx-Lxx.png (no fragment # in IPFS paths).
 * A pin on a single local Kubo node is NOT a production availability guarantee.
 */
import {readFile,mkdir,writeFile,stat,link,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const OLD_CID='bafybeih7ucalsv5p2xh3zjrslg6fjgz7y3t4q2fivebci56mz3wex4gwj4';
const PLAN=resolve(ROOT,'reports/staging-mint-plan.json');
const STAGE=resolve(ROOT,'reports/solar-release-staging');
const MEDIA=resolve(STAGE,'media');
const METADATA=resolve(STAGE,'metadata');
const ID=n=>BigInt(n).toString(16).padStart(64,'0');
function checksum(buf){return createHash('sha256').update(buf).digest('hex')}
function ipfs(args,opts={}){
  return execFileSync('ipfs',args,{maxBuffer:3*1024*1024,timeout:opts.timeout??1200000,
    encoding:opts.encoding??'utf8',windowsHide:true});
}
function cleanHtml(text){
  return String(text??'')
    .replace(/<br\s*\/?>/gi,'\n').replace(/<\/p>/gi,'\n\n')
    .replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ')
    .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/\n{3,}/g,'\n\n').trim();
}
async function size(path){
  const s=await stat(path);return s.size;
}
async function run(){
  const active=process.argv.includes('--stage');
  const plan=JSON.parse(await readFile(PLAN,'utf8'));
  assert.equal(plan.mode,'DRY_RUN_ONLY');
  assert.equal(plan.pending.length,2358);
  assert.equal(plan.existing_token_mapping.length,19);
  assert.equal(plan.target_collection.contract_address.toLowerCase(),
    '0xead98e12d3836562ea39c6a6ca5ef1292359a862');
  if(!active){
    console.log(JSON.stringify({mode:'SAFE_PREFLIGHT_ONLY',plan_items:plan.pending.length,
      existing_items:plan.existing_token_mapping.length,
      instruction:'For deliberate local IPFS pinning, run: node scripts/stage-ipfs-release.mjs --stage',
      caveat:'No production mint or baseURI update is performed by this script.'},null,2));
    return;
  }
  // Never use gateway HTTP as a substitute if it returns 429; prefer local Kubo.
  const version=ipfs(['version'],{timeout:12000}).trim();
  console.error('Using '+version);
  await mkdir(MEDIA,{recursive:true});
  await mkdir(METADATA,{recursive:true});
  const archived={};
  for(const item of plan.existing_token_mapping){
    const filename=ID(item.token_id);
    const raw=ipfs(['cat',OLD_CID+'/'+filename],{encoding:'buffer',timeout:240000});
    const obj=JSON.parse(raw.toString('utf8'));
    if(!obj || typeof obj!=='object' || !obj.name || !obj.image) {
      throw new Error('Historic metadata missing required name/image at token #'+item.token_id);
    }
    const saved=resolve(METADATA,filename);
    await writeFile(saved,raw);
    archived[filename]={bytes:raw.length,sha256:checksum(raw),name:obj.name,image:obj.image};
  }
  // Put each pending media under safe, unique filename. Hardlinks avoid duplicate
  // ~900 MB allocation; report an error if the filesystem forbids hardlinking.
  for(const item of plan.pending){
    const original=resolve(ROOT,item.image_path);
    const target=resolve(MEDIA,item.artwork_id+'.png');
    try {await link(original,target)}
    catch(e){
      if(e.code==='EEXIST'){
        if(await size(original)!==await size(target))
          throw new Error('Existing staged media differs in size: '+item.artwork_id);
      }else{
        throw new Error('Hardlink staging failed for '+item.artwork_id+
          '. Keep reports/ on same filesystem as nft-imgs/. '+e.message);
      }
    }
  }
  const stagedMedia=await readdir(MEDIA);
  if(stagedMedia.length!==2358)throw new Error('Staged media count differs from 2,358');
  // Upload/pin new media directory to local IPFS only.
  console.error('Adding media to local Kubo (may use about 900 MB).');
  const mediaCID=ipfs(['add','-Q','-r','--cid-version=1',MEDIA],{timeout:7200000}).trim().split(/\s+/).at(-1);
  if(!/^bafy[a-z2-7]+$/.test(mediaCID))throw new Error('Unexpected CID from Kubo media upload');
  for(const item of plan.pending){
    const json={
      name:item.name,
      description:cleanHtml(item.description_color_it)+'\n\n'+cleanHtml(item.description_depth_it),
      image:'ipfs://'+mediaCID+'/'+item.artwork_id+'.png',
      external_url:'https://nft.mirkolancerotto.it/nft-colors.html',
      attributes:[
        {trait_type:'Colore',value:item.name.split(' — ')[1]},
        {trait_type:'ID colore',value:item.color_id},
        {trait_type:'Codice HEX',value:item.color_hex},
        {trait_type:'Categoria',value:item.category},
        {trait_type:'Profondità',value:item.depth},
        {trait_type:'ID opera',value:item.artwork_id}
      ]
    };
    await writeFile(resolve(METADATA,item.proposed_metadata_filename),
      JSON.stringify(json,null,2)+'\n','utf8');
  }
  const stagedMetadatas=await readdir(METADATA);
  if(stagedMetadatas.length!==2377)throw new Error('Staged metadata count differs from 2,377');
  // A full new directory includes historic JSON unchanged + proposed new token IDs.
  const metadataCID=ipfs(['add','-Q','-r','--cid-version=1',METADATA],{timeout:7200000}).trim().split(/\s+/).at(-1);
  if(!/^bafy[a-z2-7]+$/.test(metadataCID))throw new Error('Unexpected metadata CID');
  // Re-check exact original JSON byte preservation via local Kubo read.
  for(const [filename,info] of Object.entries(archived)){
    const raw=ipfs(['cat',metadataCID+'/'+filename],{encoding:'buffer',timeout:120000});
    if(checksum(raw)!==info.sha256)
      throw new Error('HISTORIC JSON HASH MISMATCH: token '+filename);
  }
  const report={
    status:'LOCAL_IPFS_STAGING_COMPLETE',production_approved:false,chain_modified:false,
    old_base_uri:'ipfs://'+OLD_CID+'/{id}',
    proposed_base_uri:'ipfs://'+metadataCID+'/{id}',media_cid:mediaCID,
    historic_json_preserved_byte_identical:19,pending_artworks:2358,
    metadata_files:2377,archived,
    warnings:[
      'New baseURI changes on-chain references for existing NFT holders even with identical JSON bytes.',
      'Verify all historic image URIs and cross-check pinned media reachability before any signing.',
      'Ensure remote pin redundancy; a single local Kubo pin is not durable global storage.',
      'Do not execute setBaseURI without explicit curator approval and separate review of contract permissions.',
      'Allocate and validate all candidate token IDs onchain before any batch mint.'
    ]
  };
  await writeFile(resolve(STAGE,'release-report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,media_cid:mediaCID,
    proposed_base_uri:report.proposed_base_uri,
    historic_json_preserved_byte_identical:19,metadata_files:2377,
    chain_modified:false,production_approved:false},null,2));
}
run().catch(e=>{console.error('IPFS STAGING STOPPED: '+e.message);process.exitCode=1});
