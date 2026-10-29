/** Pure forecast shared by the app and the scheduled worker. No platform imports. */
export type ForecastInput = {
 today: string; balance: { as_of_on: string; amount_minor: number; low_threshold_minor: number } | null;
 income: { on_date: string; confirmed: boolean; amount_minor: number }[];
 transactions: { id: string; name: string | null; on_date: string; category_id: string; amount_minor: number }[];
 payments: { id: string; name: string; category_id: string; recurrence: 'one_time' | 'monthly'; due_start: string; due_end: string; anchor_start_day: number; anchor_end_day: number; estimate_minor: number | null }[];
 goals: { id: string; name: string; category_id: string; due_on: string; amount_minor: number }[];
 budgets: { category_id: string | null; amount_minor: number }[];
 categories: { id: string; name: string }[];
 overrides: { item_key: string; due_on: string | null; amount_minor: number | null; dismissed: boolean }[];
 savings?: { reserved_minor: number; month_allocations: { category_id: string; amount_minor: number }[];
  plans: { id: string; month_on: string; name: string; category_id: string; due_on: string; amount_minor: number }[] };
};
export function shiftCalendarDays(value: string, days: number) {
 const date = new Date(`${value}T12:00:00Z`);date.setUTCDate(date.getUTCDate() + days);return date.toISOString().slice(0,10);
}
export type ForecastItem = {
  key: string; kind: 'income' | 'payment' | 'budget' | 'goal' | 'transaction'; name: string;
  on: string; originalOn: string; end?: string; amount: number | null; confirmed: boolean;
  categoryId?: string; corrected?: boolean; dismissed?: boolean; late?: boolean; readOnly?: boolean; budgetMonth?: string;
};
export function monthDate(month: string, day: number) {
  const [year, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return `${month}-${String(Math.min(day,last)).padStart(2,'0')}`;
}
export function nextMonth(month: string, delta = 1) {
  const date = new Date(`${month}-15T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth()+delta);
  return date.toISOString().slice(0,7);
}
function add(a: number, b: number) {
  const result = a+b;
  if (!Number.isSafeInteger(result)) throw new Error('Forecast overflow');
  return result;
}
/** Pure integer forecast. Dates are household calendar dates, never device midnights. */
export function forecast(data: ForecastInput, horizon = shiftCalendarDays(data.today,90)) {
  const items: ForecastItem[] = [];
  const gaps = new Set<'balance'|'staleBalance'|'budgets'|'unknownPayment'|'lateIncome'|'income'|'scheduleLimit'>();
  const baseline = data.balance?.as_of_on ?? data.today;
  const firstFuture = baseline >= data.today ? shiftCalendarDays(baseline,1) : data.today;
  const corrections = new Map(data.overrides.map(o=>[o.item_key,o]));
  const apply = (item: ForecastItem) => {
    const o = !item.confirmed && corrections.get(item.key);
    if (o) { item = { ...item, on: o.due_on ?? item.on, amount: o.amount_minor ?? item.amount, corrected: true, dismissed: o.dismissed }; }
    if (item.kind==='income' && !item.confirmed) {
      item.late = item.on < data.today || item.on <= baseline;
      if (item.late && !item.dismissed) gaps.add('lateIncome');
    }
    items.push(item);
  };
  for (const i of data.income) apply({ key: `${i.confirmed ? 'received' : 'income'}:${i.on_date}`,kind:'income',name:'',
    on:i.on_date,originalOn:i.on_date,amount:i.amount_minor,confirmed:i.confirmed });
  for (const t of data.transactions) items.push({ key:`transaction:${t.id}`,kind:'transaction',name:t.name ?? '',
    on:t.on_date,originalOn:t.on_date,amount:-t.amount_minor,confirmed:t.on_date<=data.today,categoryId:t.category_id });
  for (const p of data.payments) {
    let cycle=p.due_start; let count=0;
    while (cycle<=horizon && count<600) {
      apply({ key:`payment:${p.id}:${cycle}`,kind:'payment',name:p.name,on:cycle,originalOn:cycle,
        end: p.recurrence==='monthly' ? monthDate(cycle.slice(0,7),p.anchor_end_day) : p.due_end,
        amount:p.estimate_minor,confirmed:false,categoryId:p.category_id });
      count++;
      if (p.recurrence==='one_time') break;
      cycle=monthDate(nextMonth(cycle.slice(0,7)),p.anchor_start_day);
    }
    if (count===600 && cycle<=horizon) gaps.add('scheduleLimit');
  }
  for (const g of data.goals) if(g.due_on<=horizon) apply({ key:`goal:${g.id}`,kind:'goal',name:g.name,
    on:g.due_on,originalOn:g.due_on,amount:g.amount_minor,confirmed:false,categoryId:g.category_id });
  for (const g of data.savings?.plans ?? []) if (g.due_on <= horizon) items.push({ key: `savings:${g.id}:${g.month_on}`, kind: 'goal', name: g.name,
    on: g.due_on, originalOn: g.due_on, amount: g.amount_minor, confirmed: false, categoryId: g.category_id, readOnly: true, budgetMonth: g.month_on.slice(0, 7) });
  if (data.budgets.some(b=>!b.category_id)) gaps.add('budgets');
  const budgets=new Map<string,number>();
  for (const b of data.budgets) if (b.category_id) budgets.set(b.category_id,add(budgets.get(b.category_id)??0,b.amount_minor));
  for (let month=data.today.slice(0,7); month<=horizon.slice(0,7); month=nextMonth(month)) {
    for (const [cat,amount] of budgets) {
      // A closing balance includes prior cash activity, but the whole month's
      // spending still consumes its plan. Pending bills/goals consume the same plan.
      let used=month === data.today.slice(0,7) ? (data.savings?.month_allocations.find(a => a.category_id === cat)?.amount_minor ?? 0) : 0;
      for (const i of items) if (!i.dismissed && i.categoryId===cat && (i.budgetMonth ?? (i.kind==='payment'||i.kind==='goal' ? (i.on<firstFuture?firstFuture:i.on) : i.on).slice(0,7))===month && i.amount!==null) {
        if(i.kind==='transaction') used=add(used,-i.amount);
        else if(i.kind==='payment'||i.kind==='goal') used=add(used,i.amount);
      }
      const residual=Math.max(0,amount-used);
      const on=month===data.today.slice(0,7) ? firstFuture : `${month}-01`;
      apply({key:`budget:${cat}:${month}`,kind:'budget',name:data.categories.find(c=>c.id===cat)?.name??'',
        on,originalOn:on,amount:residual,confirmed:false,categoryId:cat});
    }
  }
  if(items.some(i=>i.kind==='payment'&&!i.dismissed&&i.amount===null)) gaps.add('unknownPayment');
  const active=items.filter(i=>!i.dismissed && i.on<=horizon);
  if (!active.some(i=>i.kind==='income'&&!i.confirmed&&!i.late&&(i.amount??0)>0&&i.on>baseline)) gaps.add('income');
  if (!data.balance) gaps.add('balance');
  if (data.balance && (baseline<shiftCalendarDays(data.today,-365)||baseline>data.today)) gaps.add('staleBalance');
  let confirmed=data.balance?.amount_minor??0;
  for (const i of active) if (i.confirmed&&i.on>baseline&&i.on<=data.today&&i.amount!==null) confirmed=add(confirmed,i.amount);
  const reservedSavings = data.savings?.reserved_minor ?? 0;
  let projected=add(confirmed,-reservedSavings); let lowest=projected; let lowestOn=data.today;
  const nextIncome=active.filter(i=>i.kind==='income'&&!i.confirmed&&!i.late&&(i.amount??0)>0&&i.on>baseline).sort((a,b)=>a.on.localeCompare(b.on))[0];
  const events=active.filter(i=>!i.confirmed&&i.amount!==null&&!(i.kind==='income'&&(i.late||i.on<=baseline)))
    .map(i=>({ ...i, on:i.kind==='income'||i.on>=firstFuture ? i.on : firstFuture,
      delta: i.kind==='transaction'||i.kind==='income' ? i.amount! : -i.amount! }))
    .filter(i=>i.on>baseline&&i.on<=horizon).sort((a,b)=>a.on.localeCompare(b.on)||a.delta-b.delta||a.key.localeCompare(b.key));
  let beforePayday=projected;
  const daily: Record<string,number> = reservedSavings > 0 ? { [data.today]: projected } : {};
  for(const e of events) {
    projected=add(projected,e.delta);
    daily[e.on]=projected;
    if(projected<lowest) { lowest=projected; lowestOn=e.on; }
    if(!nextIncome||e.on<=nextIncome.on) beforePayday=Math.min(beforePayday,projected);
  }
  const valid=!!data.balance&&!gaps.has('staleBalance');
  return { items:items.sort((a,b)=>a.on.localeCompare(b.on)||a.key.localeCompare(b.key)), gaps:[...gaps],
    confirmed:valid?confirmed:null,projected:valid?projected:null,lowest:valid?lowest:null,lowestOn,
    beforePayday:valid?beforePayday:null,nextIncomeOn:nextIncome?.on??null,
    low:valid&&beforePayday<data.balance!.low_threshold_minor,daily,horizon,reservedSavings };
}
