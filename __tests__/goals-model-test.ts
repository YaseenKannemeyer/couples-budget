import { forecast } from '@/features/cashflow/model';
import { goalProgress } from '@/features/goals/model';
import { goalWorkspace } from '@/features/goals/schema';
import { cashflow } from '../test/fixtures/cashflow';
import { jointGoal, goalsWorkspace } from '../test/fixtures/goals';
const cat=cashflow.categories[0].id;
const data={...cashflow,today:'2026-10-27',balance:{as_of_on:'2026-10-27',amount_minor:10000,low_threshold_minor:0,version:1},budgets:[],payments:[],income:[],transactions:[],goals:[]};
it('measures both partners against their own shares rather than comparing absolute amounts',()=>{
 const result=goalProgress(jointGoal);expect(result.shares.map(s=>s.percent)).toEqual([100,100]);expect(result.remaining).toBe(400000);
});
it('keeps actual cash unchanged while subtracting held savings from projected availability',()=>{
 const result=forecast({...data,savings:{reserved_minor:2000,month_allocations:[],plans:[]}},'2026-10-31');
 expect(result.confirmed).toBe(10000);expect(result.projected).toBe(8000);expect(result.daily['2026-10-27']).toBe(8000);
});
it('counts goal earmarks, remaining monthly contributions and category reservations exactly once',()=>{
 const result=forecast({...data,budgets:[{id:'budget',name:'Savings',amount_minor:3000,category_id:cat,version:1}],savings:{reserved_minor:1000,
  month_allocations:[{category_id:cat,amount_minor:1000}],plans:[{id:jointGoal.id,month_on:'2026-10-01',name:jointGoal.name,category_id:cat,due_on:'2026-10-31',amount_minor:1000}]}},'2026-10-31');
 expect(result.items.find(i=>i.key===`budget:${cat}:2026-10`)?.amount).toBe(1000);expect(result.projected).toBe(7000);
 expect(result.items.find(i=>i.key.startsWith('savings:'))?.readOnly).toBe(true);
});
it('keeps a closing-day goal reservation attributed to its own monthly category plan at month end',()=>{
 const result=forecast({...data,today:'2026-10-31',balance:{...data.balance,as_of_on:'2026-10-31'},budgets:[{id:'budget',name:'Savings',amount_minor:3000,category_id:cat,version:1}],
  savings:{reserved_minor:1000,month_allocations:[{category_id:cat,amount_minor:1000}],plans:[{id:jointGoal.id,month_on:'2026-10-01',name:jointGoal.name,category_id:cat,due_on:'2026-10-31',amount_minor:1000}]}},'2026-11-01');
 expect(result.items.find(i=>i.key===`budget:${cat}:2026-10`)?.amount).toBe(1000);expect(result.projected).toBe(4000);
});
it('rejects null/unsafe saved-money responses instead of rendering them as zero',()=>{
 for(const saved_minor of [null,'',Number.MAX_SAFE_INTEGER+1])expect(goalWorkspace.safeParse({...goalsWorkspace,goals:[{...jointGoal,saved_minor}]}).success).toBe(false);
});
