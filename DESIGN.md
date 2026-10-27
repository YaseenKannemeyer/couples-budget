---
name: "Couple Goals"
description: "Calm shared finances with distinct private spaces."
colors:
  shared-light-text: "#191B24"
  shared-light-text-secondary: "#636675"
  shared-light-background: "#F6F7FA"
  shared-light-background-element: "#FFFFFF"
  shared-light-background-selected: "#EBEDF5"
  shared-light-border: "#DCE0EA"
  shared-light-accent: "#465CF4"
  shared-light-accent-soft: "#E9ECFF"
  shared-light-on-accent: "#FFFFFF"
  shared-light-attention: "#9A542F"
  shared-light-success: "#267654"
  shared-light-hero: "#FFFFFF"
  shared-light-hero-text: "#191B24"
  shared-light-hero-secondary: "#636675"
  shared-light-hero-track: "#EBEDF5"
  shared-light-hero-accent: "#465CF4"
  shared-light-hero-attention: "#9A542F"
  shared-light-category-orange: "#FFF0DC"
  shared-light-category-blue: "#E2EEFF"
  shared-light-category-pink: "#FBE5F5"
  shared-light-category-green: "#E0F3E9"
  shared-light-chart-orange: "#C47A24"
  shared-light-chart-blue: "#4385E7"
  shared-light-chart-pink: "#CA5BAD"
  shared-light-chart-green: "#31906B"
  shared-light-scrim: "#00000070"
  shared-dark-text: "#F2F3FA"
  shared-dark-text-secondary: "#ADB2C5"
  shared-dark-background: "#10121A"
  shared-dark-background-element: "#1C1F2B"
  shared-dark-background-selected: "#2C3041"
  shared-dark-border: "#363B4E"
  shared-dark-accent: "#9CA9FF"
  shared-dark-accent-soft: "#2A3156"
  shared-dark-on-accent: "#151D47"
  shared-dark-attention: "#F0BA94"
  shared-dark-success: "#85D8B2"
  shared-dark-hero: "#1C1F2B"
  shared-dark-hero-text: "#F2F3FA"
  shared-dark-hero-secondary: "#ADB2C5"
  shared-dark-hero-track: "#2C3041"
  shared-dark-hero-accent: "#9CA9FF"
  shared-dark-hero-attention: "#F0BA94"
  shared-dark-category-orange: "#453321"
  shared-dark-category-blue: "#253A5A"
  shared-dark-category-pink: "#442B40"
  shared-dark-category-green: "#233F35"
  shared-dark-chart-orange: "#EFB363"
  shared-dark-chart-blue: "#78AFFF"
  shared-dark-chart-pink: "#EE91D6"
  shared-dark-chart-green: "#79CFAD"
  shared-dark-scrim: "#00000090"
  private-light-background: "#F7F6FC"
  private-light-accent: "#7050D5"
  private-light-accent-soft: "#EFE8FF"
  private-light-hero: "#FFFFFF"
  private-light-hero-accent: "#7050D5"
  private-dark-background: "#14121E"
  private-dark-accent: "#C5AEFF"
  private-dark-on-accent: "#2A194C"
  private-dark-accent-soft: "#382B50"
  private-dark-hero: "#211D30"
  private-dark-hero-accent: "#C5AEFF"
typography:
  display:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: "42px"
    letterSpacing: "-1px"
  title:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "36px"
    letterSpacing: "-0.7px"
  amount:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: "42px"
    letterSpacing: "-1px"
  section:
    fontFamily: "System, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "26px"
    letterSpacing: "-0.3px"
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
  small-bold:
    fontFamily: "System, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "21px"
  caption-code:
    fontFamily: "Menlo, monospace"
    fontSize: "13px"
    lineHeight: "19px"
rounded:
  small: "10px"
  medium: "12px"
  large: "16px"
  pill: "12px"
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
    backgroundColor: "{colors.shared-light-accent}"
    textColor: "{colors.shared-light-on-accent}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "{colors.shared-light-accent-soft}"
    textColor: "{colors.shared-light-accent}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.shared-light-text-secondary}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  button-private-primary:
    backgroundColor: "{colors.private-light-accent}"
    textColor: "{colors.shared-light-on-accent}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.shared-light-background-element}"
    rounded: "{rounded.large}"
    padding: "{spacing.three}"
  hero-card:
    backgroundColor: "{colors.shared-light-hero}"
    textColor: "{colors.shared-light-hero-text}"
    rounded: "{rounded.large}"
    padding: "{spacing.three}"
  hero-card-private:
    backgroundColor: "{colors.private-light-hero}"
    textColor: "{colors.shared-light-hero-text}"
    rounded: "{rounded.large}"
    padding: "{spacing.three}"
  field:
    backgroundColor: "{colors.shared-light-background-element}"
    textColor: "{colors.shared-light-text}"
    rounded: "{rounded.small}"
    padding: "12px 16px"
  choice-selected:
    backgroundColor: "{colors.shared-light-background-element}"
    textColor: "{colors.shared-light-accent}"
    rounded: "{rounded.small}"
    padding: "8px 16px"
  web-tabs:
    backgroundColor: "{colors.shared-light-background-element}"
    rounded: "{rounded.medium}"
    padding: "4px 8px"
  web-tabs-desktop:
    backgroundColor: "{colors.shared-light-background-element}"
    rounded: "0px"
    padding: "4px 24px"
  category-tile-orange:
    backgroundColor: "{colors.shared-light-category-orange}"
    textColor: "{colors.shared-light-chart-orange}"
    rounded: "{rounded.small}"
    size: "44px"
  progress-track:
    backgroundColor: "{colors.shared-light-background-selected}"
    rounded: "{rounded.pill}"
    height: "9px"
