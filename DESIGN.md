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
  shared-light-hero: "#191B24"
  shared-light-hero-text: "#FFFFFF"
  shared-light-hero-secondary: "#BCC0D2"
  shared-light-hero-track: "#373B4D"
  shared-light-hero-accent: "#8291FF"
  shared-light-hero-attention: "#F0BA94"
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
  shared-dark-hero: "#202538"
  shared-dark-hero-text: "#FFFFFF"
  shared-dark-hero-secondary: "#BCC0D2"
  shared-dark-hero-track: "#3B425A"
  shared-dark-hero-accent: "#A2AEFF"
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
  private-light-hero: "#242035"
  private-light-hero-accent: "#B59AFF"
  private-dark-background: "#14121E"
  private-dark-accent: "#C5AEFF"
  private-dark-on-accent: "#2A194C"
  private-dark-accent-soft: "#382B50"
  private-dark-hero: "#2C2440"
  private-dark-hero-accent: "#C5AEFF"
typography:
  display:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "38px"
    fontWeight: 700
    lineHeight: "48px"
    letterSpacing: "-1px"
  title:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: "38px"
    letterSpacing: "-0.7px"
  amount:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "38px"
    fontWeight: 700
    lineHeight: "48px"
    letterSpacing: "-1px"
  section:
    fontFamily: "System, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "28px"
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
  small: "12px"
  medium: "18px"
  large: "28px"
  pill: "999px"
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
    padding: "{spacing.four}"
  hero-card:
    backgroundColor: "{colors.shared-light-hero}"
    textColor: "{colors.shared-light-hero-text}"
    rounded: "{rounded.large}"
    padding: "{spacing.four}"
  hero-card-private:
    backgroundColor: "{colors.private-light-hero}"
    textColor: "{colors.shared-light-hero-text}"
    rounded: "{rounded.large}"
    padding: "{spacing.four}"
  field:
    backgroundColor: "{colors.shared-light-background-element}"
    textColor: "{colors.shared-light-text}"
    rounded: "{rounded.small}"
    padding: "{spacing.three}"
  choice-selected:
    backgroundColor: "{colors.shared-light-background-element}"
    textColor: "{colors.shared-light-accent}"
    rounded: "{rounded.small}"
    padding: "8px 16px"
  web-tabs:
    backgroundColor: "{colors.shared-light-background-element}"
    rounded: "{rounded.large}"
    padding: "8px"
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

Couple Goals places clear financial summaries on cool, quiet surfaces. Rounded white cards, a near-black spending hero, indigo progress and small category color tiles follow the five confirmed finance references in `inspo/`. Private keeps the same structure with a violet accent and dark violet hero. Familiar system body text supports quick logging; Manrope makes headings and real amounts distinct.

This is a scan of the Phase 1.5 implementation, derived from `src/constants/theme.ts`, `src/components/ui/`, navigation and current screens. It records the implemented world, not future product features. Native device checks are unavailable; this document does not mark Phase 1.5 fully verified.

**Key Characteristics:**
- Cool surfaces with a dark financial anchor.
- Shared indigo and Private violet, reinforced with labels and privacy copy.
- Readable numbers, wrapping rows and restrained motion.
- Real data and recoverable states before decoration.

## Colors

The palette uses cool neutrals, crisp indigo and a related violet for Private. The frontmatter contains exact source values. `shared-light-*` is the base palette; `shared-dark-*` provides all dark roles. Private inherits its appearance's Shared roles except for the explicit `private-light-*` and `private-dark-*` overrides. Resolve by space first, then appearance; do not reuse light colors on dark screens.

### Primary

- **Shared Indigo** (`accent`, `accentSoft`, `onAccent`): primary actions, selected controls, progress and active chart bars. Hero progress uses its separate `heroAccent` for contrast on dark cards.

### Secondary

- **Private Violet**: replaces the canvas, accent, accent wash and hero roles in Private; dark Private also overrides the on-accent ink. The visible Private label, lock icon and privacy explanation carry meaning alongside color.
- **Category Orange, Blue, Pink and Green**: quiet tile backgrounds paired with stronger chart inks. `categoryTone(id, theme)` hashes the stable category identifier to one of four pairs; ordering a list must not recolor it.
- **Attention and Success**: warm brown/peach for warnings and validation; green for paid/refund semantics. Neither role replaces explicit status text.

### Neutral

- **Cool Canvas** (`background`), **Surface** (`backgroundElement`) and **Selected Surface** (`backgroundSelected`) separate page, card and control layers.
- **Primary Ink**, **Secondary Ink** and **Border** distinguish amounts/headings, supporting copy and hairline dividers.
- **Hero**, **Hero Text**, **Hero Secondary** and **Hero Track** form an independent high-contrast financial summary surface. **Scrim** is an alpha overlay role.

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

Use a scrolling, keyboard-aware `Screen`, centered to a maximum reading width of 760 units. Side margins are 16 below 380 units of window width and 20 otherwise; top padding and section gaps use `Spacing.four`. The default bottom content padding is 96. Screens with tabs use `BottomTabInset + Spacing.six`: the current inset token is 50 on iOS and 80 on Android/web. These allowances complement safe-area handling; they do not replace it.

