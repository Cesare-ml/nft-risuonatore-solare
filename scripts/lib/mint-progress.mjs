/**
 * Pure deterministic continuation from a READ-ONLY full Polygon ID audit.
 * "fullyMinted" refers to observed token state, NOT proof of who received it.
 * Refuse gaps, partial states and overwritten IDs. No network/no signing.
 */
export function analyzeMintProgress(rows) {
 if(!Array.isArray(rows)||rows.length!==2358)
  throw Error('Full 2358-token state audit is required to resume');
 let completedPrefix=0,seenVacant=false;
 for(let i=0;i<rows.length;i++){
  const x=rows[i],id=String(i+20);
  if(x.token_id!==id)throw Error('Audit token ordering mismatch at '+id);
  const vacant=x.vacant===true&&x.maxSupply==='0'&&
    x.totalMinted==='0'&&x.totalSupply==='0';
  const fullyMinted=x.vacant===false&&x.maxSupply==='1'&&
    x.totalMinted==='1'&&x.totalSupply==='1';
  if(!vacant&&!fullyMinted)
   throw Error('Unsafe partially configured/minted token '+id);
  if(vacant)seenVacant=true;
  else{
   if(seenVacant)throw Error('Non-contiguous mint progress, review token '+id);
   completedPrefix++;
  }
 }
 return {
  fully_minted_prefix_count:completedPrefix,
  first_unminted_token_id:completedPrefix===2358?null:String(completedPrefix+20),
  remaining_token_count:2358-completedPrefix,
  provenance_verified:false,
  warning:'A full supply of 1 does not prove the recipient or transaction history; reconcile signed receipts separately.'
 };
}