---

# Design System: Couple Goals

## Overview

**Creative North Star: "Shared clarity, private confidence"**

Couple Goals places clear financial summaries and compact rows on a calm canvas. Financial summaries follow the current appearance: white in light mode and near-black in dark mode, with normal readable ink. Shared indigo and Private violet identify the space without dominating it. Familiar system body text supports quick logging; bundled Manrope distinguishes headings and real amounts.

This scan records the user-approved Phase 1.8 simplification from `src/constants/theme.ts`, `src/components/ui/`, navigation and current screens. It supersedes the Phase 1.5 large inverted spending-card direction, including the historical surface brief. Reuse the quieter native-scale hierarchy, fewer independent containers and progressive detail. Synthetic browser evidence is available; native runtime, live two-person behavior and new-user comprehension acceptance remain pending. No task-time or performance measurements have been made.

**Key Characteristics:**
- Calm surfaces, compact rows and one prominent financial summary per task.
- Shared indigo and Private violet, reinforced with labels and privacy copy.
- Readable numbers, wrapping rows and restrained motion.
- Real data and recoverable states before decoration.

## Colors

The palette uses cool neutrals, crisp indigo and a related violet for Private. The frontmatter contains exact source values. `shared-light-*` is the base palette; `shared-dark-*` provides all dark roles. Private inherits its appearance's Shared roles except for the explicit `private-light-*` and `private-dark-*` overrides. Resolve by space first, then appearance; do not reuse light colors on dark screens.

### Primary

- **Shared Indigo** (`accent`, `accentSoft`, `onAccent`): primary actions, selected controls, progress and active chart bars. Summary progress retains its semantic `heroAccent` role, resolved for the current space and appearance.

### Secondary

- **Private Violet**: overrides the canvas, accent, accent wash and selected summary roles in Private; dark Private also overrides the on-accent ink. The visible Private label, lock icon and privacy explanation carry meaning alongside color.
- **Category Orange, Blue, Pink and Green**: quiet tile backgrounds paired with stronger chart inks. `categoryTone(id, theme)` hashes the stable category identifier to one of four pairs; ordering a list must not recolor it.
- **Attention and Success**: warm brown/peach for warnings and validation; green for paid/refund semantics. Neither role replaces explicit status text.

### Neutral

- **Cool Canvas** (`background`), **Surface** (`backgroundElement`) and **Selected Surface** (`backgroundSelected`) separate page, card and control layers.
- **Primary Ink**, **Secondary Ink** and **Border** distinguish amounts/headings, supporting copy and hairline dividers.
- **Hero**, **Hero Text**, **Hero Secondary** and **Hero Track** are semantic financial-summary roles within the current appearance; their names do not imply an inverted surface. **Scrim** is an alpha overlay role.

**The Space Rule.** Shared uses indigo; Private uses violet. Category hue is decorative and never signals visibility or ownership.

## Typography

**Display Font:** bundled Manrope, with system fallback when loading fails. `DisplayFontContext` enables it for `title`, `subtitle` and `amount` only.

**Body Font:** platform system sans: `System` on iOS, `system-ui` on web and `sans-serif` elsewhere. The frontmatter family lists describe these platform alternatives, not an additional downloaded body font.

**Code Font:** Menlo on iOS, platform monospace elsewhere. Code weight is platform dependent.

### Hierarchy

- **Display / amount:** `Type.display`, bold, tight tracking. `ThemedText` calls the display heading `title`; financial amounts additionally use tabular numerals.
- **Title:** `Type.title`, bold; rendered through the `subtitle` text variant. Donut center amounts also use this smaller size.
- **Section:** `Type.section`, system semibold, slightly tight tracking; section headers remain separate from display typography.
- **Body:** `Type.body`, system regular; explanatory copy and primary reading text.
- **Small / small bold:** `Type.small`, regular or semibold; hints, status labels and control labels. Button labels override the size to 15 while retaining the small line height. Web tab labels use 12.
- **Caption code:** `Type.caption`; supporting technical content only.

