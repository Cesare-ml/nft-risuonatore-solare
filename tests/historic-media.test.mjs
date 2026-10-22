import {test} from 'node:test';
import assert from 'node:assert/strict';
import {historicImageToIpfsPath} from '../scripts/lib/historic-media.mjs';
const CID='bafybeih7ucalsv5p2xh3zjrslg6fjgz7y3t4q2fivebci56mz3wex4gwj4';
test('parse direct and gateway historical IPFS images',()=>{
 assert.equal(historicImageToIpfsPath('ipfs://'+CID+'/art.png'),CID+'/art.png');
 assert.equal(historicImageToIpfsPath('ipfs://ipfs/'+CID+'/art.png'),CID+'/art.png');
 assert.equal(historicImageToIpfsPath('https://gateway.pinata.cloud/ipfs/'+CID+'/art.png'),CID+'/art.png');
});
test('preserve literal # in historic artwork filenames',()=>{
 assert.equal(historicImageToIpfsPath('ipfs://'+CID+'/solar_#FFDD00.png'),CID+'/solar_#FFDD00.png');
 assert.equal(historicImageToIpfsPath('ipfs://'+CID+'/solar_%23FFDD00.png'),CID+'/solar_#FFDD00.png');
});
test('reject non-content-addressed and dangerous image paths',()=>{
 for(const source of [
 'https://example.org/artwork.png','data:image/png;base64,123',
 'javascript:alert(1)','ipfs://badcid/a.png',
 'ipfs://'+CID+'/../secret',
 'ipfs://'+CID+'/%2e%2e/secret',
 'https://host/ipfs/'+CID+'/x.png?user=1'
 ])assert.throws(()=>historicImageToIpfsPath(source));
});
