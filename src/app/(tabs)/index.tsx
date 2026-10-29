import { useMyHousehold } from '@/features/household/api';
import { InviteCard } from '@/features/household/invite-card';
import { useCashflow } from '@/features/cashflow/api';
import { useHouseholdToday } from '@/features/payments/dates';
import { useHomeActivity } from '@/features/dashboard/api';
import { Dashboard } from '@/features/dashboard/dashboard';

export default function HomeScreen() {
  const household = useMyHousehold();
  const today = useHouseholdToday(household.data?.household.timezone ?? 'UTC');
  const cashflow = useCashflow(household.data?.household.id, today);
  const activity = useHomeActivity(household.data?.household.id, today);
  if (!household.data) return null;
  return <Dashboard household={household.data} workspace={cashflow.data} activity={activity.data}
    flowError={cashflow.isError} activityError={activity.isError}
    onRetryFlow={() => cashflow.refetch()} onRetryActivity={() => activity.refetch()}
    refreshing={cashflow.isFetching || activity.isFetching || household.isFetching}
    onRefresh={() => Promise.all([cashflow.refetch(), activity.refetch(), household.refetch()])}
    invite={<InviteCard household={household.data.household} />} />;
}
