import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useReducedMotionPreference } from '@/hooks/use-reduced-motion';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/money';

import { formatCalendarDate } from './dates';

export type PaidReceipt = {
  name: string; visibility: 'shared' | 'private'; amountMinor: number; currency: string;
  paidOn: string; cycle: string; payer: string; createTransaction: boolean;
};

/** A payment record, not a bank transfer. Only feed the paper after the save succeeds. */
export function PaymentReceipt({ receipt, recorded, locale, onDone, onHistory }: {
  receipt: PaidReceipt; recorded: boolean; locale: string; onDone: () => void; onHistory: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const reduced = useReducedMotionPreference();
  const [feed] = useState(() => new Animated.Value(0));
  const [paperHeight, setPaperHeight] = useState(0);
  const [printed, setPrinted] = useState(false);
  const complete = recorded && (reduced || printed);
  const status = !recorded ? 'recording' : complete ? 'complete' : 'printing';

  useEffect(() => {
    if (!recorded || !paperHeight || printed) return;
    if (reduced) { feed.setValue(1); return; }
    // Small pauses give the paper the mechanical feed of a receipt printer.
    const animation = Animated.sequence(Array.from({ length: 9 }, (_, index) => [
      Animated.timing(feed, { toValue: (index + 1) / 9, duration: 115, easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
      Animated.delay(35),
    ]).flat());
    animation.start(({ finished }) => { if (finished) setPrinted(true); });
    return () => animation.stop();
  }, [feed, paperHeight, printed, recorded, reduced]);

  const money = formatMoney(receipt.amountMinor, receipt.currency, { locale });
  return <View style={styles.root}>
    <View style={[styles.machine, { backgroundColor: theme.hero }]}>
      <View style={styles.brand}>
        <Icon name="heart" color={theme.heroAccent} size={22} />
        <ThemedText type="smallBold" style={{ color: theme.heroText }}>{t('payments.receipt.brand')}</ThemedText>
      </View>
      <View style={[styles.display, { backgroundColor: theme.heroTrack }]}>
        <ThemedText type="section" style={{ color: theme.heroText }} accessibilityRole="header">
          {t('payments.receipt.title')}
        </ThemedText>
        <View style={styles.status}>
          {recorded ? <Icon name="check" color={theme.heroAccent} size={18} />
            : reduced ? <Icon name="receipt" color={theme.heroSecondary} size={18} />
              : <ActivityIndicator size="small" color={theme.heroSecondary} />}
          <ThemedText type="small" accessibilityLiveRegion="polite" role="status" style={{ color: theme.heroText }}>
            {t(`payments.receipt.${status}`)}
          </ThemedText>
        </View>
      </View>
      <View style={[styles.slot, { backgroundColor: theme.scrim }]} />
    </View>
    <View style={styles.output}>
      <Animated.View testID="payment-receipt-paper" onLayout={event => setPaperHeight(event.nativeEvent.layout.height)}
        aria-hidden={!recorded} accessibilityElementsHidden={!recorded}
        importantForAccessibility={recorded ? 'auto' : 'no-hide-descendants'}
        style={{ opacity: recorded && paperHeight > 0 ? 1 : 0,
          transform: [{ translateY: reduced && recorded ? 0 : feed.interpolate({ inputRange: [0, 1], outputRange: [-paperHeight, 0] }) }] }}>
        <View style={[styles.paper, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.paid}>
            <Icon name="verified" color={theme.success} size={22} />
            <ThemedText type="smallBold" themeColor="success">{t('payments.receipt.paid')}</ThemedText>
          </View>
          <ThemedText type="section">{receipt.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{t(`payments.${receipt.visibility}`)}</ThemedText>
          <View style={[styles.total, { borderColor: theme.border }]}>
            <ThemedText type="small" themeColor="textSecondary">{t('payments.receipt.total')}</ThemedText>
            <ThemedText type="amount" style={styles.amount}>{money}</ThemedText>
          </View>
          <ThemedText type="small">{t('payments.paidBy', { name: receipt.payer })}</ThemedText>
          <ThemedText type="small">{t('payments.paidDateDisplay', { date: formatCalendarDate(receipt.paidOn, locale) })}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{t('payments.cycleDisplay', { date: receipt.cycle })}</ThemedText>
          <View style={[styles.footnote, { borderColor: theme.border }]}>
            <ThemedText type="small" themeColor="textSecondary">
              {t(receipt.createTransaction ? 'payments.transactionLogged' : 'payments.historyOnly')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{t('payments.receipt.note')}</ThemedText>
          </View>
        </View>
        <Svg width="100%" height={8} viewBox="0 0 320 8" preserveAspectRatio="none" aria-hidden>
          <Path fill={theme.backgroundElement} d={`M0 0H320${Array.from({ length: 40 }, (_, i) => `L${316 - i * 8} 8L${312 - i * 8} 0`).join('')}Z`} />
        </Svg>
      </Animated.View>
    </View>
    {recorded && <View style={styles.actions}>
      <Button title={t('payments.receipt.done')} onPress={onDone} />
      <Button title={t('payments.history')} variant="ghost" onPress={onHistory} />
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  root: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  machine: { borderRadius: Radius.large, padding: Spacing.three, paddingBottom: Spacing.four },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.three },
  display: { borderRadius: Radius.small, padding: Spacing.three, gap: Spacing.two },
  status: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  slot: { height: 8, borderRadius: 4, marginTop: Spacing.three },
  output: { width: '86%', alignSelf: 'center', overflow: 'hidden', marginTop: -28, paddingTop: 4 },
  paper: { padding: Spacing.three, paddingTop: Spacing.four, gap: Spacing.two },
  paid: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.two },
  total: { borderTopWidth: 1, borderBottomWidth: 1, borderStyle: 'dashed', paddingVertical: Spacing.three,
    marginVertical: Spacing.two, gap: Spacing.one },
  amount: { fontSize: 30, lineHeight: 40 },
  footnote: { borderTopWidth: 1, borderStyle: 'dashed', marginTop: Spacing.two, paddingTop: Spacing.three, gap: Spacing.two },
  actions: { gap: Spacing.one, marginTop: Spacing.four },
});
