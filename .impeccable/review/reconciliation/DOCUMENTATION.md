# Reconciliation documentation verification

Date: 27 October 2026.

Scope: PLAN.md step 16, implemented locally in `src/features/reconciliation/reconciliation-screen.tsx`, its API/schema and `supabase/migrations/20261027180000_reconciliation.sql`. This is an ordinary extension of the existing visual system. The independent documenter role used a default-agent substitution because the named `impeccable_documenter` role was unavailable.

## Product truth

`PRODUCT.md` now records opening/closing balance checks against confirmed shared cash, explicit discrepancy resolution, consent for each charged allowance share, shared history, revision checks, retry protection and the optional guide. It distinguishes local implementation from live availability. The new migration remains unapplied live; live two-partner and native acceptance remain pending. This record does not mark Phase 2 complete.

## Inheritance checked

- Authority: read `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, the reconciliation surface brief and Impeccable `reference/document.md` and `reference/new-work.md` section 7. The surface brief explicitly inherits the calm Shared workflow.
- Color: reconciliation scopes its connected screen to Shared. `useTheme()` resolves the existing Shared light/dark semantic palette from `src/constants/theme.ts`; status copy uses Attention/Success alongside explicit text. No new palette or space identity was introduced.
- Typography: `ThemedText` retains system body/section/control labels, with bundled Manrope for title/subtitle/amount when loaded. Comparison and history use the existing wrapping `SummaryRow` and tabular value treatment.
- Layout: the screen reuses `Screen` for the 760-unit reading width, safe areas, scrolling and keyboard handling. Its only local style is a section gap of `Spacing.two`. Existing `Card` provides the flat surface, 16-unit corners and 16-unit padding; reconciliation does not define a new elevation treatment.
- Controls: the existing `TextField`, `Choices`/`Choice`, `Button` and `Disclosure` retain their documented palette, spacing, corner, target-size and state behavior. Split details, new checks while a check is pending, and history use in-flow disclosure. The confirmation panel uses the existing Card and Screen reveal mechanism; its focus handling is task behavior, not a new visual-system rule.
- Component evidence: directly read `src/constants/theme.ts`, `src/hooks/use-theme.ts`, `src/components/themed-text.tsx` and the corresponding UI components. Read the reconciliation screen, API/schema and full new SQL migration to check the capability wording against implementation.

## Documentation boundary

`DESIGN.md` and `.impeccable/design.json` were preserved. No new world, durable visual-system change or documentation refresh was authorized. The inspected inheritance does not require new visual tokens or component entries. The existing sidecar's browser snippets remain illustrative previews of the native components; they do not establish device behavior.

The reconciliation surface brief remains the authority for this task's composition and resolution interaction; its strategy was not promoted into the global design system. README and PLAN acceptance instructions are maintained by the implementing agent.

## Evidence limits

Browser captures under this directory use synthetic fixture data in light/dark phone and desktop viewports, with the current font loaded, as reported by the implementing agent. They are development review evidence, not live household balances or native-device verification. This documentation check does not replace the independent finish review or its final focus-fix verdict. No adaptive React Native design-system detector was run. Native runtime, live two-partner flow, migration application and comprehension acceptance are not certified here.

No new shipping raster asset was identified in the inspected reconciliation implementation. Review screenshots are development evidence rather than product assets.
