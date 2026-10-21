#!/usr/bin/env node
/**
 * Deterministic, offline-only proposed mint plan for the HISTORIC collection.
 * Does NOT write files to chain/IPFS or assume proposed IDs are available.
 * Existing 19 observed token IDs are preserved. 18 unique artworks excluded.
 * Node >=18, no new dependencies. Output is ignored by Git.
 */
import {readFile,readdir,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=resolve(ROOT,'data/opensea/observed-2026-10-21.json');
const out=resolve(ROOT,'reports/staging-mint-plan.json');
const artworkId=(c,l)=>'RS-C'+String(c).padStart(3,'0')+'-L'+String(l).padStart(2,'0');
const idHex=n=>BigInt(n).toString(16).padStart(64,'0');
async function main(){
  const colors=JSON.parse(await readFile(resolve(ROOT,'assets/json/nft-colors.json')));
  const levels=JSON.parse(await readFile(resolve(ROOT,'assets/json/leveles-description.json')));
  const existing=JSON.parse(await readFile(source));
  assert.equal(colors.length,108);
  assert.equal(Object.keys(levels).length,22);
  assert.equal(existing.items.length,19);
  assert.equal(existing.collection.chain,'polygon');
  const seen=new Set();
  for(const item of existing.items) {
    if(seen.has(String(item.token_id)))throw Error('Duplicate on-chain token ID in imported snapshot');
    seen.add(String(item.token_id));
  }
  if([...seen].some(x=>BigInt(x)>19n||BigInt(x)<1n))throw Error('Snapshot changed; expected token IDs 1..19');
  if(seen.size!==19)throw Error('Missing historical token ID');
  const existingArt=new Set(existing.items.map(x=>x.artwork_id));
  if(existingArt.size!==18)throw Error('Existing artwork collisions changed; manual review required');
  let next=20;
  const pending=[];
  const colorMap=new Map(colors.map(c=>[c.id,c]));
  if(colorMap.size!==108)throw Error('Non-unique color IDs');
  const empty=[];
  const uniqueImagePaths=new Set();
  for(let c=1;c<=108;c++){
    const color=colorMap.get(c);
    if(!color||!/^#[\da-f]{6}$/i.test(color.colore))throw Error('Invalid color #'+c);
    for(let level=1;level<=22;level++){
      const art=artworkId(c,level);
      const filename='solar_2222px_39.00px_'+color.colore.toUpperCase()+'_lvl'+level+'_n'+c+'.png';
      const rel='nft-imgs/'+filename;
      const file=resolve(ROOT,rel);
      const info=await stat(file).catch(()=>null);
      if(!info||!info.isFile()||info.size===0)empty.push(rel);
      uniqueImagePaths.add(rel);
      if(existingArt.has(art))continue;
      pending.push({
        artwork_id:art,proposed_token_id:String(next),proposed_metadata_filename:idHex(next),
        color_id:c,depth:level,name:'Risuonatore Solare — '+color.nome+' — Profondità '+level,
        color_hex:color.colore,category:color.categoria,
        image_path:rel,description_color_it:color.descrizione,
        description_depth_it:levels[String(level)]?.it??null,
        onchain_id_status:'PROPOSAL_NOT_VERIFIED',ipfs_metadata_status:'NOT_UPLOADED'
      });
      next++;
    }
  }
  if(empty.length)throw Error('Missing source PNG: '+empty.slice(0,5).join(', ')+' (total '+empty.length+')');
  if(uniqueImagePaths.size!==2376)throw Error('Missing source combinations');
  if(pending.length!==2358||next!==2378)throw Error('Plan expected 2,358 pending and proposed last ID 2,377');
  const result={
    schema_version:1,created_at:new Date().toISOString(),mode:'DRY_RUN_ONLY',no_network_requests:true,
    target_collection:{
      chain:'polygon',
      contract_address:'0xead98e12d3836562ea39c6a6ca5ef1292359a862',
      standard:'ERC1155',
      historical_token_ids_preserved:Array.from(seen).sort((a,b)=>Number(a)-Number(b)),
      historic_artwork_ids:[...existingArt].sort()
    },
    counts:{
      total_artwork_combinations:2376,existing_token_ids_observed:19,
      distinct_artwork_combinations_already_represented:18,
      unique_pending_artworks:2358,proposed_new_token_ids:2358,
      last_proposed_token_id:'2377'
    },
    warnings:[
      'PROPOSED ID allocation is only an off-chain plan; verify all token IDs on Polygon BEFORE mint.',
      'ERC1155 maxSupply for NEW token IDs is zero until individually configured or configured by authorized Studio contract.',
      'The existing immutable IPFS CID cannot accept new metadata files; new baseURI requires preserving historical token JSON bytes.',
      'Image paths are LOCAL source references, NOT pinned IPFS media. Do not send these draft records to OpenSea directly.',
      'Seven color pairs share an RGB value and produce identical PNGs; artistic decision pending.',
      'NEVER mint or change baseURI based solely on this dry-run plan.'
    ],
    existing_token_mapping:existing.items.map(x=>({
      token_id:x.token_id,artwork_id:x.artwork_id,opensea_url:x.opensea_url,
      metadata_filename:idHex(x.token_id),must_preserve_original_metadata:true
    })),
    pending
  };
  await mkdir(dirname(out),{recursive:true});
  await writeFile(out,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({
    output:'reports/staging-mint-plan.json',mode:result.mode,
    ...result.counts,missing_media_files:empty.length,
    example_first:pending[0]?.artwork_id,example_last:pending.at(-1)?.artwork_id,
    no_live_mints:true
  },null,2));
}
main().catch(e=>{console.error('PLANNING FAILED '+e.message);process.exitCode=1});
