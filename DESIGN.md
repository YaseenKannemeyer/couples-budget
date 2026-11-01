---
name: "Couple Goals"
description: "Shared money, private spending, fair contributions — banking-style clarity."
colors:
  light-text: "#243746"
  light-text-secondary: "#526574"
  light-heading: "#102A43"
  light-background: "#FFFFFF"
  light-background-element: "#F4F6F8"
  light-background-selected: "#E6EBF0"
  light-border: "#DCE3EA"
  light-accent: "#175CD3"
  light-accent-soft: "#EAF1FD"
  light-on-accent: "#FFFFFF"
  light-primary: "#102A43"
  light-on-primary: "#FFFFFF"
  light-attention: "#B54708"
  light-success: "#067647"
  light-hero: "#102A43"
  light-hero-text: "#FFFFFF"
  light-hero-secondary: "#C9D6E3"
  light-hero-track: "#2A4663"
  light-hero-accent: "#8FC0FF"
  light-hero-attention: "#FFC48A"
  light-chart-track: "#E6EBF0"
  dark-text: "#E8EEF4"
  dark-text-secondary: "#A3B3C2"
  dark-heading: "#F4F7FA"
  dark-background: "#0B1622"
  dark-background-element: "#14212E"
  dark-background-selected: "#1C2E40"
  dark-border: "#2A3D50"
  dark-accent: "#7AB0FF"
  dark-accent-soft: "#1B2F4A"
  dark-on-accent: "#0B1622"
  dark-primary: "#2E6AD1"
  dark-on-primary: "#FFFFFF"
  dark-attention: "#F7B27A"
  dark-success: "#75D6A6"
  dark-hero: "#18324E"
  dark-hero-text: "#FFFFFF"
  dark-hero-secondary: "#C9D6E3"
  dark-hero-track: "#2D4D6E"
  dark-chart-track: "#1C2E40"
  accent-sky: "#2B83D6"
  accent-orange: "#D9730D"
  accent-pink: "#D14FB1"
  accent-mint: "#2E9A6E"
  accent-periwinkle: "#5A68DC"
  accent-slate: "#66778A"
  tile-glyph: "#FFFFFF"
typography:
  amount:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 800
    lineHeight: "48px"
    letterSpacing: "-1px"
  title:
    fontFamily: "System, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "36px"
    letterSpacing: "-0.5px"
  section:
    fontFamily: "System, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: "26px"
  row-title:
    fontFamily: "System, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: "22px"
  body:
    fontFamily: "System, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
  small:
    fontFamily: "System, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "21px"
rounded:
  small: "10px"
  medium: "12px"
  large: "14px"
  tile: "11px"
spacing:
  half: "2px"
  one: "4px"
  two: "8px"
  three: "16px"
  four: "24px"
  five: "32px"
  six: "64px"
components:
  button-primary:
    backgroundColor: "{colors.light-primary}"
    textColor: "{colors.light-on-primary}"
    rounded: "{rounded.medium}"
    height: "50px"
  button-secondary:
    backgroundColor: "{colors.light-background}"
    textColor: "{colors.light-accent}"
    border: "1px {colors.light-accent}"
    rounded: "{rounded.medium}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.light-accent}"
  summary-panel:
    backgroundColor: "{colors.light-hero}"
    textColor: "{colors.light-hero-text}"
    rounded: "{rounded.large}"
    padding: "20px"
  icon-tile:
    backgroundColor: "{colors.accent-orange}"
    textColor: "{colors.tile-glyph}"
    rounded: "{rounded.tile}"
    size: "38px"
  list-row:
    minHeight: "66px"
    divider: "hairline {colors.light-border}"
  segmented-selected:
    backgroundColor: "{colors.light-accent}"
    textColor: "{colors.light-on-accent}"
    rounded: "{rounded.small}"
  group-gap:
    backgroundColor: "{colors.light-background-element}"
    height: "12px"
---

# Design System: Couple Goals

## Overview

