import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Choice, Choices } from '@/components/ui/choices';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { isCalendarDate } from '@/features/budget/schema';
import { shiftCalendarDays } from '@/features/payments/dates';
import { useCashflowAction } from './api';
import { forecast } from './model';
import type { Workspace } from './schema';
import { FlowError, FlowLoading, useFlowData, useFlowMoney } from './ui';

type Props={data:Workspace;householdId:string;currency:string;timezone:string};
export function CashflowSetupScreen(){
  const {household,query}=useFlowData();
  if(!household||!query.data||query.isError)return <FlowLoading error={query.isError} retry={()=>query.refetch()}/>;
  return <Setup data={query.data} householdId={household.household.id} currency={household.household.baseCurrency} timezone={household.household.timezone}/>;
}
function Setup(props:Props){
  const {t}=useTranslation(); const {data,householdId,currency,timezone}=props;
  const {edit,parse}=useFlowMoney(currency,timezone); const save=useCashflowAction(householdId);
  const [initial]=useState(data.balance);
  const [amount,setAmount]=useState(initial?edit(Math.abs(initial.amount_minor)):'');
  const [negative,setNegative]=useState((initial?.amount_minor??0)<0);
  const [on,setOn]=useState(initial?.as_of_on??data.today);
  const [threshold,setThreshold]=useState(edit(initial?.low_threshold_minor??0));
  const valid=parse(amount)!==null&&parse(threshold)!==null&&isCalendarDate(on)&&on<=data.today&&on>=shiftCalendarDays(data.today,-365);
  return <Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{t('cashflow.setup')}</ThemedText>
    <ThemedText themeColor="textSecondary">{t('cashflow.balanceHint')}</ThemedText>
    <TextField label={t('cashflow.closingBalance',{currency})} value={amount} onChangeText={setAmount} keyboardType="decimal-pad"/>
    <Choices label={t('cashflow.balanceSign')}>
      <Choice label={t('cashflow.positive')} selected={!negative} onPress={()=>setNegative(false)}/>
      <Choice label={t('cashflow.negative')} selected={negative} onPress={()=>setNegative(true)}/>
    </Choices>
    <TextField label={t('cashflow.asOf')} hint={t('cashflow.dateHint')} value={on} onChangeText={setOn} autoCapitalize="none"/>
    <TextField label={t('cashflow.threshold',{currency})} value={threshold} onChangeText={setThreshold} keyboardType="decimal-pad"/>
    <FlowError error={save.error}/>
    <Button title={t('cashflow.saveBalance')} disabled={!valid} loading={save.isPending} onPress={()=>save.mutate({kind:'balance',version:initial?.version??0,
      on,amount:parse(amount)!*(negative?-1:1),threshold:parse(threshold)!},{onSuccess:()=>router.replace('/cash-flow')})}/>
    <ThemedText type="subtitle" accessibilityRole="header">{t('cashflow.budgetLinks')}</ThemedText>
    <ThemedText themeColor="textSecondary">{t('cashflow.budgetHint')}</ThemedText>
    {!data.budgets.length&&<Button title={t('budget.review')} variant="secondary" onPress={()=>router.push('/(onboarding)/budget')}/>}
    {data.budgets.map(b=><BudgetLink key={b.id} {...props} budget={b}/>)}
    <Button title={t('cashflow.back')} variant="ghost" onPress={()=>router.replace('/cash-flow')}/>
  </Screen>;
}
export function BudgetLink({data,householdId,currency,timezone,budget,onSaved,onReload,unassignedLabel}:{budget:Workspace['budgets'][number];onSaved?:()=>void;onReload?:()=>void;unassignedLabel?:string}&Props){
  const {t}=useTranslation(); const {money}=useFlowMoney(currency,timezone);const save=useCashflowAction(householdId);
  const [initial]=useState(budget);const [category,setCategory]=useState(budget.category_id);
  return <Card>
    <ThemedText type="smallBold">{budget.name} · {money(budget.amount_minor)}</ThemedText>
    <Choices label={t('cashflow.category')}>
      <Choice label={unassignedLabel??t('cashflow.unmapped')} selected={!category} onPress={()=>setCategory(null)}/>
      {data.categories.filter(c=>!c.archived).map(c=><Choice key={c.id} label={c.emoji?`${c.emoji} ${c.name}`:c.name} selected={category===c.id} onPress={()=>setCategory(c.id)}/>)}
    </Choices>
    <FlowError error={save.error} onReload={onReload} reloadLabel={onReload?t('categories.reload'):undefined}/>
    <Button title={t('cashflow.saveLink')} variant="secondary" loading={save.isPending} disabled={category===initial.category_id}
      onPress={()=>save.mutate({kind:'plan',type:'budget',id:budget.id,version:initial.version,values:category?{categoryId:category}:null},
        {onSuccess:()=>onSaved?onSaved():router.replace('/cash-flow')})}/>
  </Card>;
}
export function ForecastGoalScreen(){
  const {id}=useLocalSearchParams<{id?:string}>(); const {household,query}=useFlowData();
  if(!household||!query.data||query.isError)return <FlowLoading error={query.isError} retry={()=>query.refetch()}/>;
  if(id&&!query.data.goals.some(g=>g.id===id))return <Unavailable/>;
  return <Goal data={query.data} householdId={household.household.id} currency={household.household.baseCurrency} timezone={household.household.timezone} id={id}/>;
}
function Goal({data,householdId,currency,timezone,id}:Props&{id?:string}){
  const {t}=useTranslation();const {edit,parse}=useFlowMoney(currency,timezone); const save=useCashflowAction(householdId);
  const [initial]=useState(data.goals.find(g=>g.id===id)); const [name,setName]=useState(initial?.name??'');
  const [amount,setAmount]=useState(initial?edit(initial.amount_minor):'');const [on,setOn]=useState(initial?.due_on??data.today);
  const [category,setCategory]=useState(initial?.category_id??'');
  const valid=name.trim().length>0&&name.trim().length<=80&&(parse(amount)??0)>0&&!!category&&isCalendarDate(on)&&on>=data.today&&on<=shiftCalendarDays(data.today,180);
  return <Screen><ThemedText type="subtitle">{t('cashflow.addGoal')}</ThemedText>
    <ThemedText themeColor="textSecondary">{t('cashflow.goalHint')}</ThemedText>
    <TextField label={t('cashflow.goalName')} value={name} onChangeText={setName} maxLength={80}/>
    <TextField label={t('cashflow.amount',{currency})} value={amount} onChangeText={setAmount} keyboardType="decimal-pad"/>
    <TextField label={t('cashflow.on')} hint={t('cashflow.dateHint')} value={on} onChangeText={setOn}/>
    <Choices label={t('cashflow.category')}>{data.categories.filter(c=>!c.archived).map(c=><Choice key={c.id} label={c.emoji?`${c.emoji} ${c.name}`:c.name} selected={category===c.id} onPress={()=>setCategory(c.id)}/>)}</Choices>
    <FlowError error={save.error}/>
    <Button title={t('cashflow.saveGoal')} disabled={!valid} loading={save.isPending} onPress={()=>save.mutate({kind:'plan',type:'goal',id:initial?.id??null,version:initial?.version??0,
      values:{name,categoryId:category,amountMinor:parse(amount),dueOn:on}},{onSuccess:()=>router.replace('/cash-flow')})}/>
    {initial&&<Button variant="secondary" title={t('cashflow.removeGoal')} loading={save.isPending} onPress={()=>save.mutate({kind:'plan',type:'goal',id:initial.id,version:initial.version,values:null},{onSuccess:()=>router.replace('/cash-flow')})}/>}
    <Button variant="ghost" title={t('common.cancel')} onPress={()=>router.back()}/>
  </Screen>;
}
export function ForecastEditScreen(){
  const {item}=useLocalSearchParams<{item?:string}>();const {household,query}=useFlowData();
  if(!household||!query.data||query.isError)return <FlowLoading error={query.isError} retry={()=>query.refetch()}/>;
  const target=forecast(query.data).items.find(i=>i.key===item);
  if(!target||target.confirmed||target.kind==='transaction')return <Unavailable/>;
  return <Correction data={query.data} householdId={household.household.id} currency={household.household.baseCurrency} timezone={household.household.timezone} itemKey={target.key}/>;
}
function Correction({data,householdId,currency,timezone,itemKey}:Props&{itemKey:string}){
  const {t}=useTranslation();const {edit,parse}=useFlowMoney(currency,timezone);const save=useCashflowAction(householdId);
  const [initial]=useState(()=>data.overrides.find(o=>o.item_key===itemKey));
  const [target]=useState(()=>forecast(data).items.find(i=>i.key===itemKey)!);
  const [on,setOn]=useState(initial?.due_on??'');const [amount,setAmount]=useState(initial?.amount_minor!=null?edit(initial.amount_minor):'');
  const [dismissed,setDismissed]=useState(initial?.dismissed??false);
  const valid=(!on||(isCalendarDate(on)&&on>=data.today&&on<=shiftCalendarDays(data.today,180)))&&(!amount||parse(amount)!==null);
  return <Screen><ThemedText type="subtitle">{t('cashflow.correct')}</ThemedText>
    <ThemedText type="smallBold">{target.kind==='income'?t('cashflow.contribution'):target.name}</ThemedText>
    <ThemedText themeColor="textSecondary">{t('cashflow.correctionHint')}</ThemedText>
    <TextField label={t('cashflow.newDate')} hint={t('cashflow.optionalHint')} value={on} onChangeText={setOn} placeholder={target.originalOn}/>
    <TextField label={t('cashflow.newAmount',{currency})} hint={t('cashflow.optionalAmount')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad"/>
    <Choices label={t('cashflow.include')}>
      <Choice label={t('cashflow.expected')} selected={!dismissed} onPress={()=>setDismissed(false)}/>
      <Choice label={t('cashflow.dismissed')} selected={dismissed} onPress={()=>setDismissed(true)}/>
    </Choices>
    <FlowError error={save.error}/>
    <Button title={t('cashflow.saveCorrection')} loading={save.isPending} disabled={!valid} onPress={()=>save.mutate({kind:'override',key:itemKey,version:initial?.version??0,
      values:{dueOn:on||null,amountMinor:amount?parse(amount):null,dismissed}},{onSuccess:()=>router.replace('/cash-flow')})}/>
    {initial&&<Button variant="secondary" title={t('cashflow.resetCorrection')} loading={save.isPending} onPress={()=>save.mutate({kind:'override',key:itemKey,version:initial.version,values:null},{onSuccess:()=>router.replace('/cash-flow')})}/>}
    <Button title={t('common.cancel')} variant="ghost" onPress={()=>router.back()}/>
  </Screen>;
}
function Unavailable(){const {t}=useTranslation();return <Screen><ThemedText>{t('cashflow.unavailable')}</ThemedText><Button title={t('cashflow.back')} onPress={()=>router.replace('/cash-flow')}/></Screen>;}
