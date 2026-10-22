import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyPolygonForkIdentity,EXPECTED_COLLECTION_PROXY_CODE}
 from '../scripts/lib/fork-provenance.mjs';
test('real forkConfig, Polygon chain and byte-exact historical proxy required',()=>{
 const valid=verifyPolygonForkIdentity(
   {forkConfig:{forkBlockNumber:96000000}},'0x89',EXPECTED_COLLECTION_PROXY_CODE);
 assert.equal(valid.code_bytes,45);
 assert.equal(valid.fork_block_number,'96000000');
});
test('standalone Anvil with chain 137 fails closed',()=>{
 assert.throws(()=>verifyPolygonForkIdentity({},137,EXPECTED_COLLECTION_PROXY_CODE),/forkConfig/);
 assert.throws(()=>verifyPolygonForkIdentity({forkConfig:{}},137,EXPECTED_COLLECTION_PROXY_CODE),/block number/);
});
test('wrong chain, changed proxy and ancient fork rejected',()=>{
 assert.throws(()=>verifyPolygonForkIdentity({forkConfig:{forkBlockNumber:96000000}},1,EXPECTED_COLLECTION_PROXY_CODE),/Polygon/);
 assert.throws(()=>verifyPolygonForkIdentity({forkConfig:{forkBlockNumber:96000000}},137,'0xdeadbeef'),/bytecode/);
 assert.throws(()=>verifyPolygonForkIdentity({forkConfig:{forkBlockNumber:5000000}},137,EXPECTED_COLLECTION_PROXY_CODE),/older/);
});