Sizes and line heights in frontmatter are React Native logical units represented as `px` for portable tooling. Preserve native font scaling. Avoid fixed number widths: amount, summary and hero rows wrap rather than truncate localized money. `AmountEntry` intentionally remains a system-font input at the title scale.

**The Truthful Amount Rule.** Keep actual formatted amounts visible. Animate opacity or chart geometry; never count through fictional balances.

## Layout

Use a scrolling, keyboard-aware `Screen`, centered to a maximum reading width of 760 units. Side margins are 16 below 380 units of window width and 20 otherwise; normal top padding uses `Spacing.four`; section gaps are 20 units. The default bottom content padding is 96. Screens with tabs use `BottomTabInset + Spacing.six`: the current inset token is 50 on iOS and 80 on Android/web. These allowances complement safe-area handling; they do not replace it.

`SafeAreaView` protects top and sides on tab screens and all edges elsewhere. The scroll view keeps handled keyboard taps and dismisses the keyboard on drag; iOS uses padding keyboard avoidance. Preserve native Back gestures and route-owned modal presentation.

Use the recorded spacing scale. Cards and financial summaries use `three` padding and `two` gaps. Stat tiles are transparent compact figures with `two` vertical padding and `two` gaps. Related content uses plain rows or a single group rather than repeated independent cards. Paired stat tiles flex and wrap with a 145-unit basis. Summary labels use a flexible 45% basis; category name blocks use a flexible 100-unit basis. Do not force equal fixed-width money columns.

Web tabs move to a full-width top bar when window width divided by font scale is at least 900. At that breakpoint tab screens reserve 88 units at the top and 88 at the bottom. Narrower web uses centered bottom navigation with a maximum width matching the content. The optional brand appears only when effective width is at least 600. Native tabs keep platform rendering and system insets. Quiet action rows wrap with 48-unit targets and hairline underlines. The donut replaces its ring layout with a text-led center above font scale 1.3.

## Elevation & Depth

The implementation is primarily flat: canvas, surface and selected wash establish depth. Financial summaries use the current appearance, with white light-mode surfaces and near-black dark-mode surfaces. Standard `Card`, `HeroCard` and stat tiles do not apply a shadow. The theme exports a card shadow (`0px 4px 16px #141B3810`) as available vocabulary; its exact value belongs in the sidecar. Native sheets and tabs retain platform depth behavior rather than simulating native chrome with layers of decorative containers.

**The Flat Surface Rule.** Use tonal separation at rest. The existing card shadow token is optional vocabulary, not a shadow applied to every card.

## Shapes

Large, gently rounded surfaces use `Radius.large`; selection groups and picker wrappers use `medium`; text inputs, category tiles and individual choices use `small`. Buttons and progress tracks use the legacy-named `pill` token, now a modest 12-unit corner rather than a capsule. Quiet action rows have no enclosing capsule. Category tiles are 44 square; interactive step controls are 48 square. The 18-unit financial-summary heading icon and 16-unit stat icon are decorative, not standalone touch targets. Hairline borders belong to fields, selected choices and list dividers.

## Components

### Buttons

Primary, secondary and ghost buttons share a softly rectangular silhouette, 50-unit minimum height and the frontmatter padding. Primary uses accent/on-accent, secondary accent wash/accent and ghost transparent/secondary ink. Loading replaces the label with a spinner; loading and disabled states block presses and use 0.55 opacity. Pressed opacity is 0.78; the 0.985 press scale is suppressed under reduced motion. Native selection haptics run only when reduced motion is off and ignore unsupported-device failures. The app does not define a custom hover or focus ring in this component; sidecar browser snippets retain visible keyboard focus as previews.

### Choices and category picker

`Choices` is a wrapping radio group on the selected-surface wash. Each choice has a 48-unit minimum height, small radius and visible checked/disabled semantics. Selected options use a surface background, hairline border and accent text. Category selection is a native `@expo/ui` Host/Picker on iOS and Android; web uses a labelled HTML select. Do not replace the picker with a custom imitation for documentation consistency.

### Cards and financial summaries

`Card` holds a single related group. `HeroCard` uses semantic summary roles in the current appearance, a labelled decorative icon and actual formatted amount, then optional signed summary rows, progress and a warm warning. `StatTile` is a transparent compact companion with a small secondary-ink icon and a section-scale amount. Preserve unknown-plan copy and omit progress where its denominator is missing or non-positive. The spending-limit slot is deliberately not rendered.

### Inputs and amount entry

