/**
 * Validate a previously recovered Kubo archive of ALL 19 original metadata.
 * The original recovery step authenticated content using IPFS content addressing.
 */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const OLD_CID='bafybeih7ucalsv5p2xh3zjrslg6fjgz7y3t4q2fivebci56mz3wex4gwj4';
const COLLECTION='0xead98e12d3836562ea39c6a6ca5ef1292359a862';
export const historicalId64=n=>BigInt(n).toString(16).padStart(64,'0');
export const historicalHash=data=>createHash('sha256').update(data).digest('hex');
export async function readHistoricArchive(dir,existingTokenMapping){
 if(!Array.isArray(existingTokenMapping)||existingTokenMapping.length!==19)
  throw Error('Expected exactly 19 original NFT IDs');
 const items=existingTokenMapping.map(x=>String(x.token_id));
 if(items.join(',')!==Array.from({length:19},(_,i)=>String(i+1)).join(','))
  throw Error('The historical catalog token IDs no longer match IDs 1..19');
 const manifest=JSON.parse(await readFile(join(dir,'manifest.json'),'utf8'));
 if(manifest.status!=='KUBO_HISTORIC_19_VERIFIED'||manifest.original_cid!==OLD_CID||
   manifest.collection_address?.toLowerCase()!==COLLECTION||
   manifest.existing_count!==19||manifest.no_blockchain_transactions!==true||
   Object.keys(manifest.records??{}).length!==19)
  throw Error('Invalid historical Kubo provenance manifest: run npm run nft:ipfs:recover first');
 const result={};
 for(const item of existingTokenMapping){
  const id=String(item.token_id),filename=historicalId64(id);
  const reference=manifest.records[filename];
  if(!reference||String(reference.token_id)!==id||
    !/^([a-f0-9]{64})$/.test(reference.sha256)||
    reference.source!=='Kubo ipfs cat '+OLD_CID+'/'+filename)
   throw Error('Invalid original CID provenance for token '+id);
  const raw=await readFile(join(dir,filename));
  if(raw.length===0||raw.length>500000||raw.length!==reference.bytes||
    historicalHash(raw)!==reference.sha256)
   throw Error('Historical backup SHA256/size mismatch for token '+id);
  let json;
  try{json=JSON.parse(raw.toString('utf8'))}catch{throw Error('Broken historical JSON for token '+id)}
  if(json.name!==reference.name||json.image!==reference.image||
    typeof json.name!=='string'||!json.name||
    typeof json.image!=='string'||!json.image)
   throw Error('Historic metadata changed for token '+id);
  result[filename]={raw,archive:{
   sha256:reference.sha256,bytes:reference.bytes,
   name:reference.name,image:reference.image
  }};
 }
 return result;
}
