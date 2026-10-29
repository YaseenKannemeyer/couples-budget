import { billPreview } from '@/features/relationships/bill-model';
import { parseBudgetAmount } from '@/features/budget/money-input';
import { billData } from '../test/fixtures/relationships';
const [a,b]=billData.members.map(m=>m.user_id);
const parse=(s:string)=>parseBudgetAmount(s,'USD','en-US');
it('matches exact server allocation for odd units and signed refunds',()=>{
 expect(billPreview(billData,'equal',{},parse)?.shares.map(s=>s.amount_minor)).toEqual([5001,5000]);
 expect(billPreview({...billData,expense:{...billData.expense,amount_minor:-101}},'custom',{[a]:'1',[b]:'2'},parse)?.shares.map(s=>s.amount_minor)).toEqual([-34,-67]);
});
it('requires exact percentage/fixed totals, supports zero shares and refuses missing income',()=>{
 expect(billPreview(billData,'percentage',{[a]:'25',[b]:'75'},parse)?.shares.map(s=>s.amount_minor)).toEqual([2500,7501]);
 expect(billPreview(billData,'percentage',{[a]:'20',[b]:'75'},parse)).toBeNull();
 expect(billPreview(billData,'fixed',{[a]:'0',[b]:'100.01'},parse)?.shares.map(s=>s.amount_minor)).toEqual([0,10001]);
 expect(billPreview({...billData,members:billData.members.map(m=>({...m,setup_step:0}))},'income',{},parse)).toBeNull();
});
it('avoids floating-point product drift for very large custom weights and amounts',()=>{
 const data={...billData,expense:{...billData.expense,amount_minor:999999999999}};
 const result=billPreview(data,'custom',{[a]:'999999999997',[b]:'333333333333'},parse)!;
 expect(result.shares.reduce((n,s)=>n+s.amount_minor,0)).toBe(999999999999);
 expect(result.shares.map(s=>s.amount_minor)).toEqual([749999999999,250000000000]);
});
it('parses decimal percentage input independently of zero/three-decimal currencies and supports locale decimals',()=>{
 const localized=(s:string)=>parseBudgetAmount(s,'USD','de-DE');
 expect(billPreview(billData,'percentage',{[a]:'33,33',[b]:'66,67'},localized)?.weights.map(w=>w.weight)).toEqual([3333,6667]);
 expect(billPreview(billData,'custom',{[a]:'1.5',[b]:'2'},parse)).toBeNull();
});