`TextField` has a visible label unless the enclosing amount control supplies it, a 50-unit minimum height, small radius, system body text and a hairline border. Selection/cursor use the accent. Validation replaces the border and helper copy with Attention and passes the error as the accessibility hint. `AmountEntry` adds labelled minus/plus controls, locale-aware editing and existing whole-currency-unit increments. It keeps invalid typed text recoverable and disables impossible adjustments; it does not silently convert it to zero.

### Navigation, sheets and icons

Native tabs use the current Router native tab implementation with labelled Home, Shared Budget, Private Space and Settings destinations. Platform tab icons use SF Symbols on iOS and Material names on Android. Web uses equivalent labelled destinations with selected tonal background and accent ink: top navigation at the desktop effective-width breakpoint, bottom tabs below it. Navigation currently resolves the Shared palette independently of a Private screen's nested context; do not claim the whole tab bar turns violet.

Quick log and its queue use route-owned form sheets with an in-content handle and a Cancel header. The reusable sheet can also accept a header Save action; Quick-log places its Save beside the common fields before optional details. Preserve Router dismissal and keyboard behavior. Content icons use `expo-symbols` SF Symbols on iOS and local stroked SVG paths on Android/web; category emoji are optional decorations. Do not add raster icon dependencies.

### Progressive details and guides

`Disclosure` keeps occasional details in normal flow behind a 48-unit labelled trigger, with expanded accessibility state. Collapsed children remain mounted and leave both the visible and accessibility layout; reopening retains form state. Use it for optional charts, explanations and occasional logging fields, while keeping the common task visible.

Guides use compact in-flow surfaces before the real control, with small progress/title/body text, 16-unit padding, medium radius and wrapping controls. The first eligible authenticated entry starts its short guide after progress is ready and its first target is registered. Completed or dismissed progress is preserved; guides remain personal, skippable, resumable and replayable. No guide advancement submits financial actions.

### Charts and progress

Charts are optional supporting detail; Shared places its spending breakdown behind a disclosure so category rows stay central.

The Shared Budget donut represents positive net category spending only. Its signed center total, screen-reader summary and detailed category rows retain refunds and zero/negative category amounts. Positive arcs carry numbered markers matched to a visible legend; non-positive entries have a dash. The visible explanatory hint states the convention. Category color is never the only identifier.

Every chart receives a factual summary exposed as a single accessible image; internal SVG detail is hidden from assistive technology. Gauges retain text labels and values. Progress exposes a labelled progressbar with a bounded 0–100 geometry and supplied money summary; the signed financial text and over-plan warning remain visible even when the fill is clamped.

Cash-flow bars show current forecast checkpoints at today and offsets of 7, 14 and 21 days, with a signed zero baseline and the confirmed balance as a labelled reference. Below 600 units of viewport width or above font scale 1.2, their date/value legend uses full-width summary rows to keep localized amounts intact; wider views retain aligned columns. They are projected values from the current forecast, not historical spending. Budget and allowance presentation currently supports monthly data only. There is no implemented weekly/annual budget selector, fabricated multi-month series or Private category-history chart.

Chart geometry settles over `Motion.chart` (480 ms), using an exponential-out easing and the system reduced-motion setting. Amount changes fade back to full opacity over `Motion.change` (220 ms) while showing the real final amount throughout. `Motion.feedback` (120 ms) is an exported token; the current button press is direct feedback rather than a timed animation. The reduced-motion hook starts conservatively enabled and tracks OS preference changes.

### Loading, empty, error and offline states

Keep loading copy distinct from empty results. Failed sections expose warm alert text and an existing retry action; they do not display failed data as a zero balance. Missing plans, unknown payment amounts, unavailable allowance aggregates and incomplete forecasts have explicit labels. Private sections recover independently. Preserve cached/offline explanations and queued, blocked, synced and receipt-pending outcomes in quick log. State copy and recovery actions take precedence over charts, and no preview fixture is evidence of a live household balance.

## Do's and Don'ts

### Do:

- Do resolve palette roles from both the current space and system appearance.
- Do retain visible labels, signed amounts, chart summaries and numbered category markers.
- Do group related rows once and disclose occasional detail without clearing entered state.
- Do wrap long names and localized amounts, preserve text scaling and keep controls at least 48 units tall.
- Do display unknown, missing, cached and failed data honestly with the existing recovery actions.
- Do keep monthly budget labels monthly and distinguish forecast checkpoints from spending history.

### Don't:

- Don't restore large inverted summary cards or repeated decorative metric containers from the superseded Phase 1.5 direction.
- Don't expose partner-private categories or transactions in shared summaries.
- Don't fabricate balances, chart history, spending limits or weekly/annual budget views.
- Don't copy reference-screen controls whose data contracts are absent.
- Don't use color alone for state, privacy, chart meaning or refund semantics.
- Don't describe web preview inspection as native device verification.
