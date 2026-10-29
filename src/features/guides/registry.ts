import type { Href } from 'expo-router';
import type { ParseKeys } from 'i18next';

export type GuideAction = 'household-connected' | 'log-opened' | 'space-chosen' | 'expense-queued' | 'payment-saved' | 'day-selected' | 'category-saved' | 'budget-linked' | 'balance-checked' | 'goal-saved' | 'month-closed' | 'reminders-saved' | 'booster-saved' | 'weekly-budget-saved' | 'gift-saved' | 'bill-split-saved';
export type GuideStep = { id: string; target: string; route: Href; paths: string[]; title: ParseKeys; body: ParseKeys; action?: GuideAction;
  preparation?: { target: string; title: ParseKeys; body: ParseKeys } };
export type Guide = { id: string; version: number; title: ParseKeys; description: ParseKeys; entryOnly?: boolean; steps: GuideStep[] };
const step = (id: string, target: string, path: string, title: ParseKeys, body: ParseKeys, action?: GuideAction): GuideStep =>
  ({ id, target, route: path as Href, paths: [path], title, body, action });

/** Only shipped workflows belong here. No field values or financial data enter guide state. */
export const guides: Guide[] = [
  { id: 'boosters', version: 1, title: 'relationships.guideBoosterTitle', description: 'relationships.guideBoosterDescription', steps: [
    step('overview', 'boosters-overview', '/boosters', 'relationships.guideBoosterTitle', 'relationships.guideBoosterBody'),
    step('budget', 'boosters-budget', '/boosters', 'relationships.guideBudgetTitle', 'relationships.guideBudgetBody', 'weekly-budget-saved'),
  ] },
  { id: 'gift', version: 1, title: 'relationships.guideGiftTitle', description: 'relationships.guideGiftDescription', steps: [
    { ...step('give', 'goal-gift', '/goals', 'relationships.guideGiftTitle', 'relationships.guideGiftBody', 'gift-saved'), paths: ['/goals', '/goal'],
      preparation: { target: 'goals-overview', title: 'relationships.guideGiftTitle', body: 'relationships.guideGiftPrepare' } },
  ] },
  { id: 'sinking-funds', version: 1, title: 'relationships.guideSinkingTitle', description: 'relationships.guideSinkingDescription', steps: [
    step('overview', 'goals-overview', '/goals', 'relationships.guideSinkingTitle', 'relationships.guideSinkingBody'),
    step('create', 'goal-form', '/goal-edit', 'relationships.guideSinkingTitle', 'relationships.guideSinkingSave', 'goal-saved'),
  ] },
  { id: 'bill-split', version: 1, title: 'relationships.guideSplitTitle', description: 'relationships.guideSplitDescription', steps: [
    { ...step('save', 'bill-split-form', '/expenses', 'relationships.guideSplitTitle', 'relationships.guideSplitBody', 'bill-split-saved'), paths: ['/expenses', '/bill-split'],
      preparation: { target: 'expense-shares-entry', title: 'relationships.guideSplitTitle', body: 'relationships.guideSplitPrepare' } },
  ] },
  { id: 'reminders', version: 1, title: 'nudges.guideTitle', description: 'nudges.guideDescription', steps: [
    step('overview', 'reminders-overview', '/reminders', 'nudges.guideOverviewTitle', 'nudges.guideOverviewBody'),
    step('save', 'reminders-preferences', '/reminders', 'nudges.guideSaveTitle', 'nudges.guideSaveBody', 'reminders-saved'),
  ] },
  { id: 'money-date', version: 1, title: 'moneyDate.guideTitle', description: 'moneyDate.guideDescription', steps: [
    step('review', 'money-date-review', '/money-date', 'moneyDate.guideReviewTitle', 'moneyDate.guideReviewBody'),
    step('close', 'money-date-close', '/money-date', 'moneyDate.guideCloseTitle', 'moneyDate.guideCloseBody', 'month-closed'),
  ] },
  { id: 'goals', version: 1, title: 'goals.guideTitle', description: 'goals.guideDescription', steps: [
    step('overview', 'goals-overview', '/goals', 'goals.guideOverviewTitle', 'goals.guideOverviewBody'),
    step('create', 'goal-form', '/goal-edit', 'goals.guideCreateTitle', 'goals.guideCreateBody', 'goal-saved'),
  ] },
  { id: 'reconciliation', version: 1, title: 'reconciliation.guideTitle', description: 'reconciliation.guideDescription', steps: [
    step('compare', 'reconciliation-compare', '/reconciliation', 'reconciliation.guideCompareTitle', 'reconciliation.guideCompareBody'),
    step('check', 'reconciliation-check', '/reconciliation', 'reconciliation.guideCheckTitle', 'reconciliation.guideCheckBody', 'balance-checked'),
  ] },
  { id: 'welcome', version: 1, title: 'guides.welcome.title', description: 'guides.welcome.description', entryOnly: true, steps: [
    { ...step('spaces', 'household-start', '/household', 'guides.welcome.spacesTitle', 'guides.welcome.spacesBody'), paths: ['/household', '/join'] },
    { ...step('connect', 'household-start', '/household', 'guides.welcome.connectTitle', 'guides.welcome.connectBody', 'household-connected'), paths: ['/household', '/join'] },
  ] },
  { id: 'first-visit', version: 1, title: 'guides.firstVisit.title', description: 'guides.firstVisit.description', steps: [
    step('home', 'home-summary', '/', 'guides.firstVisit.homeTitle', 'guides.firstVisit.homeBody'),
    step('shared', 'shared-summary', '/shared-budget', 'guides.firstVisit.sharedTitle', 'guides.firstVisit.sharedBody'),
    step('private', 'private-summary', '/private-space', 'guides.firstVisit.privateTitle', 'guides.firstVisit.privateBody'),
    step('log', 'home-summary', '/', 'guides.firstVisit.logTitle', 'guides.firstVisit.logBody', 'log-opened'),
  ] },
  { id: 'quick-log', version: 1, title: 'guides.quickLog.title', description: 'guides.quickLog.description', steps: [
    { ...step('space', 'log-space', '/quick-log', 'guides.quickLog.spaceTitle', 'guides.quickLog.spaceBody', 'space-chosen'),
      preparation: { target: 'log-amount', title: 'guides.quickLog.spaceTitle', body: 'guides.quickLog.changeBody' } },
    { ...step('save', 'log-amount', '/quick-log', 'guides.quickLog.saveTitle', 'guides.quickLog.saveBody', 'expense-queued'),
      preparation: { target: 'log-space', title: 'guides.quickLog.spaceTitle', body: 'guides.quickLog.resumeBody' } },
  ] },
  { id: 'payments', version: 1, title: 'guides.payments.title', description: 'guides.payments.description', steps: [
    step('list', 'payments-list', '/payments', 'guides.payments.listTitle', 'guides.payments.listBody'),
    step('create', 'payment-form', '/payment', 'guides.payments.createTitle', 'guides.payments.createBody', 'payment-saved'),
  ] },
  { id: 'cashflow', version: 1, title: 'guides.cashflow.title', description: 'guides.cashflow.description', steps: [
    step('forecast', 'cashflow-summary', '/cash-flow', 'guides.cashflow.forecastTitle', 'guides.cashflow.forecastBody'),
    step('calendar', 'cashflow-calendar', '/cash-flow', 'guides.cashflow.calendarTitle', 'guides.cashflow.calendarBody', 'day-selected'),
  ] },
  { id: 'categories', version: 1, title: 'guides.categories.title', description: 'guides.categories.description', steps: [
    step('spaces', 'categories-list', '/categories', 'guides.categories.spacesTitle', 'guides.categories.spacesBody'),
    step('create', 'category-form', '/category', 'guides.categories.createTitle', 'guides.categories.createBody', 'category-saved'),
  ] },
  { id: 'budget-categories', version: 1, title: 'guides.budgetCategories.title', description: 'guides.budgetCategories.description', steps: [
    step('plan', 'budget-categories-intro', '/budget-categories', 'guides.budgetCategories.planTitle', 'guides.budgetCategories.planBody'),
    { ...step('assign', 'budget-categories', '/budget-categories', 'guides.budgetCategories.assignTitle', 'guides.budgetCategories.assignBody', 'budget-linked'),
      preparation: { target: 'budget-categories-empty', title: 'guides.budgetCategories.emptyTitle', body: 'guides.budgetCategories.emptyBody' } },
  ] },
  { id: 'private-allowance', version: 1, title: 'guides.privateAllowance.title', description: 'guides.privateAllowance.description', steps: [
    step('balance', 'private-summary', '/private-space', 'guides.privateAllowance.balanceTitle', 'guides.privateAllowance.balanceBody'),
    step('privacy', 'private-summary', '/private-space', 'guides.privateAllowance.privacyTitle', 'guides.privateAllowance.privacyBody'),
  ] },
];
export const findGuide = (id: string) => guides.find(guide => guide.id === id);
