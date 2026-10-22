/**
 * Pure provenance checks for a local Anvil fork of the HISTORIC Polygon
 * ERC-1155 EIP-1167 collection. No RPC or state changes.
 */
export const ORIGINAL_IMPLEMENTATION='0x9f36ee33fd56c7d9a78facd3249c580b1ca464a2';
export const EXPECTED_COLLECTION_PROXY_CODE=
  '0x363d3d373d3d3d363d73'+ORIGINAL_IMPLEMENTATION.slice(2)+'5af43d82803e903d91602b57fd5bf3';
export const HISTORIC_BLOCK_FLOOR=95938461n;
export function verifyPolygonForkIdentity(nodeInfo,chainId,collectionCode){
 if(!nodeInfo||typeof nodeInfo!=='object')throw Error('Anvil node information missing');
 if(BigInt(chainId)!==137n)throw Error('Not Polygon chain ID 137');
 const cfg=nodeInfo.forkConfig;
 if(!cfg||typeof cfg!=='object')throw Error('Anvil has no active forkConfig. Start with --fork-url to a Polygon RPC.');
 const source=cfg.forkBlockNumber??cfg.blockNumber;
 if(source===undefined||source===null)throw Error('Anvil fork block number is missing');
 let block;
 try{block=BigInt(source)}catch{throw Error('Invalid fork block number')}
 if(block<HISTORIC_BLOCK_FLOOR)throw Error('Fork is older than the verified historical Polygon state');
 if(typeof collectionCode!=='string'||collectionCode.toLowerCase()!==EXPECTED_COLLECTION_PROXY_CODE.toLowerCase())
   throw Error('Fork collection bytecode does not match historical EIP-1167 proxy');
 return {fork_block_number:block.toString(),
  implementation:ORIGINAL_IMPLEMENTATION,code_bytes:45};
}
