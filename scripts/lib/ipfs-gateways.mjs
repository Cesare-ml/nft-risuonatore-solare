/**
 * Pure IPFS gateway URL policy: no network. Independent HOSTS can share the
 * same provider backend, so reject aliases of the same known operator.
 */
export const DEFAULT_GATEWAYS=[
 'https://gateway.pinata.cloud/ipfs',
 'https://w3s.link/ipfs'
];
const RETIRED=new Set(['ipfs.io','dweb.link','cloudflare-ipfs.com','cf-ipfs.com']);
export function normalizeGateway(v){
 const u=new URL(v);
 if(u.protocol!=='https:'||!u.hostname||u.username||u.password||u.search||u.hash)
   throw Error('Only HTTPS gateways without credentials or query parameters are accepted');
 const base=(u.origin+u.pathname).replace(/\/$/,'');
 if(!base.endsWith('/ipfs'))throw Error('Gateway URL must end with /ipfs');
 const host=u.hostname.toLowerCase();
 if(RETIRED.has(host))throw Error('2026 IPFS public gateway not suitable for automation: '+host);
 const provider=host==='gateway.pinata.cloud'||host.endsWith('.mypinata.cloud')
  ?'pinata':host==='w3s.link'||host==='storacha.link'||host.endsWith('.ipfs.w3s.link')
  ?'storacha':host;
 return {base,host,provider};
}
export function requireDiverseGateways(values){
 const gateways=values.map(normalizeGateway);
 if(gateways.length<2||new Set(gateways.map(g=>g.provider)).size!==gateways.length)
  throw Error('Require at least two distinct gateway operators');
 return gateways;
}
