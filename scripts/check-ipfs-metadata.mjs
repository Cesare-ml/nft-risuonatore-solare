#!/usr/bin/env node
/* Read-only inspection of 4 existing metadata documents for preservation. */
import crypto from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
const CID='bafybeih7ucalsv5p2xh3zjrslg6fjgz7y3t4q2fivebci56mz3wex4gwj4';
const id64=id=>BigInt(id).toString(16).padStart(64,'0');
const GATEWAYS=[
  cid=>'https://'+cid+'.ipfs.dweb.link',
  cid=>'https://ipfs.io/ipfs/'+cid,
  cid=>'https://dweb.link/ipfs/'+cid
];
async function getMetadata(id){
  const errors=[];
  for(const gateway of GATEWAYS){
    const url=gateway(CID)+'/'+id64(id);
    try{
      const res=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(14000)});
      if(!res.ok){errors.push('HTTP '+res.status);continue}
      const raw=Buffer.from(await res.arrayBuffer());
      if(raw.byteLength>200000)throw new Error('Unreasonable metadata length');
      const obj=JSON.parse(raw.toString('utf8'));
      return {id,found:true,source_url:url,byte_length:raw.length,
        sha256:crypto.createHash('sha256').update(raw).digest('hex'),
        name:obj.name??null,image:obj.image??null,
        attributes:obj.attributes??null,
        metadata_keys:Object.keys(obj),errors:[]};
    }catch(error){errors.push(error.message.slice(0,100))}
  }
  return {id,found:false,errors};
}
const results=[];
for(const id of [1,3,4,19])results.push(await getMetadata(id));
const result={
 read_only:true,checked_at:new Date().toISOString(),
 cid:CID,ids_checked:results.length,results,
 plan_note:'Before any setBaseURI, preserve original JSON bytes of all existing minted tokens in new IPFS directory and verify parity byte-for-byte. An URI change affects existing holders even if content equal. Never auto-apply.'
};
const path=resolve('reports/ipfs-existing-metadata.json');
await mkdir(dirname(path),{recursive:true});
await writeFile(path,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
