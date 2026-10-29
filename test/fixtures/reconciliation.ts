import type { ReconciliationWorkspace } from '@/features/reconciliation/schema';
import { household, me } from './payments';

export const reconciliation: ReconciliationWorkspace = {
  today: '2026-10-27', revision: 8,
  baseline: { as_of_on: '2026-10-01', amount_minor: 300000, low_threshold_minor: 10000, version: 1 },
  expected_minor: 150000,
  pending: {
    id: '00000000-0000-4000-8000-000000000099', as_of_on: '2026-10-27', actual_minor: 145000,
    baseline_on: '2026-10-01', baseline_minor: 300000, baseline_version: 1, expected_minor: 150000,
    status: 'pending', resolution: null, resolved_expected_minor: null, resolved_at: null,
    created_at: '2026-10-27T12:00:00Z', current_expected_minor: 150000, gap_minor: -5000,
    baseline_changed: false, shares: [],
  }, history: [],
};
export const reconciliationHousehold = household;
export const reconciliationUser = me.userId;
