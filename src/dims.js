// All dimensions are in metres. Axes: +y up, the nose sits at z = 0 and the
// tail at z = LENGTH, so the aircraft flies toward -z. x = 0 is the centreline;
// +x is the right-hand (starboard) side when you face the nose.

export const LENGTH = 70.0;          // nose tip to tail cone
export const RADIUS = 3.1;           // outer fuselage radius (6.2 m diameter)
export const WALL = 0.15;            // skin + frames + sidewall lining
export const INNER = RADIUS - WALL;  // cabin sidewall radius
export const FLOOR_Y = -1.0;         // top of the main-deck floor
export const NOSE_LEN = 7.5;
export const TAIL_START = 56.0;
export const TAIL_LEN = LENGTH - TAIL_START;
export const TAIL_END_R = 0.32;

// Clipping range used by the cutaway (cabin) view.
export const CABIN_Z0 = 5.6;   // flight-deck bulkhead
export const CABIN_Z1 = 59.9;  // just ahead of the fin root
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
  const r = RADIUS - (RADIUS - TAIL_END_R) * Math.pow(t, 1.3);
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
// Cabin layout (stations along z). Real-world-ish wide-body proportions.
// ---------------------------------------------------------------------------
export const LAYOUT = {
  doors: [
    { name: 'L1/R1', z: 6.9 },
    { name: 'L2/R2', z: 19.6 },
    { name: 'L3/R3', z: 28.6 },
    { name: 'L4/R4', z: 45.3 },
    { name: 'L5/R5', z: 59.0 },
  ],
  doorWidth: 1.07,
  doorHeight: 1.93,

  residence: { z0: 7.6, z1: 12.8, split: 10.4, aisleX: 2.0 },

  first: {
    z0: 12.95,
    suiteLength: 2.1,
    suiteWidth: 1.25,
    rows: [2, 3],
    letters: ['A', 'E', 'K'],
    x: [-1.95, 0, 1.95],
    wallHeight: 1.5,
  },

  premium: {
    z0: 20.9, pitch: 0.97, rows: [10, 11, 12, 13, 14, 15],
    seatWidth: 0.50,
    groups: [['A', 'C'], ['D', 'E', 'F'], ['H', 'K']],
    aisle: 0.56,
  },

  economy: {
    pitch: 0.79,  // 31 in
    seatWidth: 0.457, // 18 in incl. armrest share
    groups: [['A', 'B', 'C'], ['D', 'E', 'F', 'G'], ['H', 'J', 'K']],
    aisle: 0.48,
    sections: [
      { z0: 29.8, rows: [20, 37] },
      { z0: 46.4, rows: [38, 51] },
    ],
  },

  monuments: [
    // galleys, lavatories and closets: [z0, z1, x0, x1, label]
    [5.7, 6.25, -2.7, -0.45, 'Galley'],
    [5.7, 6.25, 0.45, 2.7, 'Galley'],
    [17.4, 18.9, -2.7, -1.0, 'Galley'],
    [17.4, 18.9, 1.0, 2.7, 'Lav'],
    [17.4, 18.4, -0.55, 0.55, 'Closet'],
    [26.3, 27.9, -2.7, -1.5, 'Lav'],
    [26.3, 27.9, 1.5, 2.7, 'Lav'],
    [26.3, 27.9, -0.9, 0.9, 'Galley'],
    [43.7, 44.6, -2.7, -1.6, 'Lav'],
    [43.7, 44.6, 1.6, 2.7, 'Lav'],
    [57.3, 58.4, -2.4, -0.6, 'Galley'],
    [57.3, 58.4, 0.6, 2.4, 'Galley'],
  ],
};
