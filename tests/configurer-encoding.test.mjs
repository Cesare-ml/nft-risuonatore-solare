import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Interface} from 'ethers';
import {
 CONFIGURER_ABI,CONFIGURER_SELECTOR,COLLECTION,makeAtomicMintConfig
} from '../scripts/lib/opensea-configurer.mjs';

test('ABI selector agrees with verified OpenSea Configurer (0xa64dfa75)',()=>{
 const abi=new Interface(CONFIGURER_ABI);
 assert.equal(abi.getFunction('multiConfigure').selector,CONFIGURER_SELECTOR);
});
test('fully nested tuple encodes and decodes without changing old metadata',()=>{
 const abi=new Interface(CONFIGURER_ABI);
 const recipient='0x2180747f94c3319162137a0e2ca5b1e8c7efb2ed';
 const config=makeAtomicMintConfig(['20','21','22'],recipient);
 const encoded=abi.encodeFunctionData('multiConfigure',[COLLECTION,config]);
 assert.ok(encoded.startsWith(CONFIGURER_SELECTOR));
 const [target,decoded]=abi.decodeFunctionData('multiConfigure',encoded);
 assert.equal(target.toLowerCase(),COLLECTION);
 assert.deepEqual(decoded.maxSupplyTokenIds.map(String),['20','21','22']);
 assert.deepEqual(decoded.maxSupplyAmounts.map(String),['1','1','1']);
 assert.deepEqual(decoded.mintTokenIds.map(String),['20','21','22']);
 assert.deepEqual(decoded.mintAmounts.map(String),['1','1','1']);
 assert.equal(decoded.baseURI,'');
 assert.equal(decoded.contractURI,'');
 assert.equal(decoded.mintRecipient.toLowerCase(),recipient);
 assert.equal(decoded.allowedFeeRecipients.length,0);
 assert.equal(decoded.allowListData.merkleRoot,'0x'+'0'.repeat(64));
});
