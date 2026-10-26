import { cashflow } from '../test/fixtures/cashflow';
import { forecast,monthDate } from '@/features/cashflow/model';
const cat=cashflow.categories[0].id;
const until='2026-10-31';
it('requires a confirmed starting balance and rejects stale anchors',()=>{
  expect(forecast({...cashflow,balance:null},until).confirmed).toBeNull();
  expect(forecast({...cashflow,balance:{...cashflow.balance!,as_of_on:'2020-01-01'}},until).gaps).toContain('staleBalance');
});
it('separates confirmed activity from expected income and pending commitments',()=>{
  const data={...cashflow,transactions:[{id:'actual',name:'Fuel',on_date:'2026-10-25',category_id:cat,amount_minor:12000}]};
  const f=forecast(data,until);
  expect(f.confirmed).toBe(88000);expect(f.projected).toBe(118000);expect(f.lowest).toBe(68000);expect(f.lowestOn).toBe('2026-10-26');
});
it('does not count activity on or before the closing date twice and adds refunds',()=>{
  const f=forecast({...cashflow,transactions:[
    {id:'before',name:'Included',on_date:'2026-10-24',category_id:cat,amount_minor:50000},
    {id:'refund',name:'Refund',on_date:'2026-10-25',category_id:cat,amount_minor:-7000},
  ]},until);
  expect(f.confirmed).toBe(107000);expect(f.projected).toBe(137000);
});
it('reserves only remaining monthly spend after actuals, bills and goals within the same category',()=>{
  const f=forecast({...cashflow,
    transactions:[{id:'actual',name:'Already spent',on_date:'2026-10-24',category_id:cat,amount_minor:10000}],
    budgets:[{id:'b',name:'Utilities',amount_minor:50000,category_id:cat,version:1}],
    goals:[{id:'g',name:'Savings',amount_minor:5000,category_id:cat,due_on:'2026-10-27',version:1}],
  },until);
  expect(f.items.find(i=>i.kind==='budget')?.amount).toBe(15000);
  expect(f.projected).toBe(110000); // 100000 + 50000 - 20000 - 5000 - 15000
});
it('combines lines in one category, flags uncovered lines and never guesses unknown bills',()=>{
  const f=forecast({...cashflow,payments:[{...cashflow.payments[0],estimate_minor:null}],budgets:[
    {id:'b',name:'A',amount_minor:50000,category_id:cat,version:1},
    {id:'c',name:'B',amount_minor:10000,category_id:cat,version:1},
    {id:'d',name:'Unmapped',amount_minor:999999,category_id:null,version:0},
  ]},until);
  expect(f.gaps).toEqual(expect.arrayContaining(['unknownPayment','budgets']));
  expect(f.items.find(i=>i.kind==='budget')?.amount).toBe(60000);
});
it('carries overdue obligations forward and deducts them from the current month’s remaining reserve',()=>{
  const f=forecast({...cashflow,payments:[{...cashflow.payments[0],recurrence:'one_time',due_start:'2026-09-20',due_end:'2026-09-20'}],
    budgets:[{id:'b',name:'Plan',amount_minor:50000,category_id:cat,version:1}]},until);
  expect(f.items.find(i=>i.kind==='budget')?.amount).toBe(30000);
  expect(f.projected).toBe(100000);
});
it('does not spend late unconfirmed income, but counts confirmed transfers after the balance date',()=>{
  const f=forecast({...cashflow,income:[{on_date:'2026-10-23',amount_minor:900000,confirmed:false},{on_date:'2026-10-25',amount_minor:2000,confirmed:true}]},until);
  expect(f.gaps).toEqual(expect.arrayContaining(['lateIncome','income']));expect(f.confirmed).toBe(102000);expect(f.projected).toBe(82000);
});
it('allows corrections and dismissals without changing input schedules or confirming income',()=>{
  const input=structuredClone(cashflow);
  input.overrides=[{item_key:`payment:${input.payments[0].id}:2026-10-26`,due_on:'2026-10-29',amount_minor:10000,dismissed:false,version:1},
    {item_key:'income:2026-10-28',due_on:null,amount_minor:null,dismissed:true,version:1}];
  const f=forecast(input,until);
  expect(f.projected).toBe(90000);expect(input.payments[0].estimate_minor).toBe(20000);expect(input.payments[0].due_start).toBe('2026-10-26');
  expect(f.confirmed).toBe(100000);
});
it('keeps the original monthly day through February and respects window endpoints',()=>{
  expect(monthDate('2027-02',31)).toBe('2027-02-28');expect(monthDate('2028-02',31)).toBe('2028-02-29');
  const f=forecast({...cashflow,payments:[{...cashflow.payments[0],due_start:'2027-01-31',due_end:'2027-01-31',anchor_start_day:31,anchor_end_day:31}]},'2027-03-31');
  expect(f.items.filter(i=>i.kind==='payment').map(i=>i.on)).toEqual(['2027-01-31','2027-02-28','2027-03-31']);
});
it('warns about the conservative low point before payday, including same-day outflows first',()=>{
  const f=forecast({...cashflow,balance:{...cashflow.balance!,amount_minor:5000},income:[{on_date:'2026-10-26',amount_minor:50000,confirmed:false}]},until);
  expect(f.beforePayday).toBe(-15000);expect(f.low).toBe(true);expect(f.projected).toBe(35000);
});
it('never lets a dismissal or correction apply to confirmed income',()=>{
  const f=forecast({...cashflow,income:[{on_date:'2026-10-25',amount_minor:10000,confirmed:true}],overrides:[
    {item_key:'received:2026-10-25',due_on:null,amount_minor:100000,dismissed:true,version:1},
  ]},until);expect(f.confirmed).toBe(110000);
});
it('keeps future-dated ledger entries expected until their household date arrives',()=>{
  const f=forecast({...cashflow,transactions:[{id:'future',name:'Future expense',on_date:'2026-10-27',category_id:cat,amount_minor:1200}]},until);
  expect(f.confirmed).toBe(100000);expect(f.projected).toBe(128800);
});

it('does not treat a contribution corrected to zero as an incoming payday',()=>{
  const f=forecast({...cashflow,income:[...cashflow.income,{on_date:'2026-10-30',amount_minor:9000,confirmed:false}],
    overrides:[{item_key:'income:2026-10-28',due_on:null,amount_minor:0,dismissed:false,version:1}]},until);
  expect(f.nextIncomeOn).toBe('2026-10-30');
});
