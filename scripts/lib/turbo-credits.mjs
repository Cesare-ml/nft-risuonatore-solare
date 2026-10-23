/**
 * Verify Turbo winc credit estimates safely. All numeric values are integer
 * strings parsed with BigInt, NEVER floating point token balances.
 * Turbo getFreeStatus is advisory: the upload service decides at request time.
 */
export function integerWinc(value,field){
 const raw=String(value??'');
 if(!/^\d+$/.test(raw))throw Error('Turbo '+field+' is not a nonnegative integer');
 return BigInt(raw);
}
export function creditGate({cost,balance,freeStatus,fileBytes}){
 if(!Number.isSafeInteger(fileBytes)||fileBytes<=0)
  throw Error('Invalid upload size');
 const quoted=integerWinc(cost?.winc,'upload cost');
 const available=integerWinc(balance?.winc,'balance');
 const remaining=freeStatus?.bytesRemaining;
 const freeEligible=remaining===null||
   (typeof remaining==='number'&&Number.isSafeInteger(remaining)&&remaining>=fileBytes)||
   (typeof remaining==='string'&&/^\d+$/.test(remaining)&&BigInt(remaining)>=BigInt(fileBytes));
 const prepaidSufficient=available>=quoted;
 if(!prepaidSufficient&&!freeEligible)
  throw Error('Insufficient Turbo credits for this file and no remaining free allowance. Do not start a paid upload; inspect getBalance and top up manually.');
 return {estimated_winc:quoted.toString(),prepaid_winc:available.toString(),
  free_tier_eligible:freeEligible,credit_preflight_passed:true,
  note:'Free-tier eligibility is advisory; the upload service makes the final decision.'};
}
