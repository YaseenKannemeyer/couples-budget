import type { ConfigContext, ExpoConfig } from 'expo/config';
/** EAS file environment variable; native Firebase configuration stays out of JS. */
export default ({ config }: ConfigContext): ExpoConfig => ({
 ...config,
 name: config.name ?? 'Couple Goals', slug: config.slug ?? 'yaseen',
 android: { ...config.android, ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}) },
});
