import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { useCashflow } from '@/features/cashflow/api';
import { useSession } from '@/hooks/use-session';

export function useSharedBudget(householdId?: string, today?: string) {
  const { session } = useSession();
  const userId = session?.user.id;
  const client = useQueryClient();
  const query = useCashflow(householdId, today);
  useFocusEffect(useCallback(() => {
    if (!householdId || !userId) return;
    const refresh = () => {
      void client.invalidateQueries({ queryKey: ['cashflow', householdId, userId] });
    };
    refresh();
    // Reconnects, missed Realtime events and household midnight all recover here.
    const timer = setInterval(refresh, 30_000);
    return () => clearInterval(timer);
  }, [client, householdId, userId]));
  return query;
}
