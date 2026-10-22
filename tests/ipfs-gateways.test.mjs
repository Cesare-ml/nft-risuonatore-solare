import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DEFAULT_GATEWAYS,requireDiverseGateways,normalizeGateway}
 from '../scripts/lib/ipfs-gateways.mjs';

test('defaults use separate operators not deprecated 2026 gateway hosts',()=>{
 const choices=requireDiverseGateways(DEFAULT_GATEWAYS);
 assert.deepEqual(choices.map(g=>g.provider),['pinata','storacha']);
});
test('same backend operator cannot masquerade as independent',()=>{
 assert.throws(()=>requireDiverseGateways([
 'https://w3s.link/ipfs','https://storacha.link/ipfs']),/distinct gateway operators/);
 assert.throws(()=>requireDiverseGateways([
 'https://gateway.pinata.cloud/ipfs','https://demo.mypinata.cloud/ipfs']),/distinct gateway operators/);
});
test('reject ipfs.io and dweb.link for 2026 programmatic use',()=>{
 for(const g of ['ipfs.io','dweb.link','cloudflare-ipfs.com']){
  assert.throws(()=>normalizeGateway('https://'+g+'/ipfs'),/2026 IPFS public gateway/);
 }
});
test('require HTTPS and reject unsafe parameters',()=>{
 assert.throws(()=>normalizeGateway('http://gateway.pinata.cloud/ipfs'),/Only HTTPS/);
 assert.throws(()=>normalizeGateway('https://gateway.pinata.cloud/ipfs?q=secret'),/Only HTTPS/);
 assert.throws(()=>normalizeGateway('https://name:pass@gateway.pinata.cloud/ipfs'),/Only HTTPS/);
});
