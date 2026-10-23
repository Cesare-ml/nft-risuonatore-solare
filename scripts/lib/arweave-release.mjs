/**
 * Pure helpers for an Arweave one-time NFT release. NEVER changes historical
 * ERC1155 metadata bytes, never signs transactions and never adds monthly fees.
 */
export const HISTORIC_CID='bafybeih7ucalsv5p2xh3zjrslg6fjgz7y3t4q2fivebci56mz3wex4gwj4';
export const COLLECTION='0xead98e12d3836562ea39c6a6ca5ef1292359a862';
export const ORIGINAL_URI='ipfs://'+HISTORIC_CID+'/{id}';
export const HEX_ID=id=>BigInt(id).toString(16).padStart(64,'0');
export const ARWEAVE_ID=/^[A-Za-z0-9_-]{43}$/;
export const SHA256=/^[0-9a-f]{64}$/;

/** Only catalog generated PNG names and local Kubo original-image backups. */
export function approvedMediaPath(path){
 if(typeof path!=='string')return false;
 return /^nft-imgs\/solar_2222px_39\.00px_#[A-F0-9]{6}_lvl(?:[1-9]|1\d|2[0-2])_n(?:[1-9]|[1-9]\d|10[0-8])\.png$/.test(path)||
  /^reports\/solar-release-staging\/historic-originals\/images\/[a-f0-9]{64}\.bin$/.test(path);
}

export function requireOk(value,message){if(!value)throw Error(message)}
export function mediaType(buffer){
 if(buffer.length>=8&&buffer.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))return 'image/png';
 if(buffer.length>=3&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff)return 'image/jpeg';
 if(buffer.length>=6&&['GIF87a','GIF89a'].includes(buffer.subarray(0,6).toString('ascii')))return 'image/gif';
 if(buffer.length>=12&&buffer.subarray(0,4).toString('ascii')==='RIFF'&&buffer.subarray(8,12).toString('ascii')==='WEBP')return 'image/webp';
 throw Error('Unsupported / unreadable historic image format (PNG JPEG GIF WEBP only)');
}
export function validateInventory(inv){
 requireOk(inv?.schema===1&&inv.status==='LOCAL_ARWEAVE_INVENTORY_READY','Not an Arweave staging inventory');
 requireOk(inv.collection===COLLECTION&&inv.old_base_uri===ORIGINAL_URI,'Wrong original ERC1155 collection');
 requireOk(inv.pending_count===2358&&inv.historic_count===19&&inv.metadata_count===2377,'Expected 2358 new and 19 historical tokens');
 requireOk(Array.isArray(inv.artworks)&&inv.artworks.length===2358,'Incomplete new artworks');
 requireOk(Array.isArray(inv.historical)&&inv.historical.length===19,'Incomplete historic records');
 requireOk(Array.isArray(inv.media)&&inv.media.length>0,'Missing media');
 const map=new Set(),mediaSha=new Set();
 for(const media of inv.media){
  requireOk(SHA256.test(media.sha256)&&!mediaSha.has(media.sha256)&&media.bytes>0&&
   approvedMediaPath(media.path)&&/^image\/(?:png|jpeg|gif|webp)$/.test(media.content_type),
   'Bad or duplicate Arweave image');
  mediaSha.add(media.sha256);
 }
 for(let i=0;i<2358;i++){
  const x=inv.artworks[i],id=String(i+20);
  requireOk(x.token_id===id&&x.metadata_filename===HEX_ID(id)&&
   typeof x.artwork_id==='string'&&!map.has(x.artwork_id)&&mediaSha.has(x.image_sha256),
   'Invalid future artwork reference '+id);
  map.add(x.artwork_id);
 }
 for(let i=0;i<19;i++){
  const x=inv.historical[i],id=String(i+1);
  requireOk(x.token_id===id&&x.metadata_filename===HEX_ID(id)&&
   SHA256.test(x.metadata_sha256)&&mediaSha.has(x.image_sha256),
   'Historical original missing or invalid '+id);
 }
 return true;
}
export function buildManifest(records) {
 const paths={};
 for(const item of records){
  requireOk(/^[0-9a-f]{64}$/.test(item.filename),'Unsafe metadata filename');
  requireOk(ARWEAVE_ID.test(item.id),'Invalid confirmed Arweave item ID');
  requireOk(!paths[item.filename],'Duplicate ERC1155 metadata path '+item.filename);
  paths[item.filename]={id:item.id};
 }
 requireOk(Object.keys(paths).length===2377,'Arweave manifest must contain all 2377 metadata paths');
 return {manifest:'arweave/paths',version:'0.2.0',paths};
}
export function arweaveBaseUri(manifestId){
 requireOk(ARWEAVE_ID.test(manifestId),'Invalid Arweave manifest ID');
 return 'https://arweave.net/'+manifestId+'/{id}';
}
export function newMetadata(item,imageTransactionId,description){
 requireOk(ARWEAVE_ID.test(imageTransactionId),'Arweave image ID not confirmed');
 return {
  name:item.name,description:description,
  image:'ar://'+imageTransactionId,
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
}
export function cleanHtml(text){
 return String(text??'').replace(/<br\s*\/?>/gi,'\n').replace(/<\/p>/gi,'\n\n')
  .replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ')
  .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
  .replace(/\n{3,}/g,'\n\n').trim();
}
