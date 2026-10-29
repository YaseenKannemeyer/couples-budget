import { reconciliationWorkspace } from '@/features/reconciliation/schema';
import { reconciliation } from '../test/fixtures/reconciliation';
it('keeps an unknown opening comparison null instead of inventing a zero balance',()=>{
 expect(reconciliationWorkspace.parse({...reconciliation,baseline:null,pending:null,expected_minor:null}).expected_minor).toBeNull();
});
it('rejects null or unsafe confirmed comparison amounts rather than rendering false money',()=>{
 for(const value of [null,undefined,'',Number.MAX_SAFE_INTEGER+1,1.5]){
  expect(reconciliationWorkspace.safeParse({...reconciliation,pending:{...reconciliation.pending,current_expected_minor:value}}).success).toBe(false);
 }
});
it('accepts PostgreSQL bigint strings without losing integer precision',()=>{
 const row=reconciliationWorkspace.parse({...reconciliation,pending:{...reconciliation.pending,gap_minor:'-5000'}});
 expect(row.pending?.gap_minor).toBe(-5000);
});
