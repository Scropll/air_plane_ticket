// All dimensions are in metres. Axes: +y up, the nose sits at z = 0 and the
// tail at z = LENGTH, so the aircraft flies toward -z. x = 0 is the centreline;
// +x is the right-hand (starboard) side when you face the nose.

export const LENGTH = 73.9;          // Boeing 777-300ER overall fuselage length
export const RADIUS = 3.1;           // outer fuselage radius (6.2 m diameter)
export const WALL = 0.15;            // skin + frames + sidewall lining
export const INNER = RADIUS - WALL;  // cabin sidewall radius (5.86 m cabin width)
export const FLOOR_Y = -1.0;         // top of the main-deck floor
export const NOSE_LEN = 7.5;
export const TAIL_START = 58.0;
export const TAIL_LEN = LENGTH - TAIL_START;
export const TAIL_END_R = 0.32;

// Clipping range used by the cutaway (cabin) view.
export const CABIN_Z0 = 5.6;   // flight-deck bulkhead
export const CABIN_Z1 = 66.2;  // aft pressure bulkhead
export const CUT_HEIGHT = 1.58; // cutaway plane, measured above the floor

/** Fuselage cross-section at station z: radius and centre height. */
export function section(z) {
  if (z <= 0) return { r: 0.02, yc: -0.6 };
  if (z < NOSE_LEN) {
    const t = z / NOSE_LEN;
    const r = RADIUS * Math.sqrt(1 - Math.pow(1 - t, 2.2));
    const yc = -0.6 * (1 - t) * (1 - t);
    return { r: Math.max(r, 0.02), yc };
  }
  if (z <= TAIL_START) return { r: RADIUS, yc: 0 };
  const t = Math.min(1, (z - TAIL_START) / TAIL_LEN);
  const r = RADIUS - (RADIUS - TAIL_END_R) * Math.pow(t, 1.8);
  const yc = (RADIUS - r) - 0.35 * t; // upswept tail: top line stays almost flat
  return { r, yc };
}

/** Point on the fuselage skin. `a` is measured from the top, positive to +x. */
export function surfacePoint(z, a, offset = 0) {
  const { r, yc } = section(z);
  const rr = r + offset;
  return [rr * Math.sin(a), yc + rr * Math.cos(a), z];
}

/** Half width of the cabin at height y (absolute) and station z. */
export function cabinHalfWidth(z, y) {
  const { r, yc } = section(z);
  const ri = r - WALL;
  const dy = y - yc;
  return dy * dy >= ri * ri ? 0 : Math.sqrt(ri * ri - dy * dy);
}

// ---------------------------------------------------------------------------
// Cabin layout: ANA Boeing 777-300ER (77W), 8 F / 64 J / 24 W / 116 Y = 212.
// Stations come from the seat map, which is drawn to scale:
//   z = 6.0 m + (map pixel y - 160) * 0.0338 m   (Economy rows land 0.87 m apart,
//   matching ANA's 34 in pitch).
// ---------------------------------------------------------------------------
const rowsFrom = (z0, pitch, first, last) => {
  const out = [];
  for (let r = first; r <= last; r++) out.push({ row: r, z: z0 + (r - first) * pitch });
  return out;
};

