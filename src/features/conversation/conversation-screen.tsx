import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Spacing, Radius } from '@/constants/theme';
import { useExpense } from '@/features/expenses/api';
import type { Expense } from '@/features/expenses/schema';
import { useMyHousehold } from '@/features/household/api';
import type { Member } from '@/features/household/schema';
import { formatCalendarDate } from '@/features/payments/dates';
import { useLocales } from 'expo-localization';
import { useFormatters } from '@/hooks/use-formatters';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { errorTranslationKey } from '@/i18n/errors';
import { useConversation, useConversationAction, type ConversationAction } from './api';
import { commentBody, reactionEmoji, reactionKinds, type Comment, type Reaction } from './schema';

export function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const validId = z.uuid().safeParse(id).success ? id : undefined;
  const { session } = useSession();
  const household = useMyHousehold();
  const h = household.data?.household;
  const expense = useExpense(h?.id, 'shared', validId);
  const thread = useConversation(h?.id, expense.data?.id);
  const mutation = useConversationAction(h?.id ?? '', validId ?? '');
  const { t } = useTranslation();
  const retry = () => { void household.refetch(); void expense.refetch(); thread.refresh(); };
  if (!validId || expense.data === null) return <Screen>
    <ThemedText accessibilityRole="alert">{t('conversation.unavailable')}</ThemedText>
    <Button variant="ghost" title={t('categories.back')} onPress={() => router.back()} />
  </Screen>;
  if (!household.data || !expense.data || !session) return <Screen>
    <ThemedText accessibilityRole={household.isError || expense.isError ? 'alert' : undefined}>{t(household.isError || expense.isError ? 'conversation.loadError' : 'dashboard.loading')}</ThemedText>
    {(household.isError || expense.isError) && <Button title={t('common.tryAgain')} onPress={retry} />}
    <Button variant="ghost" title={t('categories.back')} onPress={() => router.back()} />
  </Screen>;
  const comments = thread.comments.data ? [...new Map(thread.comments.data.pages.flat().map(comment => [comment.id, comment])).values()] : undefined;
  return <Conversation key={`${h!.id}:${session.user.id}:${validId}`} expense={expense.data} userId={session.user.id}
    householdId={h!.id} members={household.data.members} currency={h!.baseCurrency} timezone={h!.timezone}
    comments={comments} reactions={thread.reactions.data} commentsError={thread.comments.isError} reactionsError={thread.reactions.isError}
    parentError={household.isError || expense.isError} onAction={action => mutation.mutateAsync(action)} onRefresh={retry}
    hasOlder={!!thread.comments.hasNextPage} loadingOlder={thread.comments.isFetchingNextPage}
    onOlder={() => thread.comments.fetchNextPage()} />;
}
export type ConversationProps = {
  expense: Expense; userId: string; householdId: string; members: Member[]; currency: string; timezone: string;
  comments?: Comment[]; reactions?: Reaction[]; commentsError: boolean; reactionsError: boolean; parentError: boolean;
  onAction: (action: ConversationAction) => Promise<unknown>; onRefresh: () => unknown;
  hasOlder: boolean; loadingOlder: boolean; onOlder: () => unknown;
};
export function Conversation({ expense, userId, householdId, members, currency, timezone, comments, reactions,
  commentsError, reactionsError, parentError, onAction, onRefresh, hasOlder, loadingOlder, onOlder }: ConversationProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useLocales()[0]?.languageTag ?? 'en';
  const format = useFormatters(timezone);
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<Comment | null>(null);
  const [removing, setRemoving] = useState<Comment | null>(null);
  const scopedComments = comments?.filter(c => c.household_id === householdId && c.transaction_id === expense.id);
  const scopedReactions = reactions?.filter(r => r.household_id === householdId && r.transaction_id === expense.id);
  const latestEdit = editing && scopedComments?.find(comment => comment.id === editing.id);
  const latestRemove = removing && scopedComments?.find(comment => comment.id === removing.id);
  const editChanged = !!latestEdit && latestEdit.version !== editing?.version;
  const removeChanged = !!latestRemove && latestRemove.version !== removing?.version;
  const name = (id: string) => members.find(member => member.userId === id)?.displayName ?? t('common.unknown');
  async function run(action: ConversationAction) {
    if (running.current || parentError) return false;
    running.current = true; setBusy(true); setError(null); setNotice('');
    try {
      await onAction(action);
      setNotice(t(action.kind === 'save' ? 'conversation.saved' : action.kind === 'remove' ? 'conversation.removedNotice' : 'conversation.reactionSaved'));
      return true;
    } catch (failure) { setError(failure); return false; }
    finally { running.current = false; setBusy(false); }
  }
  return <Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{t('conversation.title')}</ThemedText>
    {parentError ? <LoadState error retry={onRefresh} /> : <Card>
      <ThemedText type="smallBold">{expense.description || t('expenses.untitled')}</ThemedText>
      <ThemedText>{format.money(expense.amountMinor, currency)}</ThemedText>
      <ThemedText themeColor="textSecondary">{formatCalendarDate(expense.occurredOn, locale)}</ThemedText>
    </Card>}
    <ThemedText type="small" themeColor="textSecondary">{t('conversation.sharedHint')}</ThemedText>
    <Button title={t('relationships.billSplit')} variant="secondary" onPress={() => router.push({ pathname: '/bill-split', params: { id: expense.id } })} />
    <View style={styles.section}>
      <ThemedText type="smallBold" accessibilityRole="header">{t('conversation.reactions')}</ThemedText>
      {scopedReactions && !reactionsError ? <View style={styles.reactions}>
        {reactionKinds.map(kind => {
          const rows = scopedReactions.filter(row => row.kind === kind);
          const selected = rows.some(row => row.author_id === userId);
          return <View key={kind} style={styles.reactionGroup}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('conversation.reactionAction', { name: t(`conversation.kinds.${kind}`), count: rows.length })}
              accessibilityState={{ selected, disabled: busy || parentError }} disabled={busy || parentError}
              onPress={() => { void run({ kind: 'react', reaction: kind, active: !selected }); }}
              style={({ pressed }) => [styles.reaction, { backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement }, pressed && styles.pressed]}>
              <ThemedText>{reactionEmoji[kind]} {t(`conversation.kinds.${kind}`)} · {format.number(rows.length)}</ThemedText>
            </Pressable>
            {rows.length > 0 && <ThemedText type="small" themeColor="textSecondary">{rows.map(row => name(row.author_id)).join(', ')}</ThemedText>}
          </View>;
        })}
      </View> : <LoadState error={reactionsError} retry={onRefresh} />}
    </View>
    <View style={styles.section}>
      <ThemedText type="smallBold" accessibilityRole="header">{t('conversation.comments')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{t('conversation.newestFirst')}</ThemedText>
      {scopedComments && !commentsError ? <>
        {!scopedComments.length && <ThemedText themeColor="textSecondary">{t('conversation.empty')}</ThemedText>}
        {scopedComments.map(comment => <View key={comment.id} style={[styles.comment, { borderBottomColor: theme.border }]}>
          <ThemedText type="smallBold">{name(comment.author_id)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{format.date(new Date(comment.created_at), { dateStyle: 'medium', timeStyle: 'short' })}
            {comment.version > 1 && !comment.deleted_at ? ` · ${t('conversation.edited')}` : ''}</ThemedText>
          <ThemedText selectable themeColor={comment.deleted_at ? 'textSecondary' : 'text'}>{comment.deleted_at ? t('conversation.removed') : comment.body}</ThemedText>
          {comment.author_id === userId && !comment.deleted_at && <View style={styles.actions}>
            <Button variant="ghost" title={t('conversation.edit')} disabled={busy || parentError || !!editing || !!removing}
              onPress={() => { setEditing(comment); setRemoving(null); setError(null); }} />
            <Button variant="ghost" title={t('conversation.remove')} disabled={busy || parentError || !!editing || !!removing}
              onPress={() => { setRemoving(comment); setEditing(null); setError(null); }} />
          </View>}
        </View>)}
        {hasOlder && <Button variant="secondary" title={t('conversation.older')} accessibilityLabel={t('conversation.older')} loading={loadingOlder} onPress={onOlder} />}
      </> : <LoadState error={commentsError} retry={onRefresh} />}
    </View>
    {!!error && <View style={styles.section}>
      <ThemedText accessibilityRole="alert" themeColor="attention">{t(errorTranslationKey(error))}</ThemedText>
      <Button title={t('conversation.refresh')} variant="secondary" onPress={onRefresh} disabled={busy} />
    </View>}
    {!!notice && <ThemedText accessibilityLiveRegion="polite" themeColor="success">{notice}</ThemedText>}
    {removing && <View style={styles.section}>
      <ThemedText>{t('conversation.confirmRemove')}</ThemedText>
      <ThemedText selectable>{removing.body}</ThemedText>
      {removeChanged && <View style={styles.section}>
        <ThemedText accessibilityRole="alert" themeColor="attention">{t(latestRemove?.deleted_at ? 'conversation.removedElsewhere' : 'conversation.changedRemoval')}</ThemedText>
        {!latestRemove?.deleted_at && <>
          <ThemedText type="smallBold">{t('conversation.latestSaved')}</ThemedText>
          <ThemedText selectable>{latestRemove?.body}</ThemedText>
          <Button variant="secondary" title={t('conversation.adoptRemoval')} disabled={busy || parentError || commentsError}
            onPress={() => { if (latestRemove) { setRemoving(latestRemove); setError(null); } }} />
        </>}
      </View>}
      <Button title={t('conversation.confirmRemoveAction')} disabled={parentError || removeChanged} loading={busy}
        onPress={async () => { if (await run({ kind: 'remove', id: removing.id, version: removing.version })) setRemoving(null); }} />
      <Button title={t('common.cancel')} variant="ghost" disabled={busy} onPress={() => setRemoving(null)} />
    </View>}
    {editing && <View style={styles.section}>
      {editChanged && <View style={styles.section}>
        <ThemedText accessibilityRole="alert" themeColor="attention">{t(latestEdit?.deleted_at ? 'conversation.alreadyRemoved' : 'conversation.changedEdit')}</ThemedText>
        {!latestEdit?.deleted_at && <>
          <ThemedText type="smallBold">{t('conversation.latestSaved')}</ThemedText>
          <ThemedText selectable>{latestEdit?.body}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{t('conversation.adoptHint')}</ThemedText>
          <Button variant="secondary" title={t('conversation.adoptEdit')} disabled={busy || parentError || commentsError}
            onPress={() => { if (latestEdit) { setEditing(latestEdit); setError(null); } }} />
        </>}
      </View>}
      <CommentComposer key={editing.id} initial={editing} busy={busy} disabled={parentError || editChanged} run={run}
        onDone={() => setEditing(null)} onCancel={() => setEditing(null)} />
    </View>}
    <View style={editing || removing ? styles.hidden : undefined}><CommentComposer busy={busy} disabled={parentError} run={run} /></View>
    <Button title={t('conversation.refresh')} variant="secondary" disabled={busy} onPress={onRefresh} />
    <Button title={t('categories.back')} variant="ghost" disabled={busy} onPress={() => router.back()} />
  </Screen>;
}
function CommentComposer({ initial, busy, disabled, run, onDone, onCancel }: {
  initial?: Comment; busy: boolean; disabled: boolean; run: (action: ConversationAction) => Promise<boolean>; onDone?: () => void; onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const [id, setId] = useState(() => initial?.id ?? randomUUID());
  const [body, setBody] = useState(initial?.body ?? '');
  const valid = commentBody.safeParse(body).success;
  return <View style={styles.section}>
    <TextField label={t(initial ? 'conversation.editBody' : 'conversation.newBody')} value={body} onChangeText={setBody}
      hint={t('conversation.bodyHint')} multiline editable={!busy} style={styles.input} />
    <Button title={t(initial ? 'conversation.saveEdit' : 'conversation.post')} disabled={!valid || disabled} loading={busy}
      onPress={async () => {
        if (await run({ kind: 'save', id, version: initial?.version ?? 0, body })) {
          setBody(''); setId(randomUUID()); onDone?.();
        }
      }} />
    {onCancel ? <Button title={t('common.cancel')} variant="ghost" disabled={busy} onPress={onCancel} /> :
      body.length > 0 && <Button title={t('conversation.clearDraft')} variant="ghost" disabled={busy} onPress={() => { setBody(''); setId(randomUUID()); }} />}
  </View>;
}
function LoadState({ error, retry }: { error: boolean; retry: () => unknown }) {
  const { t } = useTranslation();
  return <View style={styles.section}>
    <ThemedText accessibilityRole={error ? 'alert' : undefined} themeColor={error ? 'attention' : 'textSecondary'}>{t(error ? 'conversation.loadError' : 'dashboard.loading')}</ThemedText>
    {error && <Button title={t('common.tryAgain')} variant="secondary" onPress={retry} />}
  </View>;
}
const styles = StyleSheet.create({
  hidden: { display: 'none' },
  section: { gap: Spacing.three },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  reactionGroup: { gap: Spacing.one, maxWidth: '100%' },
  reaction: { minHeight: 50, padding: Spacing.three, borderRadius: Radius.small, justifyContent: 'center' },
  comment: { gap: Spacing.two, paddingVertical: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  input: { minHeight: 100, paddingVertical: Spacing.three, textAlignVertical: 'top' },
  pressed: { opacity: 0.7 },
});
