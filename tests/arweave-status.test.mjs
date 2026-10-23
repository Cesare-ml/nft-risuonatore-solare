import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextArweaveStep} from '../scripts/lib/arweave-status.mjs';
const all={catalog:true,historic:true,images:true,inventory:true,media:true,composed:true,
 metadata:true,manifest:true,remote:true,forkAtomic:true,forkURI:true,chain:true,unresolved:false};
test('unresolved paid upload always stops',()=>assert.match(nextArweaveStep({...all,unresolved:true}),/^STOP/));
test('original images must be present',()=>assert.equal(nextArweaveStep({...all,images:false}),'npm run nft:historic:images'));
test('upload suggestion is always dry-run',()=>assert.equal(nextArweaveStep({...all,media:false}),
 'npm run nft:arweave:upload -- --kind media'));
