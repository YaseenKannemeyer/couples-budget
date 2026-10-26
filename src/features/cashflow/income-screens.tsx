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
import { useMyHousehold } from '@/features/household/api';
import { formatCalendarDate, shiftCalendarDays, useHouseholdToday } from '@/features/payments/dates';
import { SpaceContext } from '@/hooks/use-theme';
import { useCashflowAction, useMyIncome } from './api';
import type { Occurrence, OwnIncome } from './schema';
import { FlowError, FlowLoading, useFlowMoney } from './ui';

export function IncomeScreen(){
  const household=useMyHousehold();const income=useMyIncome(household.data?.household.id);
  const today=useHouseholdToday(household.data?.household.timezone??'UTC');
  if(!household.data||!income.data||income.isError||household.isError)return <FlowLoading error={income.isError||household.isError} retry={()=>household.isError?household.refetch():income.refetch()}/>;
  return <SpaceContext value="private"><IncomeList data={income.data} today={today} currency={household.data.household.baseCurrency} timezone={household.data.household.timezone}/></SpaceContext>;
}
function IncomeList({data,today,currency,timezone}:{data:OwnIncome;today:string;currency:string;timezone:string}){
  const {t}=useTranslation();const {money,locale}=useFlowMoney(currency,timezone);const [all,setAll]=useState(false);const [limit,setLimit]=useState(30);
  const entries=data.occurrences.filter(o=>all||!o.expected_on||(o.expected_on>=shiftCalendarDays(today,-31)&&o.expected_on<=shiftCalendarDays(today,90)));
  return <Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{t('cashflow.myIncome')}</ThemedText>
    <ThemedText themeColor="textSecondary">{t('cashflow.incomePrivacy')}</ThemedText>
    {data.sources.map(s=><Card key={s.id}>
      <ThemedText type="smallBold">{s.name}</ThemedText>
      <ThemedText>{t(`budget.cadence.${s.cadence}`)} · {s.amount_minor===null?t('payments.unknownAmount'):money(s.amount_minor)}</ThemedText>
      <ThemedText themeColor="textSecondary">{t('cashflow.sharedPerPayday',{amount:money(s.shared_amount_minor),days:s.shared_delay_days})}</ThemedText>
      <Button variant="secondary" title={t('cashflow.configureContribution')} onPress={()=>router.push({pathname:'/income-entry',params:{source:s.id}})}/>
    </Card>)}
    {!data.sources.length&&<Button title={t('cashflow.setupPaydays')} variant="secondary" onPress={()=>router.push('/(onboarding)/budget')}/>}
    <Button title={t('cashflow.addIncome')} onPress={()=>router.push('/income-entry')}/>
    <ThemedText type="smallBold" accessibilityRole="header">{t('cashflow.occurrences')}</ThemedText>
    <ThemedText themeColor="textSecondary">{t(all?'cashflow.allIncomeHint':'cashflow.nearIncomeHint')}</ThemedText>
    {!entries.length&&<ThemedText>{t('cashflow.noIncome')}</ThemedText>}
    {entries.slice(0,limit).map(o=><Card key={o.id}>
      <ThemedText type="smallBold">{o.name}</ThemedText>
      <ThemedText>{(o.status==='received'?o.actual_on:o.expected_on)?formatCalendarDate((o.status==='received'?o.actual_on:o.expected_on)!,locale):t('cashflow.undated')} · {t(`cashflow.incomeStatus.${o.status}`)}</ThemedText>
      <ThemedText>{(o.status==='received'?o.actual_amount_minor:o.expected_amount_minor)===null?t('payments.unknownAmount'):money((o.status==='received'?o.actual_amount_minor:o.expected_amount_minor)!)}</ThemedText>
      <ThemedText themeColor="textSecondary">{t('cashflow.sharedEntry',{amount:money(o.shared_amount_minor),date:o.shared_on?formatCalendarDate(o.shared_on,locale):t('cashflow.undated')})}</ThemedText>
      <Button variant="secondary" title={t('cashflow.editIncome')} onPress={()=>router.push({pathname:'/income-entry',params:{id:o.id}})}/>
    </Card>)}
    {entries.length>limit&&<Button variant="secondary" title={t('cashflow.loadMore')} onPress={()=>setLimit(l=>l+30)}/>}
    <Button variant="ghost" title={t(all?'cashflow.showNearby':'cashflow.showAll')} onPress={()=>{setAll(!all);setLimit(30);}}/>
    <Button variant="ghost" title={t('cashflow.back')} onPress={()=>router.replace('/cash-flow')}/>
  </Screen>;
}
export function IncomeEntryScreen(){
  const {id,source}=useLocalSearchParams<{id?:string;source?:string}>();const household=useMyHousehold();
  const income=useMyIncome(household.data?.household.id);const today=useHouseholdToday(household.data?.household.timezone??'UTC');
  if(!household.data||!income.data||income.isError||household.isError)return <FlowLoading error={income.isError||household.isError} retry={()=>household.isError?household.refetch():income.refetch()}/>;
  const h=household.data.household;const sourceRow=income.data.sources.find(s=>s.id===source);const row=income.data.occurrences.find(o=>o.id===id);
  if((source&&!sourceRow)||(id&&!row))return <FlowLoading error retry={()=>income.refetch()}/>;
  return <SpaceContext value="private">{sourceRow?<Contribution householdId={h.id} currency={h.baseCurrency} timezone={h.timezone} source={sourceRow}/>:
    <IncomeEntry householdId={h.id} currency={h.baseCurrency} timezone={h.timezone} today={today} row={row}/>}</SpaceContext>;
}
type IncomeProps={householdId:string;currency:string;timezone:string};
function Contribution({householdId,currency,timezone,source}:IncomeProps&{source:OwnIncome['sources'][number]}){
  const {t}=useTranslation();const {edit,parse}=useFlowMoney(currency,timezone);const save=useCashflowAction(householdId);
  const [initial]=useState(source);const [amount,setAmount]=useState(edit(source.shared_amount_minor));const [delay,setDelay]=useState(String(source.shared_delay_days));
  const minor=parse(amount);const valid=minor!==null&&minor<=(source.amount_minor??1e12)&&/^\d+$/.test(delay)&&Number(delay)<=31;
  return <Screen><ThemedText type="subtitle">{t('cashflow.configureContribution')}</ThemedText>
    <ThemedText type="smallBold">{source.name}</ThemedText>
    <ThemedText themeColor="textSecondary">{t('cashflow.contributionConsent')}</ThemedText>
    <TextField label={t('cashflow.sharedAmount',{currency})} value={amount} onChangeText={setAmount} keyboardType="decimal-pad"/>
    <TextField label={t('cashflow.delay')} value={delay} onChangeText={setDelay} keyboardType="number-pad" hint={t('cashflow.delayHint')}/>
    <FlowError error={save.error}/>
    <Button title={t('cashflow.saveContribution')} disabled={!valid} loading={save.isPending} onPress={()=>save.mutate({kind:'contribution',id:source.id,version:initial.version,amount:minor!,delay:Number(delay)},
      {onSuccess:()=>router.replace('/income')})}/>
    <Button variant="ghost" title={t('common.cancel')} onPress={()=>router.back()}/>
  </Screen>;
}
export function IncomeEntry({householdId,currency,timezone,today,row}:IncomeProps&{today:string;row?:Occurrence}){
  const {t}=useTranslation();const {edit,parse}=useFlowMoney(currency,timezone);const save=useCashflowAction(householdId);
  const [initial]=useState(row);const [name,setName]=useState(row?.name??'');const [on,setOn]=useState(row?.expected_on??'');
  const [amount,setAmount]=useState(row?.expected_amount_minor!=null?edit(row.expected_amount_minor):'');
  const [status,setStatus]=useState<Occurrence['status']>(row?.status??'expected');
  const [actualOn,setActualOn]=useState(row?.actual_on??today);const [actualAmount,setActualAmount]=useState(row?.actual_amount_minor!=null?edit(row.actual_amount_minor):amount);
  const [sharedOn,setSharedOn]=useState(row?.shared_on??'');const [sharedAmount,setSharedAmount]=useState(edit(row?.shared_amount_minor??0));
  const [received,setReceived]=useState(row?.shared_received??false);
  const expectedMinor=amount.trim()?parse(amount):null;const actualMinor=parse(actualAmount);const sharedMinor=parse(sharedAmount);
  const dated=(v:string)=>isCalendarDate(v)&&v>=shiftCalendarDays(today,-366)&&v<=shiftCalendarDays(today,180);
  const valid=name.trim().length>0&&name.trim().length<=80&&(!on||dated(on))&&(!amount.trim()||expectedMinor!==null)
    &&(status!=='received'||(dated(actualOn)&&actualOn<=today&&actualMinor!==null))
    &&(status==='dismissed'||(sharedMinor!==null&&sharedMinor<=(status==='received'?actualMinor??0:expectedMinor??1e12)
      &&(sharedMinor===0||(isCalendarDate(sharedOn)&&sharedOn>=shiftCalendarDays(today,-366)&&sharedOn<=shiftCalendarDays(today,211)))&&(!received||(status==='received'&&sharedOn<=today))));
  return <Screen><ThemedText type="subtitle">{t(row?'cashflow.editIncome':'cashflow.addIncome')}</ThemedText>
    <ThemedText themeColor="textSecondary">{t('cashflow.incomeEntryHint')}</ThemedText>
    <TextField label={t('cashflow.incomeName')} value={name} onChangeText={setName} maxLength={80}/>
    <TextField label={t('cashflow.expectedOn')} hint={t('cashflow.dateOptional')} value={on} onChangeText={setOn}/>
    <TextField label={t('cashflow.expectedAmount',{currency})} hint={t('cashflow.amountOptional')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad"/>
    <Choices label={t('cashflow.incomeState')}>{(['expected','received','dismissed'] as const).map(s=><Choice key={s} label={t(`cashflow.incomeStatus.${s}`)} selected={status===s}
      onPress={()=>{setStatus(s);if(s!=='received')setReceived(false);}}/>)}</Choices>
    {status==='received'&&<>
      <TextField label={t('cashflow.actualOn')} hint={t('cashflow.dateHint')} value={actualOn} onChangeText={setActualOn}/>
      <TextField label={t('cashflow.actualAmount',{currency})} value={actualAmount} onChangeText={setActualAmount} keyboardType="decimal-pad"/>
    </>}
    {status!=='dismissed'&&<>
      <ThemedText type="smallBold">{t('cashflow.contribution')}</ThemedText>
      <ThemedText themeColor="textSecondary">{t('cashflow.entryConsent')}</ThemedText>
      <TextField label={t('cashflow.sharedAmount',{currency})} value={sharedAmount} onChangeText={setSharedAmount} keyboardType="decimal-pad"/>
      <TextField label={t('cashflow.sharedOn')} hint={t('cashflow.dateHint')} value={sharedOn} onChangeText={setSharedOn}/>
      {status==='received'&&<Choices label={t('cashflow.sharedState')}>
        <Choice label={t('cashflow.expected')} selected={!received} onPress={()=>setReceived(false)}/>
        <Choice label={t('cashflow.transferred')} selected={received} onPress={()=>setReceived(true)}/>
      </Choices>}
    </>}
    <FlowError error={save.error}/>
    <Button title={t('cashflow.saveIncome')} disabled={!valid} loading={save.isPending} onPress={()=>save.mutate({kind:'occurrence',id:initial?.id??null,version:initial?.version??0,
      values:{name,expectedOn:on||null,expectedAmountMinor:expectedMinor,status,actualOn:status==='received'?actualOn:null,actualAmountMinor:status==='received'?actualMinor:null,
        sharedOn:status==='dismissed'?null:sharedOn||null,sharedAmountMinor:status==='dismissed'?0:sharedMinor,sharedReceived:status==='received'&&received}},
      {onSuccess:()=>router.replace('/income')})}/>
    <Button title={t('common.cancel')} variant="ghost" onPress={()=>router.back()}/>
  </Screen>;
}
