import { z } from 'zod';
export const preferenceValues = z.object({ enabled:z.boolean(),payments:z.boolean(),low_balance:z.boolean(),money_date:z.boolean(),unlogged:z.boolean(),send_hour:z.number().int().min(9).max(20),language:z.literal('en') });
export const nudgeSettings = z.object({preferences:preferenceValues.extend({revision:z.number().int(),request_id:z.uuid().nullable()}),
 device_registered:z.boolean(),device_id:z.uuid().nullable(),history:z.array(z.object({id:z.uuid(),local_on:z.string(),kind:z.enum(['money_date','payment','low_balance','unlogged']),
 status:z.enum(['pending','evaluating','sending','accepted','sent','failed','unknown','skipped'])}))});
export type PreferenceValues = z.infer<typeof preferenceValues>;
export type NudgeSettings = z.infer<typeof nudgeSettings>;