`SafeAreaView` protects top and sides on tab screens and all edges elsewhere. The scroll view keeps handled keyboard taps and dismisses the keyboard on drag; iOS uses padding keyboard avoidance. Preserve native Back gestures and route-owned modal presentation.

Use the recorded spacing scale. Cards normally use `four` padding and `three` gaps; stat tiles use `three` padding and `two` gaps. Paired stat tiles flex and wrap with a 145-unit basis. Summary labels use a flexible 45% basis; category name blocks use a flexible 100-unit basis. Do not force equal fixed-width money columns.

Web tabs sit at the bottom in a centered rounded surface. Their optional brand appears only when window width divided by font scale is at least 600. Native tabs keep platform rendering and system insets. Pill action bands scroll horizontally at ordinary text size and stack when font scale exceeds 1.2. The donut replaces its ring layout with a text-led center above font scale 1.3.

## Elevation & Depth

The implementation is primarily flat: canvas, surface, selected wash and dark hero establish depth. Standard `Card`, `HeroCard` and stat tiles do not apply a shadow. The theme exports a card shadow (`0px 4px 16px #141B3810`) as available vocabulary; its exact value belongs in the sidecar. Native sheets and tabs retain platform depth behavior rather than simulating native chrome with layers of decorative containers.

**The Flat Surface Rule.** Use tonal separation at rest. The existing card shadow token is optional vocabulary, not a shadow applied to every card.

## Shapes

Large, gently rounded surfaces use `Radius.large`; selection groups and picker wrappers use `medium`; text inputs, category tiles and individual choices use `small`. Buttons, action pills, circular icon holders and progress tracks use `pill`. Category tiles are 44 square; interactive step controls are 48 square. The 38-unit hero icon is decorative, not a standalone touch target. Hairline borders belong to fields, selected choices and list dividers.

## Components

### Buttons

Primary, secondary and ghost buttons share a pill silhouette, 50-unit minimum height and the frontmatter padding. Primary uses accent/on-accent, secondary accent wash/accent and ghost transparent/secondary ink. Loading replaces the label with a spinner; loading and disabled states block presses and use 0.55 opacity. Pressed opacity is 0.78; the 0.985 press scale is suppressed under reduced motion. Native selection haptics run only when reduced motion is off and ignore unsupported-device failures. The app does not define a custom hover or focus ring in this component; sidecar browser snippets retain visible keyboard focus as previews.

### Choices and category picker

`Choices` is a wrapping radio group on the selected-surface wash. Each choice has a 48-unit minimum height, small radius and visible checked/disabled semantics. Selected options use a surface background, hairline border and accent text. Category selection is a native `@expo/ui` Host/Picker on iOS and Android; web uses a labelled HTML select. Do not replace the picker with a custom imitation for documentation consistency.

### Cards and financial summaries

`Card` holds a single related group. `HeroCard` uses the dark financial palette, a labelled decorative icon and actual formatted amount, then optional signed summary rows, progress and a warm warning. `StatTile` is a smaller white/tonal companion with a circular accent-wash icon. Preserve unknown-plan copy and omit progress where its denominator is missing or non-positive. The spending-limit slot is deliberately not rendered.

### Inputs and amount entry

`TextField` has a visible label unless the enclosing amount control supplies it, a 56-unit minimum height, small radius, system body text and a hairline border. Selection/cursor use the accent. Validation replaces the border and helper copy with Attention and passes the error as the accessibility hint. `AmountEntry` adds labelled minus/plus controls, locale-aware editing and existing whole-currency-unit increments. It keeps invalid typed text recoverable and disables impossible adjustments; it does not silently convert it to zero.

### Navigation, sheets and icons

Native tabs use the current Router native tab implementation with labelled Home, Shared Budget, Private Space and Settings destinations. Platform tab icons use SF Symbols on iOS and Material names on Android. Web uses the equivalent labelled bottom tab bar with selected tonal background and accent ink. Navigation currently resolves the Shared palette independently of a Private screen's nested context; do not claim the whole tab bar turns violet.

Quick log and its queue use route-owned form sheets with an in-content handle and Cancel/Save header. Preserve Router dismissal and keyboard behavior. Content icons use `expo-symbols` SF Symbols on iOS and local stroked SVG paths on Android/web; category emoji are optional decorations. Do not add raster icon dependencies.

### Charts and progress

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
- Do wrap long names and localized amounts, preserve text scaling and keep controls at least 48 units tall.
- Do display unknown, missing, cached and failed data honestly with the existing recovery actions.
- Do keep monthly budget labels monthly and distinguish forecast checkpoints from spending history.

### Don't:

- Don't expose partner-private categories or transactions in shared summaries.
- Don't fabricate balances, chart history, spending limits or weekly/annual budget views.
- Don't copy reference-screen controls whose data contracts are absent.
- Don't use color alone for state, privacy, chart meaning or refund semantics.
- Don't describe web preview inspection as native device verification.
