import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  CONFIGURER_ABI,CONFIGURER_SELECTOR,CONFIGURER,
  MULTICONFIGURE_FIELDS,makeAtomicMintConfig,ZERO_ADDRESS
} from '../scripts/lib/opensea-configurer.mjs';

test('verified configurer ABI has correct struct ordering (21 fields)',()=>{
 assert.equal(CONFIGURER_ABI[0].name,'multiConfigure');
 assert.equal(MULTICONFIGURE_FIELDS.length,21);
 assert.deepEqual(MULTICONFIGURE_FIELDS.map(f=>f.name).slice(0,4),
 ['maxSupplyTokenIds','maxSupplyAmounts','baseURI','contractURI']);
 assert.deepEqual(MULTICONFIGURE_FIELDS.map(f=>f.name).slice(-3),
 ['mintRecipient','mintTokenIds','mintAmounts']);
 assert.equal(MULTICONFIGURE_FIELDS[4].components.length,11);
 assert.equal(MULTICONFIGURE_FIELDS[7].components.length,3);
 assert.equal(MULTICONFIGURE_FIELDS[8].components.length,2);
 assert.equal(CONFIGURER_SELECTOR,'0xa64dfa75');
 assert.equal(CONFIGURER,'0x864baa13e01d8f9e26549dc91b458cd15e34eb7c');
});
test('atomic mint batch cannot touch baseURI or other Studio settings',()=>{
 const recipient='0x2180747f94c3319162137a0e2ca5b1e8c7efb2ed';
 const cfg=makeAtomicMintConfig(['20','21'],recipient);
 assert.deepEqual(cfg.maxSupplyTokenIds,['20','21']);
 assert.deepEqual(cfg.maxSupplyAmounts,['1','1']);
 assert.deepEqual(cfg.mintTokenIds,['20','21']);
 assert.deepEqual(cfg.mintAmounts,['1','1']);
 assert.equal(cfg.baseURI,'');
 assert.equal(cfg.contractURI,'');
 assert.equal(cfg.dropURI,'');
 assert.equal(cfg.allowListData.allowListURI,'');
 assert.equal(cfg.creatorPayouts.length,0);
 assert.equal(cfg.royaltyReceiver,ZERO_ADDRESS);
 assert.deepEqual(Object.keys(cfg),MULTICONFIGURE_FIELDS.map(f=>f.name));
});
test('atomic mint rejects collisions, historic IDs, zero recipient and big batches',()=>{
 const recipient='0x2180747f94c3319162137a0e2ca5b1e8c7efb2ed';
 assert.throws(()=>makeAtomicMintConfig(['20','20'],recipient),/Duplicate/);
 assert.throws(()=>makeAtomicMintConfig(['19'],recipient),/Unsafe/);
 assert.throws(()=>makeAtomicMintConfig([],recipient),/1..30/);
 assert.throws(()=>makeAtomicMintConfig(Array.from({length:31},(_,i)=>String(i+20)),recipient),/1..30/);
 assert.throws(()=>makeAtomicMintConfig(['20'],ZERO_ADDRESS),/recipient/);
 assert.throws(()=>makeAtomicMintConfig(['20'],'not-wallet'),/recipient/);
});
