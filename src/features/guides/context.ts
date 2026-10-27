import { createContext, useContext } from 'react';
import type { GuideAction } from './registry';
import type { Progress, ProgressMap } from './progress';

export type GuideContextValue = {
  rows: ProgressMap; ready: boolean; active: string | null; path: string; localError: boolean; syncError: boolean;
  start: (id: string, replay?: boolean) => void;
  close: (status?: Progress['status']) => void;
  dismiss: (id: string) => void;
  move: (direction: -1 | 1) => void;
  signal: (action: GuideAction) => void;
  register: (target: string) => () => void;
  retry: () => void;
};
export const GuideContext = createContext<GuideContextValue | null>(null);
export const useGuides = () => useContext(GuideContext);
const noop = (_action: GuideAction) => {};
export const useGuideAction = () => useGuides()?.signal ?? noop;