Implemented 30 October 2026 from the approved banking concept ([PLAN.md](PLAN.md#approved-visual-concept)). Source of truth: `src/constants/theme.ts`, `src/components/ui/` and `src/features/categories/visual.ts`. Synthetic web previews were compared with the concept images; installed iOS/Android acceptance is still open (BR10).

**North star: "Clear as a bank statement, kind as a conversation."** White and cool-grey surfaces, one navy summary per screen, blue for actions, colour reserved for icon tiles and data graphics. Headings, amounts and paragraphs stay dark and readable.

- Three tabs: Overview · Plan · Personal. Settings opens from the profile button (gear on Personal).
- One navy summary per main screen; compact rows with fine dividers; grey bands separate row groups.
- Shared and Personal share one visual system. Scope is stated in words ("Shared", "Personal", "Visible to both of you", "Purchases are private") — the earlier violet Private palette is retired. `Palettes.private` remains as an alias for existing `SpaceContext` callers.

## Colours

- **Navy** (`hero`, `primary`, `heading`): the summary panel, primary buttons and headings. Dark mode lifts the panel to `#18324E` and primary buttons to blue `#2E6AD1` so they stay visible on the dark canvas.
- **Blue** (`accent`, `accentSoft`): links, "See all", selected tab, selected segment, focus/cursor. One action accent only.
- **Neutrals**: white canvas, `#F4F6F8` grouped surfaces/fields, hairline `#DCE3EA` dividers; text `#243746` on secondary `#526574`.
- **Semantic**: `attention` (over plan, overdue, failed loads) and `success`. Always paired with explicit words; never inferred from category colour.
- **Accent families** (identity only): sky, orange, pink, mint, periwinkle, slate. Tiles use these as solid fills with a white glyph; each passes ≥ 3:1 glyph contrast (sky 3.95, orange 3.28, pink 3.84, mint 3.52, periwinkle 4.72, slate 4.59). The concept's paler starting values (e.g. `#FFA441`) gave white glyphs under 2:1, so they were deepened. The wheel uses the same values so tile, row and arc match.

Measured text contrast: body 12.3:1, secondary 6.1:1 (5.6:1 on grey), blue links 6.0:1, white on navy 14.6:1, dark-mode body 15.6:1 and secondary 8.5:1.

## Icons and tiles

- One rounded solid SVG glyph set (`icon-paths.ts`) on iOS, Android and web, including the tab bar: 24-unit grid, filled shapes with even-odd cut-outs. Selected tabs change colour, not icon family or shape. User-chosen category emoji remain personal content.
- Utility glyphs (back, close, chevrons, plus, check) are stroked at 2.2 in neutral or blue, never boxed.
- `IconTile`: 38-unit rounded square (≈ 11 corner), solid accent fill, faint top highlight, decorative (hidden from assistive tech). The row always carries the label.
- `categoryVisual()` maps starter categories to fixed families/glyphs (housing → orange house, essentials → pink basket, transport → sky car, savings → mint leaf, other → slate dots …). Custom categories get a family hashed from their **ID** (never list position) and a tag glyph. A user-chosen emoji that differs from the starter default is shown as-is, so styling never overwrites their choice.
- `featureVisual` gives Plan/Settings features one stable identity each (spending orange receipt, bills orange calendar, goals mint target, contributions sky people, forecast periwinkle chart, review sky clipboard).

## Typography

System sans for everything readable; bundled Manrope only for large `amount` figures (tabular numerals). Tab titles 28/36 bold navy; sections 18/26 bold; row titles 16/22 medium; amounts in rows 16/22 tabular. System text scaling is preserved: rows move their amount under the title at font scale ≥ 1.4, summary stats wrap, and the wheel shrinks with its total moved below at scale > 1.3.

## Layout

`Screen` keeps the 760-unit reading width, 16/20 side gutters, safe areas, keyboard avoidance and pull-to-refresh on native. `withAction` reserves room for the persistent **Add expense** bar, which the launcher draws above the tab bar on Overview, Plan, Personal and Spending budget (Personal says "Add personal expense"). Other screens keep the compact floating action. Web uses a white bottom tab bar below 900 effective units and a top bar above.

## Components

- **Buttons**: primary navy, secondary white with 1-unit blue border, ghost blue text; 50-unit height, 12 radius, optional leading icon; disabled/loading 0.5 opacity.
- **Summary panel** (`HeroCard`): navy, label, large amount, one factual subtitle, optional "View budget ›" link and a progress bar only when a real denominator exists. Overview's label is "Shared budget remaining" (or "Over shared plan"), captioned "Budget estimate · Not your bank balance".
- **Rows** (`ListRow`, `ListSection`, `GroupGap`): tile, title/subtitle, tabular value, chevron when it navigates. Pressable rows have a 66-unit minimum height and a spoken label combining title, amount and state; `accessibilityHint` names the destination where the title alone doesn't.
- **Headers**: `TabHeader` (large title, subtitle, profile initial or gear) and `DetailHeader` (back arrow, centred title, optional close).
- **Segmented**: Shared / Personal radio group; selected segment filled blue.
- **Amount entry**: one large typed amount; steppers removed. Invalid text is kept and explained, never replaced.
- **Sheet**: "Cancel" text button left, centred title.
- **Monthly review stages**: numbered list (current filled blue, announced as "Current step"), "Step n of 3", "This records your plan. No money is moved."

## Charts

- **Spending wheel** (`SpendingWheel`, geometry in `wheel-geometry.ts`): exact angles from real values, equal visual gaps and round caps taken from every arc, tiny categories drawn as dots, a single category as a full ring. Centre shows "Total spend". It renders only when every charted category is positive and the total is positive; refunds that make a category or the total non-positive switch to a signed list with an explanation. An empty month shows the track only plus text. The wheel is one accessible image with a text summary; category rows are the accessible equivalent, and selecting a row highlights its arc (others fade).
- **Finance summary**: Income / Total spending / Net balance in circular icon badges (holders, not gauges), captioned "Recorded shared income less spending", with "About these figures" stating that opening balances, earmarks, expected income and future entries are excluded and that the figure is not a bank balance. All three use the same month and today cutoff (`spendingSummary`).
- **Bars** (`PeriodBarChart`): periwinkle rounded bars on a signed zero baseline; the active checkpoint is full strength, others 45%.
- Goal progress bars remain where saved/target is a real ratio. No decorative gauges.

## States

Loading text differs from empty text. Failed sections say the figure is unavailable ("It isn't zero") with Try again; cached data is never presented as current. Overview shows at most one attention message (budget setup → overdue bill → low forecast → forecast gaps).

## Do / Don't

- Do keep one navy summary per screen and put occasional tasks in Plan or Settings.
- Do state scope, over-plan, refunds, expected vs recorded in words.
- Do map colour by category ID or starter key.
- Don't call any figure a bank or account balance; don't combine forecast and recorded cash.
- Don't add month browsing without complete facts or frozen snapshots.
- Don't treat these web previews as native device verification.
