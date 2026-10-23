import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ARWEAVE_ID,HEX_ID,buildManifest,arweaveBaseUri,mediaType,newMetadata} from '../scripts/lib/arweave-release.mjs';
test('Arweave ERC1155 manifest resolves exact lowercase 64-hex token path',()=>{
 const id='A'.repeat(43);
 const mapping=Array.from({length:2377},(_,i)=>({filename:HEX_ID(i+1),id}));
 const manifest=buildManifest(mapping);
 assert.equal(manifest.manifest,'arweave/paths');
 assert.equal(manifest.version,'0.2.0');
 assert.equal(Object.keys(manifest.paths).length,2377);
 assert.equal(manifest.paths[HEX_ID(19)].id,id);
 assert.equal(manifest.paths[HEX_ID(2377)].id,id);
 assert.equal(arweaveBaseUri(id),'https://arweave.net/'+id+'/{id}');
});
test('Arweave manifest rejects duplicate path, invalid receipts, missing metadata',()=>{
 const valid=Array.from({length:2377},(_,i)=>({filename:HEX_ID(i+1),id:'A'.repeat(43)}));
 assert.throws(()=>buildManifest(valid.slice(0,2376)),/2377/);
 valid[4].filename=valid[3].filename;
 assert.throws(()=>buildManifest(valid),/Duplicate/);
 assert.equal(ARWEAVE_ID.test('A'.repeat(43)),true);
 assert.throws(()=>arweaveBaseUri('FAKE-TX-ID'),/Invalid/);
});
test('new NFTs use ar:// images without changing historic JSONs',()=>{
 const data=newMetadata({name:'Risuonatore Solare — Luce — Profondità 1',color_id:1,
 color_hex:'#eeeeee',category:'test',depth:1,artwork_id:'RS-C001-L01'},'Z'.repeat(43),'Desc');
 assert.equal(data.image,'ar://'+'Z'.repeat(43));
 assert.equal(data.attributes.at(-1).value,'RS-C001-L01');
});
test('detects historical image formats from actual bytes',()=>{
 assert.equal(mediaType(Buffer.from('89504e470d0a1a0a','hex')),'image/png');
 assert.equal(mediaType(Buffer.from('ffd8ff','hex')),'image/jpeg');
 assert.equal(mediaType(Buffer.from('GIF89a')),'image/gif');
 assert.throws(()=>mediaType(Buffer.from('not an image')),/Unsupported/);
});
