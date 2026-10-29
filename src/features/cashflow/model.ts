// The same integer engine drives the app and server reminder decisions.
import { forecast as runForecast } from '../../../supabase/functions/_shared/forecast';
import type { Workspace } from './schema';
export { monthDate, nextMonth } from '../../../supabase/functions/_shared/forecast';
export type { ForecastItem } from '../../../supabase/functions/_shared/forecast';
export function forecast(data: Workspace, horizon?: string) { return runForecast(data, horizon); }
