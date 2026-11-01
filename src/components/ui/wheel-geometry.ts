/** Pure donut geometry so proportions are testable without rendering. */
export type WheelInput = { id: string; amount: number };
/** `x`/`y` mark the arc's middle on the ring; a `dot` arc is drawn as a circle there instead of `path`. */
export type WheelArc = { id: string; share: number; start: number; end: number; path: string; dot: boolean; x: number; y: number };

const point = (cx: number, cy: number, r: number, angle: number) =>
  `${(cx + r * Math.sin(angle)).toFixed(3)} ${(cy - r * Math.cos(angle)).toFixed(3)}`;

/**
 * Exact angles come from the real values (clockwise from 12 o'clock). The visible gap and round caps
 * are taken equally from every arc; an arc too small to survive the gap is drawn as a dot at its centre.
 * Returns null unless every amount is finite and positive — signed or empty data must use another view.
 */
export function wheelArcs(items: WheelInput[], { cx = 130, cy = 130, radius = 104, stroke = 22, gap = 5 } = {}): WheelArc[] | null {
  if (!items.length || items.some(item => !Number.isFinite(item.amount) || item.amount <= 0)) return null;
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  if (!Number.isFinite(total) || total <= 0) return null;
  const full = Math.PI * 2;
  const trim = items.length > 1 ? (stroke + gap) / radius : 0;
  let cursor = 0;
  return items.map(item => {
    const share = item.amount / total;
    const start = cursor; const end = cursor + share * full; cursor = end;
    const middle = (start + end) / 2;
    const x = cx + radius * Math.sin(middle); const y = cy - radius * Math.cos(middle);
    if (items.length === 1) {
      return { id: item.id, share, start, end, dot: false, x, y,
        path: `M${point(cx, cy, radius, 0)}A${radius} ${radius} 0 1 1 ${point(cx, cy, radius, Math.PI)}A${radius} ${radius} 0 1 1 ${point(cx, cy, radius, 0)}` };
    }
    const sweep = end - start - trim;
    if (sweep <= 0.0001) {
      return { id: item.id, share, start, end, dot: true, x, y, path: '' };
    }
    const from = start + trim / 2; const to = from + sweep;
    return { id: item.id, share, start, end, dot: false, x, y,
      path: `M${point(cx, cy, radius, from)}A${radius} ${radius} 0 ${sweep > Math.PI ? 1 : 0} 1 ${point(cx, cy, radius, to)}` };
  });
}