export const LAYOUT = {
  doors: [
    { name: 'L1/R1', z: 8.5 },
    { name: 'L2/R2', z: 19.5 },
    { name: 'L3/R3', z: 35.2 },
    { name: 'L4/R4', z: 49.2 },
    { name: 'L5/R5', z: 62.2 },
  ],
  doorWidth: 1.07,
  doorHeight: 1.93,

  // First: 1-2-1 closed suites, rows 1-2
  first: {
    suiteLength: 1.95,
    suiteWidth: 1.1,
    rows: [{ row: 1, z: 11.45 }, { row: 2, z: 13.45 }],
    cols: [
      { letter: 'A', x: -2.2, position: 'window', doorSide: 1 },
      { letter: 'D', x: -0.56, position: 'centre', doorSide: -1 },
      { letter: 'G', x: 0.56, position: 'centre', doorSide: 1 },
      { letter: 'K', x: 2.2, position: 'window', doorSide: -1 },
    ],
    wallHeight: 1.35,
  },

  // Business: staggered 1-2-1. Odd rows seat A, E, F, K; even rows C, D, G, H.
  // console: side (+1 = +x) of the seat that carries the side table.
  business: {
    // z = suite centre; the seat sits 0.41 m from it, the footwell on the other side
    blocks: [
      rowsFrom(15.45, 1.3, 5, 6),
      rowsFrom(22.6, 1.264, 7, 16),
      rowsFrom(38.3, 1.264, 17, 20),
    ],
    // Four suite columns. Odd rows face aft, even rows face forward, so each
    // facing pair tucks its footwells side by side ("THE Room").
    // mirror flips which side of the suite the footwell sits on.
    columns: [
      { x: -2.18, kind: 'win', mirror: false, odd: 'A', even: 'C', position: 'window' },
      { x: -0.56, kind: 'mid', mirror: true, odd: 'E', even: 'D', position: 'centre' },
      { x: 0.56, kind: 'mid', mirror: false, odd: 'F', even: 'G', position: 'centre' },
      { x: 2.18, kind: 'win', mirror: true, odd: 'K', even: 'H', position: 'window' },
    ],
    columnWidth: 1.12,
    seatWidth: 0.72,
    podLength: 1.9,
  },

  // Premium Economy: 2-4-2, rows 25-27
  premium: {
    rows: rowsFrom(43.86, 1.0, 25, 27),
    seatWidth: 0.56,
    groups: [['A', 'C'], ['D', 'E', 'F', 'G'], ['H', 'K']],
    aisle: 0.5,
  },

  // Economy: 3-4-3 rows 30-38, 2-4-2 rows 39-41 where the fuselage tapers,
  // and only A C in row 42.
  economy: {
    pitch: 0.87,
    seatWidth: 0.457,
    aisle: 0.48,
    rows: rowsFrom(50.45, 0.87, 30, 42),
    groups: [['A', 'B', 'C'], ['D', 'E', 'F', 'G'], ['H', 'J', 'K']],
  },

  monuments: [
    // galleys, lavatories, closets and the bar: [z0, z1, x0, x1, label]
    [5.75, 7.7, -2.55, -1.3, 'Lav'],
    [5.75, 7.7, -0.2, 1.3, 'Galley'],
    [5.75, 7.9, 1.6, 2.55, 'Galley'],
    [9.2, 10.25, -2.5, -1.6, 'Closet'],
    [9.2, 10.25, -0.3, 1.1, 'Galley'],
    [17.75, 19.0, -2.6, -1.65, 'Lav'],
    [17.75, 19.0, 1.65, 2.6, 'Lav'],
    [18.1, 19.0, -0.9, 0.9, 'Galley'],
    [20.45, 21.45, -2.55, -1.75, 'Closet'],
    [20.45, 21.6, -0.95, 0.95, 'Galley'],
    [20.45, 21.3, 1.75, 2.55, 'Galley'],
    [35.75, 37.3, -2.6, -1.75, 'Lav'],
    [35.75, 37.3, 1.75, 2.6, 'Lav'],
    [35.95, 36.95, -0.95, 0.95, 'Bar'],
    [46.95, 48.35, -2.6, -1.55, 'Lav'],
    [47.0, 48.35, -1.0, 1.0, 'Galley'],
    [46.9, 48.6, 1.6, 2.6, 'Galley'],
    [48.95, 49.85, -1.0, 1.0, 'Galley'],
    [61.35, 62.05, -0.42, 0.42, 'Lav'],
    [63.1, 64.4, -1.85, -1.25, 'Lav'],
    [63.1, 64.4, 1.25, 1.85, 'Lav'],
    [62.9, 65.9, -1.15, -0.1, 'Galley'],
    [62.9, 65.9, 0.1, 1.15, 'Galley'],
  ],
};
