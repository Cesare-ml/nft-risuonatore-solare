import {test} from 'node:test';
import assert from 'node:assert/strict';
import {approvedArweaveRedirect,fetchVerifiedArweaveBytes}
 from '../scripts/lib/arweave-gateway.mjs';
test('accept sandbox subdomains of verified gateway but not arbitrary hosts',()=>{
 assert.equal(approvedArweaveRedirect('https://turbo-gateway.com/id',
  'https://sandbox.turbo-gateway.com/id'),'https://sandbox.turbo-gateway.com/id');
 assert.throws(()=>approvedArweaveRedirect('https://turbo-gateway.com/id',
  'https://turbo-gateway.com.attacker.invalid/'),/Unsafe/);
 assert.throws(()=>approvedArweaveRedirect('https://turbo-gateway.com/id',
  'https://arweave.net/id'),/Unsafe/);
 assert.throws(()=>approvedArweaveRedirect('https://turbo-gateway.com/id',
  'http://sandbox.turbo-gateway.com/id'),/Unsafe/);
});
test('follow sandbox redirect while checking actual bytes',async()=>{
 const payload=Buffer.from('arweave original');
 const mock=async(url)=>{
  if(url==='https://turbo-gateway.com/asset')return new Response(null,
   {status:302,headers:{location:'https://sandbox.turbo-gateway.com/asset'}});
  return new Response(payload,{status:200});
 };
 assert.deepEqual(await fetchVerifiedArweaveBytes(
  'https://turbo-gateway.com/asset',300,mock),payload);
});
test('cap body size even without Content-Length',async()=>{
 const mock=async()=>new Response(Buffer.alloc(100),{status:200});
 await assert.rejects(fetchVerifiedArweaveBytes('https://arweave.net/id',50,mock),/exceeded byte limit/);
});
test('reject malicious cross-origin redirect',async()=>{
 const mock=async()=>new Response(null,{status:302,
  headers:{location:'https://bad.example/private'}});
 await assert.rejects(fetchVerifiedArweaveBytes('https://arweave.net/id',100,mock),/Unsafe/);
});
