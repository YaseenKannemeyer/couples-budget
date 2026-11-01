/**
 * Rounded solid glyphs on a 24-unit grid, shared by all platforms. Each layer is drawn
 * separately so overlapping parts stay solid; `evenodd` layers cut their inner shapes out.
 * Utility glyphs (chevrons, close, plus) are stroked at the same optical weight.
 */
export type IconLayer = { d: string; rule?: 'evenodd'; stroke?: boolean };

const rr = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 -${r} ${r}h-${w - 2 * r}a${r} ${r} 0 0 1 -${r} -${r}v-${h - 2 * r}a${r} ${r} 0 0 1 ${r} -${r}Z`;
const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 -${2 * r} 0Z`;
const cut = (...parts: string[]): IconLayer => ({ d: parts.join(''), rule: 'evenodd' });
const solid = (d: string): IconLayer => ({ d });
const line = (d: string): IconLayer => ({ d, stroke: true });

function gear() {
  const points: string[] = [];
  for (let i = 0; i < 16; i++) {
    const outer = i % 2 === 0;
    for (const offset of [-0.13, 0.13]) {
      const angle = (i / 16) * Math.PI * 2 + offset;
      const radius = outer ? 10 : 7.6;
      points.push(`${(12 + Math.cos(angle) * radius).toFixed(2)} ${(12 + Math.sin(angle) * radius).toFixed(2)}`);
    }
  }
  return `M${points.join('L')}Z`;
}

const receipt: IconLayer[] = [cut('M6 2.5h12A1.5 1.5 0 0 1 19.5 4v17.2l-2.5-1.6-2.5 1.6-2.5-1.6-2.5 1.6-2.5-1.6-2.5 1.6V4A1.5 1.5 0 0 1 6 2.5Z',
    rr(8, 7, 8, 1.8, 0.9), rr(8, 10.6, 8, 1.8, 0.9), rr(8, 14.2, 5, 1.8, 0.9))];

const check = 'M7.6 12.3l1.5-1.5 2.1 2.1 4.6-4.6 1.5 1.5-6.1 6.1Z';

