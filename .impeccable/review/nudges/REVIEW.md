## verdict

1. Resolved — selected reminder hour semantics, `src/components/ui/choices.tsx:9`: explicit `aria-checked={selected}` now reaches the installed web renderer while native `accessibilityState.checked` remains. The recaptured `timing-mobile-dark.png` visibly selects 09:00 and repeats that choice in the summary. The supplied browser observation confirms 19:00 was initially true, then 09:00 true and all eleven alternatives false after interaction.
2. Resolved — response consumption across account subscriptions, `src/features/nudges/device.native.ts:26–45`: handled identifiers now survive subscription cleanup through a module ledger and persistent latest identifier, and the SDK retained response is cleared before navigation. Cleanup suppresses stale listeners. Focused mocked-SDK tests cover cold-start replay into another account subscription, stale callbacks, unknown kinds and handling a fresh live tap once. Source and test assertions support the fix; they do not establish native runtime acceptance.

## remaining

Clear for the two scored material fixes. No regression identified in this fix batch's source or supplied recapture. This ship verdict covers the scored fixes only, at source and synthetic-browser scope; native/device, hosted push, Cron and EAS acceptance remain open.

disposition: ship
