/**
 * Verified OpenSea ERC1155SeaDropConfigurer multiConfigure ABI.
 * Mainnet configurer: 0x864BaA13E01d8f9E26549dc91B458CD15E34EB7c
 * ABI struct exact field order from verified ERC1155SeaDropStructs.sol.
 * Pure code: no network / signer / transactions.
 */
export const CONFIGURER='0x864baa13e01d8f9e26549dc91b458cd15e34eb7c';
export const COLLECTION='0xead98e12d3836562ea39c6a6ca5ef1292359a862';
export const ZERO_ADDRESS='0x0000000000000000000000000000000000000000';
export const ZERO_BYTES32='0x'+'0'.repeat(64);
export const CONFIGURER_SELECTOR='0xa64dfa75';
const field=(name,type,components)=>components?{name,type,components}:{name,type};
const publicDrop=[
 field('startPrice','uint80'),field('endPrice','uint80'),
 field('startTime','uint40'),field('endTime','uint40'),
 field('restrictFeeRecipients','bool'),field('paymentToken','address'),
 field('fromTokenId','uint24'),field('toTokenId','uint24'),
 field('maxTotalMintableByWallet','uint16'),
 field('maxTotalMintableByWalletPerToken','uint16'),field('feeBps','uint16')
];
export const MULTICONFIGURE_FIELDS=[
 field('maxSupplyTokenIds','uint256[]'),
 field('maxSupplyAmounts','uint256[]'),
 field('baseURI','string'),
 field('contractURI','string'),
 field('publicDrops','tuple[]',publicDrop),
 field('publicDropsIndexes','uint256[]'),
 field('dropURI','string'),
 field('allowListData','tuple',[
   field('merkleRoot','bytes32'),field('publicKeyURIs','string[]'),field('allowListURI','string')
 ]),
 field('creatorPayouts','tuple[]',[
   field('payoutAddress','address'),field('basisPoints','uint16')
 ]),
 field('provenanceHash','bytes32'),
 field('allowedFeeRecipients','address[]'),
 field('disallowedFeeRecipients','address[]'),
 field('allowedPayers','address[]'),
 field('disallowedPayers','address[]'),
 field('allowedSigners','address[]'),
 field('disallowedSigners','address[]'),
 field('royaltyReceiver','address'),
 field('royaltyBps','uint96'),
 field('mintRecipient','address'),
 field('mintTokenIds','uint256[]'),
 field('mintAmounts','uint256[]')
];
export const CONFIGURER_ABI=[{
 type:'function',name:'multiConfigure',stateMutability:'nonpayable',
 inputs:[field('token','address'),field('config','tuple',MULTICONFIGURE_FIELDS)],outputs:[]
}];
function failIf(condition,message){if(condition)throw Error(message)}
export function makeAtomicMintConfig(ids,recipient) {
 failIf(!Array.isArray(ids)||ids.length===0||ids.length>30,'Expected 1..30 new token IDs');
 failIf(typeof recipient!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(recipient)
   ||recipient.toLowerCase()===ZERO_ADDRESS,'Invalid nonzero recipient wallet');
 const asString=ids.map(v=>{
   const s=String(v);
   failIf(!/^[1-9]\d*$/.test(s)||BigInt(s)<20n,'Unsafe token ID '+s);
   return s;
 });
 failIf(new Set(asString).size!==asString.length,'Duplicate token IDs in batch');
 const amounts=asString.map(()=> '1');
 const result={
   maxSupplyTokenIds:asString,
   maxSupplyAmounts:amounts,
   baseURI:'',contractURI:'',
   publicDrops:[],publicDropsIndexes:[],
   dropURI:'',
   allowListData:{merkleRoot:ZERO_BYTES32,publicKeyURIs:[],allowListURI:''},
   creatorPayouts:[],provenanceHash:ZERO_BYTES32,
   allowedFeeRecipients:[],disallowedFeeRecipients:[],
   allowedPayers:[],disallowedPayers:[],
   allowedSigners:[],disallowedSigners:[],
   royaltyReceiver:ZERO_ADDRESS,royaltyBps:'0',
   mintRecipient:recipient,
   mintTokenIds:asString,
   mintAmounts:amounts
 };
 failIf(Object.keys(result).join(',')!==MULTICONFIGURE_FIELDS.map(f=>f.name).join(','),
   'Configurer ABI and values diverged');
 return result;
}
