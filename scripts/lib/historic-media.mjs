/**
 * Parse historical image URI into a Kubo-addressed IPFS path.
 * Generic HTTPS images are mutable and must not be accepted as authenticated.
 */
export function historicImageToIpfsPath(uri){
 if(typeof uri!=='string'||!uri.trim())throw Error('Historical image URI missing');
 const source=uri.trim();
 let subpath;
 if(source.toLowerCase().startsWith('ipfs://')){
  if(source.includes('?'))throw Error('Untrusted query parameter in IPFS image path');
  subpath=source.slice(7);
  if(subpath.startsWith('ipfs/'))subpath=subpath.slice(5);
 }else if(source.startsWith('https://')){
  const url=new URL(source);
  if(url.username||url.password||url.search||url.hash)throw Error('Image gateway URI has unsafe credential/query/fragment');
  const mark='/ipfs/';
  if(!url.pathname.includes(mark))throw Error('HTTPS image is not IPFS content addressed');
  subpath=url.pathname.slice(url.pathname.indexOf(mark)+mark.length);
 }else throw Error('Historical image is not content-addressed by IPFS');
 const fragments=subpath.split('/');
 const cid=fragments.shift();
 if(!/^(?:b[a-z2-7]{20,}|Qm[1-9A-HJ-NP-Za-km-z]{44})$/.test(cid??''))
  throw Error('Invalid IPFS image CID');
 const parts=fragments.map(s=>{
  let part;
  try{part=decodeURIComponent(s)}catch{throw Error('Broken percent-encoding in image URI')}
  if(!part||part==='.'||part==='..'||part.includes('/')||part.includes('\\')||part.includes('\0'))
   throw Error('Unsafe path component in historical image URI');
  return part;
 });
 return cid+(parts.length?'/'+parts.join('/'):'');
}
