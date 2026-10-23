export function nextArweaveStep(s){
 if(s.unresolved)return 'STOP: un upload incerto va riconciliato con l\'ID Turbo, senza ripagare';
 if(!s.catalog)return 'npm run nft:plan';
 if(!s.historic)return 'npm run nft:ipfs:recover';
 if(!s.images)return 'npm run nft:historic:images';
 if(!s.inventory)return 'npm run nft:arweave:inventory';
 if(!s.media)return 'npm run nft:arweave:upload -- --kind media';
 if(!s.composed)return 'npm run nft:arweave:compose';
 if(!s.metadata)return 'npm run nft:arweave:upload -- --kind metadata';
 if(!s.manifest)return 'npm run nft:arweave:manifest';
 if(!s.remote)return 'npm run nft:arweave:verify -- --full';
 if(!s.forkAtomic||!s.forkURI)return 'npm run nft:fork:atomic ; npm run nft:fork:arweave';
 if(!s.chain)return 'npm run nft:ids:audit';
 return 'Revisione manuale di owner, baseURI, pinning e consenso separato prima di procedere';
}
