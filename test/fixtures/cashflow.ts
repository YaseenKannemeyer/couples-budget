import { workspace as paymentWorkspace } from './payments';
import type { Workspace } from '@/features/cashflow/schema';
export const cashflow:Workspace={today:'2026-10-25',balance:{as_of_on:'2026-10-24',amount_minor:100000,low_threshold_minor:10000,version:1},
  income:[{on_date:'2026-10-28',amount_minor:50000,confirmed:false}],
  payments:[{id:'00000000-0000-4000-8000-000000000002',name:'Internet',category_id:paymentWorkspace.categories[0].id,
    recurrence:'monthly',due_start:'2026-10-26',due_end:'2026-10-28',anchor_start_day:26,anchor_end_day:28,estimate_minor:20000}],
  transactions:[],categories:paymentWorkspace.categories,budgets:[],goals:[],overrides:[]};