export const iconLayers = {
  home: [cut('M12 3.2l8.3 6.9c.45.37.7.92.7 1.5V19a2 2 0 0 1-2 2h-4.2v-5.2a1 1 0 0 0-1-1h-3.6a1 1 0 0 0-1 1V21H5a2 2 0 0 1-2-2v-7.4c0-.58.26-1.13.7-1.5L12 3.2Z')],
  plan: [cut(rr(4, 2.5, 16, 19, 3.2), rr(8, 7.5, 8, 1.8, 0.9), rr(8, 11.1, 8, 1.8, 0.9), rr(8, 14.7, 5, 1.8, 0.9))],
  person: [solid(circle(12, 7.5, 4.2)), solid('M4 19.8c0-3.9 3.6-6.6 8-6.6s8 2.7 8 6.6c0 .9-.7 1.7-1.6 1.7H5.6c-.9 0-1.6-.8-1.6-1.7Z')],
  people: [solid(circle(9, 8, 3.5)), solid('M2.5 19.3c0-3.3 2.9-5.6 6.5-5.6s6.5 2.3 6.5 5.6c0 .7-.5 1.2-1.2 1.2H3.7c-.7 0-1.2-.5-1.2-1.2Z'),
    solid(circle(17.2, 8.6, 2.8)), solid('M17.3 13.7c2.5 0 4.2 1.9 4.2 4.6 0 .6-.4 1-1 1h-3.2c0-1.9-.7-3.8-2.1-5.2.7-.3 1.4-.4 2.1-.4Z')],
  calendar: [cut(rr(3, 5, 18, 16, 3.2), rr(6.6, 11.2, 2.6, 2.6, 0.7), rr(10.7, 11.2, 2.6, 2.6, 0.7), rr(14.8, 11.2, 2.6, 2.6, 0.7),
    rr(6.6, 15.2, 2.6, 2.6, 0.7), rr(10.7, 15.2, 2.6, 2.6, 0.7)), solid(rr(6.9, 2.5, 2.2, 5, 1.1)), solid(rr(14.9, 2.5, 2.2, 5, 1.1))],
  target: [cut(circle(12, 12, 9.5), circle(12, 12, 6.9), circle(12, 12, 4.3), circle(12, 12, 1.9))],
  chart: [solid(rr(3.5, 12, 4.4, 8.5, 1.6)), solid(rr(9.8, 7, 4.4, 13.5, 1.6)), solid(rr(16.1, 3.5, 4.4, 17, 1.6))],
  review: [cut(rr(4.5, 4, 15, 17.5, 3), check), solid(rr(8.5, 2, 7, 4, 1.5))],
  receipt,
  bill: receipt,
  wallet: [cut(rr(2.5, 6, 19, 14.5, 3.4), rr(14, 10.5, 9, 5.5, 2.2)), solid(circle(17.4, 13.25, 1.2)), solid(rr(5, 3, 12, 4.4, 1.8))],
  income: [solid('M9 2.8h6l-1.5 3.4h-3L9 2.8Z'),
    cut('M12 7.4c4.8 0 8 4.2 8 8.3 0 3.1-2.4 5.3-5.6 5.3H9.6C6.4 21 4 18.8 4 15.7c0-4.1 3.2-8.3 8-8.3Z',
      'M11.1 11.3h1.8v2.6h2.6v1.8h-2.6v2.6h-1.8v-2.6H8.5v-1.8h2.6Z')],
  spending: [cut(rr(2, 6, 20, 12, 2.6), circle(12, 12, 2.7), circle(6, 12, 1.1), circle(18, 12, 1.1))],
  basket: [cut('M3 9.5h18a1 1 0 0 1 1 1.2l-1.7 8.2A2.5 2.5 0 0 1 17.9 21H6.1a2.5 2.5 0 0 1-2.4-2.1L2 10.7a1 1 0 0 1 1-1.2Z',
    rr(7.8, 12.5, 1.8, 5.5, 0.9), rr(11.1, 12.5, 1.8, 5.5, 0.9), rr(14.4, 12.5, 1.8, 5.5, 0.9)),
    solid('M6.8 9.6 9.7 4.5a1 1 0 0 1 1.7 1L9.1 9.6H6.8Z'), solid('M17.2 9.6 14.3 4.5a1 1 0 0 0-1.7 1l2.3 4.1h2.3Z')],
  car: [cut('M5.2 9.2 6.6 5.6A2.5 2.5 0 0 1 8.9 4h6.2c1 0 1.9.6 2.3 1.6l1.4 3.6c1.6.4 2.7 1.8 2.7 3.4V17a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 17v-4.4c0-1.6 1.1-3 2.7-3.4Z',
    'M7.5 9h9l-1-2.6a.8.8 0 0 0-.8-.5H9.3a.8.8 0 0 0-.8.5L7.5 9Z', circle(6.6, 13.3, 1.3), circle(17.4, 13.3, 1.3)),
    solid(rr(4.5, 16.5, 3.6, 4, 1.3)), solid(rr(15.9, 16.5, 3.6, 4, 1.3))],
  cup: [solid('M3.5 7h12.5v6.4A5.6 5.6 0 0 1 10.4 19H9.1a5.6 5.6 0 0 1-5.6-5.6V7Z'),
    cut(circle(17.6, 11.2, 3.3), circle(17.6, 11.2, 1.6)), solid(rr(2.5, 20, 16, 1.9, 0.95))],
  bolt: [solid('M13.6 2 4.8 13.4h5.8L9.6 22l9.6-12.4h-6L13.6 2Z')],
  heart: [solid('M12 20.6S3 15.2 3 9a4.8 4.8 0 0 1 9-2.4A4.8 4.8 0 0 1 21 9c0 6.2-9 11.6-9 11.6Z')],
  ticket: [cut('M4 5h16a1.5 1.5 0 0 1 1.5 1.5v3a2.5 2.5 0 0 0 0 5v3A1.5 1.5 0 0 1 20 19H4a1.5 1.5 0 0 1-1.5-1.5v-3a2.5 2.5 0 0 0 0-5v-3A1.5 1.5 0 0 1 4 5Z',
    rr(14.6, 7.4, 1.7, 2.5, 0.85), rr(14.6, 10.75, 1.7, 2.5, 0.85), rr(14.6, 14.1, 1.7, 2.5, 0.85))],
  bag: [solid('M6.5 7.5h11a1.5 1.5 0 0 1 1.5 1.4l.8 10.6A1.5 1.5 0 0 1 18.3 21H5.7a1.5 1.5 0 0 1-1.5-1.5L5 8.9a1.5 1.5 0 0 1 1.5-1.4Z'),
    solid('M8.4 9.2V7a3.6 3.6 0 0 1 7.2 0v2.2h-1.9V7a1.7 1.7 0 0 0-3.4 0v2.2H8.4Z')],
  shield: [cut('M12 2.5 19.5 5.3v6c0 4.9-3.2 8.6-7.5 10.2-4.3-1.6-7.5-5.3-7.5-10.2v-6L12 2.5Z', check)],
  dining: [line('M6.5 3v5.5a3 3 0 0 0 6 0V3M9.5 3v18'), solid('M18.6 2.6c-2.4 1-3.9 3.6-3.9 7.1v4.4h2.3v6.3a1.3 1.3 0 0 0 2.6 0V3.5c0-.7-.4-1.1-1-.9Z')],
  leaf: [solid('M20.5 3.5c-9.3 0-15.3 4-15.3 11 0 1.4.3 2.7.9 3.8l-2.6 2.6 1.3 1.3 2.6-2.6c1.1.6 2.4.9 3.8.9 7.1 0 9.3-6 9.3-17Z')],
  dots: [solid(circle(5.5, 12, 2.1)), solid(circle(12, 12, 2.1)), solid(circle(18.5, 12, 2.1))],
  tag: [cut('M3 4.5A1.5 1.5 0 0 1 4.5 3h7.1c.4 0 .8.2 1.1.4l8.4 8.4a1.5 1.5 0 0 1 0 2.1l-7.1 7.1a1.5 1.5 0 0 1-2.1 0l-8.5-8.3a1.5 1.5 0 0 1-.4-1.1V4.5Z', circle(7.6, 7.6, 1.7))],
  lock: [cut(rr(4.5, 10, 15, 11.5, 3), rr(11, 13.8, 2, 4.4, 1)), solid('M7.4 10.5V7.6a4.6 4.6 0 0 1 9.2 0v2.9h-2.2V7.6a2.4 2.4 0 0 0-4.8 0v2.9H7.4Z')],
  settings: [cut(gear(), circle(12, 12, 3.3))],
  bell: [solid('M12 2.8a1.3 1.3 0 0 1 1.3 1.3v.6a6 6 0 0 1 4.7 5.9v3.6l1.6 2.4a1 1 0 0 1-.8 1.6H5.2a1 1 0 0 1-.8-1.6L6 14.2v-3.6a6 6 0 0 1 4.7-5.9v-.6A1.3 1.3 0 0 1 12 2.8Z'),
    solid(rr(9.6, 19, 4.8, 2.6, 1.3))],
  book: [solid('M2.8 5.3c2.8-.7 5.6-.3 8.2 1.2v13.4c-2.6-1.3-5.4-1.6-8.2-1V5.3Z'), solid('M21.2 5.3c-2.8-.7-5.6-.3-8.2 1.2v13.4c2.6-1.3 5.4-1.6 8.2-1V5.3Z')],
  grid: [solid(rr(3, 3, 8, 8, 2.2)), solid(rr(13, 3, 8, 8, 2.2)), solid(rr(3, 13, 8, 8, 2.2)), solid(rr(13, 13, 8, 8, 2.2))],
  verified: [cut(circle(12, 12, 9.5), check)],
  gift: [cut(rr(3.5, 8, 17, 4.5, 1.5), rr(11.2, 8, 1.6, 4.5, 0.4)), cut(rr(5, 13.5, 14, 8, 1.5), rr(11.2, 13.5, 1.6, 8, 0.4)),
    solid('M11.4 7.6C10.5 5.2 8.4 3.6 6.9 4.3c-1.2.6-1 2.5.8 3.3h3.7Zm1.2 0c.9-2.4 3-4 4.5-3.3 1.2.6 1 2.5-.8 3.3h-3.7Z')],
  sparkle: [solid('M12 2.5Q13 11 21.5 12 13 13 12 21.5 11 13 2.5 12 11 11 12 2.5Z')],
  pie: [solid('M11 3.05A9 9 0 1 0 20.95 13H11V3.05Z'), solid('M13 2.05V11h8.95A9 9 0 0 0 13 2.05Z')],
  alert: [cut('M10.3 3.9a2 2 0 0 1 3.4 0l8 13.6A2 2 0 0 1 20 20.5H4a2 2 0 0 1-1.7-3l8-13.6Z', rr(11.1, 8.8, 1.8, 6.2, 0.9), circle(12, 17.4, 1.15))],
  clock: [cut(circle(12, 12, 9.5), 'M11.1 6.8h1.8v4.7l3 1.8-.9 1.5-3.9-2.3V6.8Z')],
  camera: [cut(rr(2.5, 6.5, 19, 14, 3), circle(12, 13.5, 4), circle(12, 13.5, 2.3)), solid(rr(8, 4, 8, 4.5, 1.6))],
  plus: [line('M12 5v14M5 12h14')],
  minus: [line('M5 12h14')],
  chevronRight: [line('m9 5 7 7-7 7')],
  chevronLeft: [line('m15 5-7 7 7 7')],
  back: [line('M19 12H5m6-7-7 7 7 7')],
  close: [line('M6 6l12 12M18 6 6 18')],
  check: [line('m5 12.5 4.5 4.5L19 7.5')],
  arrow: [line('M7 17 17 7M8 7h9v9')],
  refresh: [line('M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5')],
  signOut: [line('M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4m5-12 4 4-4 4m4-4H9')],
} satisfies Record<string, IconLayer[]>;

export type IconName = keyof typeof iconLayers;
