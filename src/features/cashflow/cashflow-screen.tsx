import { Disclosure } from '@/components/ui/disclosure';
import { GuideSlot } from '@/features/guides/guide-slot';
import { useGuideAction } from '@/features/guides/context';
import { useLocales } from 'expo-localization';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { HeroCard, HeroRow } from '@/components/ui/hero-card';
import { PeriodBarChart } from '@/components/ui/charts';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { SummaryRow } from '@/components/ui/summary-row';
import { Radius, Spacing } from '@/constants/theme';
import { formatCalendarDate, shiftCalendarDays } from '@/features/payments/dates';
import { forecast, nextMonth, type ForecastItem } from './model';
import type { Workspace } from './schema';
import { FlowLoading, useFlowData, useFlowMoney } from './ui';

export function CashflowScreen() {
  const {household,query}=useFlowData();
  if(!household||!query.data||query.isError)return <FlowLoading error={query.isError} retry={()=>query.refetch()}/>;
  return <CashflowCalendar data={query.data} currency={household.household.baseCurrency} timezone={household.household.timezone}
    refreshing={query.isFetching} onRefresh={()=>query.refetch()}/>;
}
export function CashflowCalendar({data,currency,timezone,refreshing=false,onRefresh}:{data:Workspace;currency:string;timezone:string;refreshing?:boolean;onRefresh:()=>unknown}) {
  const guideAction = useGuideAction();
  const {t}=useTranslation(); const {money}=useFlowMoney(currency,timezone); const locale=useLocales()[0]?.languageTag??'en';
  const [calendarWidth,setCalendarWidth]=useState(336);
  const [selected,setSelected]=useState(data.today); const month=selected.slice(0,7);
  const result=useMemo(()=>forecast(data),[data]);
  const days=new Date(`${nextMonth(month)}-01T12:00:00Z`);days.setUTCDate(0);
  const count=days.getUTCDate();
  const onDay=result.items.filter(i=>i.on===selected);
  const latest=Object.keys(result.daily).filter(d=>d<=selected).sort().at(-1);
  const selectedBalance=latest?result.daily[latest]:result.confirmed;
  const chartItems = result.confirmed === null ? [] : [0,7,14,21].map(offset => {
    const date = shiftCalendarDays(data.today, offset);
    const prior = Object.keys(result.daily).filter(day => day <= date).sort().at(-1);
    const amount = prior ? result.daily[prior] : result.confirmed!;
    return { id: date, label: formatCalendarDate(date, locale), amount, value: money(amount) };
  });
  const overdue=result.items.filter(i=>!i.confirmed&&!i.dismissed&&i.on<data.today&&(i.kind==='payment'||i.kind==='goal'));
  const edit=(item:ForecastItem)=>router.push({pathname:'/forecast-edit',params:{item:item.key}});
  const row=(item:ForecastItem)=> <View key={item.key} style={styles.agendaRow}>
    <ThemedText type="smallBold">{item.kind==='income'?t('cashflow.contribution'):item.name||t('cashflow.transaction')}</ThemedText>
    <ThemedText themeColor="textSecondary">{t(`cashflow.kind.${item.kind}`)} · {t(item.dismissed?'cashflow.dismissed':item.confirmed?'cashflow.confirmed':'cashflow.expected')}
      {item.corrected?` · ${t('cashflow.corrected')}`:''}</ThemedText>
    <ThemedText>{item.amount===null?t('payments.unknownAmount'):money(item.kind==='payment'||item.kind==='budget'||item.kind==='goal'?-item.amount:item.amount)}</ThemedText>
    {item.end&&item.end!==item.originalOn&&item.on===item.originalOn&&<ThemedText type="small">{t('cashflow.window',{date:formatCalendarDate(item.end,locale)})}</ThemedText>}
    {item.late&&<ThemedText themeColor="attention">{t('cashflow.lateIncome')}</ThemedText>}
    {!item.confirmed&&item.kind!=='transaction'&&<Button variant="ghost" title={t('cashflow.correct')} onPress={()=>edit(item)}/>}
  </View>;
  return <Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{t('cashflow.title')}</ThemedText>
    <ThemedText themeColor="textSecondary">{t('cashflow.description',{timezone})}</ThemedText>
    <GuideSlot target="cashflow-summary" offer="cashflow" />
    {result.confirmed === null ? <Card><ThemedText>{t('cashflow.needBalance')}</ThemedText></Card> : <HeroCard
      title={t('cashflow.confirmedBalance')} value={money(result.confirmed)} icon="wallet"
      warning={result.low ? t('cashflow.lowWarning',{amount:money(result.beforePayday!)}) : undefined}>
      <HeroRow label={t('cashflow.lowest',{date:formatCalendarDate(result.lowestOn,locale)})} value={money(result.lowest!)} />
      <HeroRow label={t('cashflow.projected',{date:formatCalendarDate(result.horizon,locale)})} value={money(result.projected!)} />
    </HeroCard>}
    <ThemedText type="small" themeColor="textSecondary">{t('cashflow.estimateHint')}</ThemedText>
    <Button variant="secondary" title={t('cashflow.setup')} onPress={()=>router.push('/cash-flow-setup')} />
    {result.confirmed !== null && <Disclosure title={t('phase18.forecastChart')}>
      <ThemedText type="section" accessibilityRole="header">{t('design.forecastChart')}</ThemedText>
      <PeriodBarChart items={chartItems} activeId={data.today} reference={result.confirmed}
        referenceLabel={t('cashflow.confirmedBalance')}
        summary={t('design.forecastSummary',{details:chartItems.map(item=>`${item.label}: ${item.value}`).join('; ')})} />
    </Disclosure>}
    {result.gaps.filter(g=>g!=='balance').map(g=><ThemedText key={g} themeColor="attention">{t(`cashflow.gaps.${g}`)}</ThemedText>)}
    <Button title={t('cashflow.myIncome')} variant="secondary" onPress={()=>router.push('/income')}/>
    <GuideSlot target="cashflow-calendar" />
    <View style={styles.monthNav}>
      <Button title={t('cashflow.previous')} variant="ghost" disabled={month<=data.today.slice(0,7)} onPress={()=>setSelected(`${nextMonth(month,-1)}-01`)}/>
      <ThemedText type="smallBold">{new Intl.DateTimeFormat(locale,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${month}-15T12:00:00Z`))}</ThemedText>
      <Button title={t('cashflow.next')} variant="ghost" disabled={nextMonth(month)>result.horizon.slice(0,7)} onPress={()=>setSelected(`${nextMonth(month)}-01`)}/>
    </View>
    <View onLayout={e=>setCalendarWidth(Math.max(336,e.nativeEvent.layout.width))}>
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View style={{width:calendarWidth}}>
      <View style={styles.week}>
        {Array.from({length:7},(_,i)=><ThemedText key={i} type="small" style={styles.weekday}>
          {new Intl.DateTimeFormat(locale,{weekday:'short',timeZone:'UTC'}).format(new Date(`2026-10-${String(25+i).padStart(2,'0')}T12:00:00Z`))}
        </ThemedText>)}
      </View>
      <View style={styles.grid}>
      {Array.from({length:new Date(`${month}-01T12:00:00Z`).getUTCDay()},(_,i)=><View key={`blank:${i}`} style={styles.cell}/>)}
      {Array.from({length:count},(_,index)=>{
        const date=`${month}-${String(index+1).padStart(2,'0')}`;
        const number=result.items.filter(i=>i.on===date&&!i.dismissed).length;
        return <Pressable key={date} style={styles.cell} accessibilityRole="button" accessibilityLabel={`${formatCalendarDate(date,locale)} · ${t('cashflow.itemCount',{count:number})}`}
          accessibilityState={{selected:date===selected,disabled:date>result.horizon}} disabled={date>result.horizon} onPress={()=>{setSelected(date);guideAction('day-selected');}}>
          <ThemedView type={date===selected?'backgroundSelected':'backgroundElement'} style={styles.day}>
            <ThemedText type="smallBold" themeColor={date===selected?'accent':'text'}>{new Intl.NumberFormat(locale).format(index+1)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{number?new Intl.NumberFormat(locale).format(number):'–'}</ThemedText>
          </ThemedView>
        </Pressable>;
      })}
      </View></View>
    </ScrollView></View>
    <ThemedText type="smallBold" accessibilityRole="header">{formatCalendarDate(selected,locale)}</ThemedText>
    {result.confirmed!==null&&selected>=data.today&&selected<=result.horizon&&<SummaryRow label={t('cashflow.dayBalance')} value={money(selectedBalance!)}/>}
    {onDay.length?onDay.map(row):<ThemedText themeColor="textSecondary">{t('cashflow.emptyDay')}</ThemedText>}
    {overdue.length>0&&<><ThemedText type="smallBold" accessibilityRole="header">{t('cashflow.overdue')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{t('cashflow.overdueHint')}</ThemedText>{overdue.map(row)}</>}
    <Button title={t('cashflow.addGoal')} variant="secondary" onPress={()=>router.push('/forecast-goal')}/>
    <ThemedText type="small" themeColor="textSecondary">{t('cashflow.goalHint')}</ThemedText>
    {data.goals.filter(g=>g.due_on>=shiftCalendarDays(data.today,-30)).map(g=><Button key={g.id} variant="ghost" title={t('cashflow.editGoal',{name:g.name})}
      onPress={()=>router.push({pathname:'/forecast-goal',params:{id:g.id}})}/>)}
    <Button variant="ghost" title={t('cashflow.refresh')} loading={refreshing} onPress={onRefresh}/>
    <Button variant="ghost" title={t('payments.home')} onPress={()=>router.replace('/')}/>
  </Screen>;
}
const styles=StyleSheet.create({
  monthNav:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:Spacing.one},
  week:{flexDirection:'row',paddingBottom:Spacing.two},weekday:{width:'14.285714%',textAlign:'center'},
  grid:{flexDirection:'row',flexWrap:'wrap'},cell:{width:'14.285714%',minHeight:64,padding:2},
  day:{flex:1,minHeight:60,borderRadius:Radius.small,alignItems:'center',justifyContent:'center',padding:Spacing.one},
  agendaRow:{gap:Spacing.two,paddingVertical:Spacing.three},
});
