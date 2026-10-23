import assert from 'node:assert/strict';
import {test} from 'node:test';
import {creditGate,integerWinc} from '../scripts/lib/turbo-credits.mjs';
test('valid prepaid credits allow upload but no automatic funding',()=>{
 const result=creditGate({
  cost:{winc:'123456789123456789'},balance:{winc:'123456789123456789'},
  freeStatus:{bytesRemaining:0},fileBytes:1000000
 });
 assert.equal(result.credit_preflight_passed,true);
 assert.equal(result.free_tier_eligible,false);
});
test('free lifetime allowance permits a zero-credit upload check',()=>{
 const result=creditGate({
  cost:{winc:'20000'},balance:{winc:'0'},
  freeStatus:{bytesRemaining:150000},fileBytes:100000
 });
 assert.equal(result.free_tier_eligible,true);
});
test('no credits and no free capacity fails closed',()=>{
 assert.throws(()=>creditGate({
  cost:{winc:'20000'},balance:{winc:'19999'},
  freeStatus:{bytesRemaining:999},fileBytes:1000
 }),/Insufficient Turbo credits/);
});
test('reject fractional or scientific balances and negative costs',()=>{
 for(const winc of ['1.2','1e9','-5','NaN','Infinity']){
  assert.throws(()=>integerWinc(winc,'balance'),/integer/);
 }
});
test('unlimited partner allowance is represented by null',()=>{
 const result=creditGate({
  cost:{winc:'5'},balance:{winc:'0'},
  freeStatus:{bytesRemaining:null},fileBytes:1200000
 });
 assert.equal(result.free_tier_eligible,true);
});
