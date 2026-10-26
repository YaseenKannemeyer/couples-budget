import { useLocales } from 'expo-localization';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { useMyHousehold } from '@/features/household/api';
import { budgetAmountText, parseBudgetAmount } from '@/features/budget/money-input';
import { useHouseholdToday } from '@/features/payments/dates';
import { PaymentError } from '@/features/payments/ui';
import { useFormatters } from '@/hooks/use-formatters';
import { useCashflow } from './api';
export { PaymentError };
export function useFlowData() {
  const household=useMyHousehold(); const h=household.data?.household;
  const today=useHouseholdToday(h?.timezone??'UTC');
  const query=useCashflow(h?.id,today);
  return { household:household.data,query:{...query,isError:household.isError||query.isError,
    refetch:()=>household.isError?household.refetch():query.refetch()} };
}
export function FlowLoading({error,retry}:{error:boolean;retry:()=>unknown}) {
  const {t}=useTranslation();
  return <Screen><ThemedText type="subtitle">{t(error?'cashflow.loadError':'payments.loading')}</ThemedText>
    {error&&<Button title={t('common.tryAgain')} onPress={retry}/>}
    <Button title={t('payments.home')} variant="ghost" onPress={()=>router.replace('/')}/></Screen>;
}
export function FlowError({error,onReload,reloadLabel}:{error:unknown;onReload?:()=>void;reloadLabel?:string}) {
  const {t}=useTranslation();
  return <><PaymentError error={error}/>{!!error&&<Button variant="secondary" title={reloadLabel??t('cashflow.reload')}
    onPress={onReload??(()=>router.replace('/cash-flow'))}/>}</>;
}
export function useFlowMoney(currency:string,timezone:string) {
  const locale=useLocales()[0]?.languageTag??'en'; const format=useFormatters(timezone);
  return {locale,edit:(v:number)=>budgetAmountText(v,currency,locale),parse:(v:string)=>parseBudgetAmount(v,currency,locale),money:(v:number)=>format.money(v,currency)};
}
