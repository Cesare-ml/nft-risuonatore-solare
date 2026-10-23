/**
 * Constrained redirects on an immutable-content Arweave gateway.
 * Sandboxed subdomains are normal for AR.IO; redirects to unrelated hosts
 * are NEVER acceptable for NFT byte verification.
 */
export function approvedArweaveRedirect(originalURL,redirectURL){
 const root=new URL(originalURL),dest=new URL(redirectURL,root);
 const hostname=root.hostname.toLowerCase(),target=dest.hostname.toLowerCase();
 if(root.protocol!=='https:'||dest.protocol!=='https:'||
   !['arweave.net','turbo-gateway.com'].includes(hostname)||
   (target!==hostname&&!target.endsWith('.'+hostname))||
   dest.username||dest.password||dest.port||
   dest.hash)
  throw Error('Unsafe cross-operator or non-HTTPS Arweave redirect');
 return dest.href;
}
export async function fetchVerifiedArweaveBytes(url,maxBytes,fetcher=fetch){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<=0||maxBytes>100*1024*1024)
  throw Error('Invalid Arweave maximum file size');
 const root=url;
 let next=url;
 for(let hops=0;hops<=5;hops++){
  const response=await fetcher(next,{
   redirect:'manual',headers:{accept:'application/octet-stream'},
   signal:AbortSignal.timeout(30000)
  });
  if([301,302,303,307,308].includes(response.status)){
   if(hops===5)throw Error('Too many Arweave gateway redirects');
   const location=response.headers.get('location');
   if(!location)throw Error('Arweave redirect missing Location');
   next=approvedArweaveRedirect(root,new URL(location,next).href);
   await response.body?.cancel();
   continue;
  }
  if(!response.ok)throw Error('Arweave gateway HTTP '+response.status);
  const length=Number(response.headers.get('content-length')||0);
  if(length>maxBytes)throw Error('Arweave Content-Length exceeds limit');
  if(!response.body)throw Error('Arweave response has no readable body');
  const reader=response.body.getReader(),chunks=[];
  let received=0;
  try{
   while(true){
    const {value,done}=await reader.read();
    if(done)break;
    received+=value.byteLength;
    if(received>maxBytes)throw Error('Arweave response exceeded byte limit');
    chunks.push(Buffer.from(value));
   }
  }finally{reader.releaseLock()}
  if(received===0)throw Error('Empty Arweave response');
  return Buffer.concat(chunks,received);
 }
 throw Error('Exceeded redirect attempts');
}
