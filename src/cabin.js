import * as THREE from 'three';
import {
  FLOOR_Y, INNER, WALL, CABIN_Z0, CABIN_Z1, LAYOUT, section, cabinHalfWidth,
} from './dims.js';
import { box, merge, mirrorX } from './geom.js';

/**
 * Cabin classes of the ANA Boeing 777-300ER (77W).
 * `code` is the booking-cabin code; `accent` is only used by the UI.
 */
export const CLASSES = {
  First: { code: 'F', label: 'First', layout: '1-2-1 closed suites (THE Suite)', accent: '#5a5d63' },
  Business: { code: 'J', label: 'Business', layout: '1-2-1 THE Room, alternating facing', accent: '#8f8676' },
  Premium: { code: 'W', label: 'Premium Economy', layout: '2-4-2', accent: '#5f7590' },
  Economy: { code: 'Y', label: 'Economy', layout: '3-4-3', accent: '#2f4a6d' },
};

/**
 * A single physical seat. Every seat in the aircraft is one of these, and it
 * is also exactly one instance (instanceId) in its class's InstancedMesh.
 */
export class Seat {
  constructor({ cabin, row, letter, position, x, z, yaw, pitch, width, mesh, instanceId, zone }) {
    this.cabin = cabin;            // 'First' | 'Business' | 'Premium' | 'Economy'
    this.cabinCode = CLASSES[cabin].code;
    this.row = row;
    this.letter = letter;
    this.id = `${row}${letter}`;
    this.position = position;      // 'window' | 'middle' | 'aisle' | 'centre'
    this.zone = zone;
    this.floor = new THREE.Vector3(x, FLOOR_Y, z);
    this.yaw = yaw;                // rotation about +y; 0 faces the nose (-z)
    this.pitch = pitch;            // metres, seat to seat (or suite length)
    this.width = width;            // metres
    this.mesh = mesh;              // the class InstancedMesh
    this.instanceId = instanceId;
  }
  /** Seated eye point (world space, aircraft at rest). */
  eye() {
    const e = this.floor.clone().addScaledVector(this.facing(), -0.14);
    e.y += 1.2;
    return e;
  }
  facing() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }
  toJSON() {
    return {
      id: this.id, cabin: this.cabin, cabinCode: this.cabinCode, row: this.row, letter: this.letter,
      position: this.position, zone: this.zone, pitch: this.pitch, width: this.width,
      station: +this.floor.z.toFixed(3), x: +this.floor.x.toFixed(3), instanceId: this.instanceId,
    };
  }
}

// ---------------------------------------------------------------- palettes
const C = {
  leg: 0x3d4146, plastic: 0x8e949b, screen: 0x0b0e12, white: 0xeeeeea, cover: 0xdcdfe3,
  econ: 0x2b3f60, econDark: 0x223350,
  prem: 0x3f4650, premDark: 0x31363e,
  biz: 0x2f3237, bizDark: 0x24272b, bizShell: 0xe4dfd5, bizTop: 0x6b5a4a,
  firstLeather: 0x5a463a, firstDark: 0x3b2e26,
  shell: 0xe9e4da, wood: 0x6e4f36, trim: 0xb59a6a,
};

// Offsets a part so it sits on the rear face of a reclined backrest.
function onBack(center, dy, dz, theta) {
  return [
    center[1] + dy * Math.cos(theta) - dz * Math.sin(theta),
    center[2] + dy * Math.sin(theta) + dz * Math.cos(theta),
  ];
}

function economySeatGeometry() {
  const th = 0.2, back = [0, 0.86, 0.24];
  const [sy, sz] = onBack(back, 0.12, 0.05, th);
  return merge([
    box(0.04, 0.4, 0.42, 0.17, 0.2, 0.02, C.leg),
    box(0.04, 0.4, 0.42, -0.17, 0.2, 0.02, C.leg),
    box(0.43, 0.12, 0.47, 0, 0.44, -0.02, C.econ),
    box(0.43, 0.68, 0.09, ...back, C.econDark, th),
    box(0.36, 0.15, 0.1, 0, 1.12, 0.3, C.cover, th),
    box(0.05, 0.05, 0.4, 0.215, 0.64, 0.02, C.plastic),
    box(0.05, 0.05, 0.4, -0.215, 0.64, 0.02, C.plastic),
    box(0.25, 0.16, 0.012, 0, sy, sz, C.screen, th),
  ]);
}

function premiumSeatGeometry() {
  const th = 0.22, back = [0, 0.9, 0.27];
  const [sy, sz] = onBack(back, 0.14, 0.055, th);
  return merge([
    box(0.06, 0.38, 0.46, 0.19, 0.19, 0.03, C.leg),
    box(0.06, 0.38, 0.46, -0.19, 0.19, 0.03, C.leg),
    box(0.48, 0.13, 0.5, 0, 0.45, -0.02, C.prem),
    box(0.46, 0.28, 0.05, 0, 0.3, -0.3, C.premDark, -0.35),   // leg rest
    box(0.48, 0.8, 0.1, ...back, C.premDark, th),
    box(0.42, 0.2, 0.12, 0, 1.25, 0.35, C.cover, th),         // winged headrest
    box(0.08, 0.08, 0.48, 0.27, 0.66, 0.02, C.plastic),
    box(0.08, 0.08, 0.48, -0.27, 0.66, 0.02, C.plastic),
    box(0.3, 0.19, 0.012, 0, sy, sz, C.screen, th),
  ]);
}

// ANA Business "THE Room": wide charcoal bench, grey frame, beige wood-grain panels.
const BR = {
  fabric: 0x2a2a2d, base: 0x222326, flap: 0x5c5f64, pillow: 0x2b3170,
  frame: 0x76797f, frameDark: 0xa4a7ac, beige: 0xd8cebb, woodTop: 0xc4baa8,
  screen: 0x2f55a8, dark: 0x16171a,
};

/** THE Room seat: a wide bench (origin = cushion centre, faces -z). */
function businessSeatGeometry() {
  return merge([
    box(0.66, 0.28, 0.58, 0, 0.14, 0, BR.base),
    box(0.72, 0.15, 0.64, 0, 0.365, 0, BR.fabric),
    box(0.72, 0.82, 0.13, 0, 0.86, 0.3, BR.fabric, 0.08),
    box(0.4, 0.2, 0.04, 0.06, 1.1, 0.235, BR.flap, 0.08),      // grey headrest flap
    box(0.3, 0.22, 0.11, -0.18, 0.56, 0.18, BR.pillow, 0.35),  // navy cushion
  ]);
}

/**
 * THE Room suite furniture, relative to the seat (faces -z). The footwell,
 * ottoman and screen take the -x half ahead of the seat, leaving the +x half
 * free for the facing suite's footwell; the console sits on +x by the seat.
 */
function businessPodGeometry(W) {
  const hw = W / 2;
  return merge([
    box(W - 0.04, 1.15, 0.07, 0, 0.575, 0.5, BR.frame),               // shell behind the seat
    box(W, 0.05, 0.11, 0, 1.175, 0.5, BR.frameDark),                  // top rail
    box(0.07, 1.15, 0.3, -hw + 0.06, 0.575, 0.34, BR.frame),          // wings either side of the back
    box(0.07, 1.15, 0.3, hw - 0.06, 0.575, 0.34, BR.frame),
    box(0.28, 0.68, 0.82, hw - 0.17, 0.34, -0.21, BR.frame),          // console
    box(0.3, 0.02, 0.84, hw - 0.17, 0.69, -0.21, BR.woodTop),         // wood-grain top
    box(0.12, 0.012, 0.16, hw - 0.17, 0.705, 0.05, BR.dark),          // controls
    box(0.56, 0.42, 0.6, -hw / 2, 0.21, -1.05, BR.fabric),            // ottoman (bed extension)
    box(0.6, 1.15, 0.06, -hw / 2, 0.575, -1.42, BR.frame),            // screen wall
    box(0.56, 0.38, 0.015, -hw / 2, 0.98, -1.385, BR.dark),
    box(0.5, 0.3, 0.012, -hw / 2, 0.98, -1.375, BR.screen),           // 24-inch screen
    box(0.56, 0.3, 0.015, -hw / 2, 0.6, -1.385, BR.beige),            // beige panel below
  ]);
}

/** A run of suite wall: beige wood-grain panel, grey cap and base. */
function suiteWall(x, z0, z1, h) {
  const len = z1 - z0, zc = (z0 + z1) / 2;
  return [
    box(0.05, h - 0.1, len, x, (h - 0.1) / 2 + 0.06, zc, BR.beige),
    box(0.08, 0.05, len, x, h - 0.02, zc, BR.frameDark),
    box(0.07, 0.06, len, x, 0.03, zc, BR.frame),
  ];
}

// ANA First "THE Suite": charcoal fabric, dark wood, ribbed charcoal walls.
const FS = {
  fabric: 0x2c2c2f, base: 0x232427, pad: 0x4a4c50, bolster: 0x26282b, pillow: 0x2b3170,
  wall: 0x25262a, rib: 0x1c1d20, cap: 0x2d2f33, door: 0x2a2c30, wood: 0x3a2f28,
  frame: 0x17181a, screen: 0x2f55a8, light: 0xf3f1ea, console: 0x34363a, display: 0x0d1a2e,
};

/** The First seat itself (origin = cushion centre, faces -z). */
function firstSeatGeometry() {
  return merge([
    box(0.68, 0.3, 0.56, 0, 0.15, 0, FS.base),
    box(0.72, 0.15, 0.6, 0, 0.375, 0, FS.fabric),
    box(0.72, 0.84, 0.14, 0, 0.87, 0.26, FS.fabric, 0.08),     // tall upright back
    box(0.46, 0.22, 0.06, 0, 1.12, 0.2, FS.pad, 0.08),          // grey headrest pad
  ]);
}

/**
 * THE Suite shell (origin = suite centre, door on +x, window/console on -x):
 * ribbed charcoal walls with a rounded top rail and a light strip at the base,
 * a 43-inch screen in a dark-wood surround on the forward wall, an ottoman
 * under it that completes the bed, a window-side console and a sliding door.
 */
function suiteShellGeometry(L, W, H, { windowSide = false, seatZ = 0.6, seatX = 0.06 } = {}) {
  const t = 0.06, hl = L / 2, hw = W / 2;
  const doorZ0 = -0.35, doorZ1 = 0.45;
  const P = [
    box(W, H, t, 0, H / 2, -hl, FS.wall),                                    // forward wall
    box(W, H, t, 0, H / 2, hl, FS.wall),                                     // aft wall
    // the window suites are open over the console to the cabin windows;
    // the centre pair share a full-height divider
    windowSide ? box(t, 0.72, L, -hw, 0.36, 0, FS.wall) : box(t, H, L, -hw, H / 2, 0, FS.wall),
    box(0.1, 0.64, 0.6, seatX + 0.41, 0.32, seatZ, FS.bolster),              // door-side seat bolster
    box(0.34, 0.22, 0.12, seatX - 0.16, 0.58, seatZ + 0.16, FS.pillow, 0.35), // navy cushion
    box(t, H, doorZ0 + hl, hw, H / 2, (-hl + doorZ0) / 2, FS.wall),          // aisle wall, fwd of door
    box(t, H, hl - doorZ1, hw, H / 2, (doorZ1 + hl) / 2, FS.wall),           // aisle wall, aft of door
    box(0.035, H - 0.06, doorZ1 - doorZ0, hw + 0.04, H / 2, (doorZ0 + doorZ1) / 2, FS.door), // sliding door (closed)
    // rounded top rail
    box(W + 0.08, 0.06, 0.1, 0, H + 0.03, -hl, FS.cap),
    box(W + 0.08, 0.06, 0.1, 0, H + 0.03, hl, FS.cap),
    windowSide ? box(0.1, 0.04, L, -hw, 0.74, 0, FS.cap) : box(0.1, 0.06, L, -hw, H + 0.03, 0, FS.cap),
    box(0.1, 0.06, L, hw, H + 0.03, 0, FS.cap),
    // light strip along the base, outside
    box(0.012, 0.015, L - 0.1, hw + 0.04, 0.06, 0, FS.light),
    box(0.012, 0.015, L - 0.1, -hw - 0.04, 0.06, 0, FS.light),
    box(W - 0.1, 0.015, 0.012, 0, 0.06, hl + 0.04, FS.light),
    // dark-wood surround and the screen on the forward wall
    box(W - 0.14, H - 0.2, 0.02, 0, (H - 0.2) / 2 + 0.05, -hl + 0.04, FS.wood),
    box(0.92, 0.56, 0.04, 0.02, 0.97, -hl + 0.07, FS.frame),
    box(0.86, 0.5, 0.012, 0.02, 0.97, -hl + 0.095, FS.screen),
    // ottoman (forms the bed with the seat)
    box(0.72, 0.44, 0.5, 0.06, 0.22, -hl + 0.32, FS.fabric),
    box(0.74, 0.03, 0.52, 0.06, 0.455, -hl + 0.32, FS.base),
    // window-side console with controls
    box(0.2, 0.7, L - 0.1, -hw + 0.13, 0.35, 0, FS.console),
    box(0.22, 0.02, L - 0.1, -hw + 0.13, 0.71, 0, FS.cap),
    box(0.1, 0.012, 0.18, -hw + 0.13, 0.725, 0.12, FS.frame),
    box(0.08, 0.012, 0.08, -hw + 0.13, 0.725, -0.12, FS.display),
  ];
  // vertical ribs on the aisle face and the aft face
  const ribH = H - 0.25;
  for (let z = -hl + 0.06; z < hl - 0.04; z += 0.105) {
    P.push(box(0.02, ribH, 0.035, hw + 0.07, ribH / 2 + 0.1, z, FS.rib));
  }
  for (let x = -hw + 0.06; x < hw - 0.04; x += 0.105) {
    P.push(box(0.035, ribH, 0.02, x, ribH / 2 + 0.1, hl + 0.045, FS.rib));
  }
  return merge(P);
}

// ---------------------------------------------------------------- textures
function noiseTexture(base, amp, scale = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = scale;
  const g = c.getContext('2d');
  const img = g.createImageData(scale, scale);
  const b = new THREE.Color(base);
  for (let i = 0; i < scale * scale; i++) {
    const n = (Math.random() - 0.5) * amp + Math.sin(i * 0.7) * amp * 0.08;
    img.data[i * 4] = Math.max(0, Math.min(255, b.r * 255 * (1 + n)));
    img.data[i * 4 + 1] = Math.max(0, Math.min(255, b.g * 255 * (1 + n)));
    img.data[i * 4 + 2] = Math.max(0, Math.min(255, b.b * 255 * (1 + n)));
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ---------------------------------------------------------------------------

export function buildCabin() {
  const group = new THREE.Group();
  group.name = 'cabin';
  const clipMaterials = [];
  const vmat = (opts = {}) => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.0, ...opts });
    clipMaterials.push(m);
    return m;
  };

  // ---------------------------------------------------------------- sidewall
  const innerMat = new THREE.MeshStandardMaterial({ color: 0xefece6, roughness: 0.9, side: THREE.DoubleSide });
  clipMaterials.push(innerMat);
  const innerMesh = new THREE.Mesh(innerShell(CABIN_Z0, CABIN_Z1, 56), innerMat);
  innerMesh.receiveShadow = true;
  group.add(innerMesh);
  // aft pressure bulkhead
  const aft = section(CABIN_Z1);
  const bulk = new THREE.Mesh(new THREE.CircleGeometry(aft.r - WALL, 48), innerMat);
  bulk.position.set(0, aft.yc, CABIN_Z1);
  group.add(bulk);

  // ---------------------------------------------------------------- floors
  const carpet = noiseTexture(0xffffff, 0.22);
  const floorZones = [
    [3.0, CABIN_Z0, 0x30343a],
    [CABIN_Z0, 10.4, 0x8d9299],
    [10.4, 14.5, 0x34312e],   // First: charcoal speckled carpet
    [14.5, 17.6, 0x3a3532],   // Business
    [17.6, 21.8, 0x8d9299],
    [21.8, 34.9, 0x3a3532],
    [34.9, 37.5, 0x8d9299],
    [37.5, 42.9, 0x3a3532],
    [42.9, 46.6, 0x3f4a5a],   // Premium
    [46.6, 50.0, 0x8d9299],
    [50.0, CABIN_Z1, 0x354562], // Economy
  ];
  for (const [z0, z1, color] of floorZones) {
    const m = new THREE.MeshStandardMaterial({ color, map: carpet, roughness: 0.97 });
    clipMaterials.push(m);
    const f = new THREE.Mesh(floorStrip(z0, z1), m);
    f.receiveShadow = true;
    f.castShadow = true; // keeps cabin shadows off the belly
    group.add(f);
  }

  // ---------------------------------------------------------------- flight deck
  const panelW = 2 * cabinHalfWidth(3.2, FLOOR_Y + 1.0) - 0.15;
  const fdParts = [
    box(panelW, 0.95, 0.5, 0, 0.47, 3.15, 0x2b2f35),
    box(panelW - 0.2, 0.06, 0.55, 0, 1.0, 3.2, 0x1a1d21),
    box(0.5, 0.32, 0.9, 0, 0.5, 3.8, 0x2b2f35),
    box(2 * cabinHalfWidth(CABIN_Z0, FLOOR_Y + 1.0), 2.1, 0.08, 0, 1.05, CABIN_Z0 - 0.04, 0xd8d4cc),
  ];
  for (const x of [-0.6, 0.6]) {
    fdParts.push(box(0.5, 0.5, 0.55, x, 0.25, 4.25, 0x30343a));
    fdParts.push(box(0.5, 0.75, 0.12, x, 0.85, 4.55, 0x30343a, 0.15));
  }
  const fd = new THREE.Mesh(merge(fdParts), vmat({ side: THREE.DoubleSide }));
  fd.position.y = FLOOR_Y;
  fd.castShadow = true; fd.receiveShadow = true;
  group.add(fd);

  // ---------------------------------------------------------------- monuments
  const monParts = [];
  const labels = [];
  for (const [z0, z1, x0, x1, label] of LAYOUT.monuments) {
    const h = label === 'Bar' ? 1.1 : 2.05;
    const col = label === 'Lav' ? 0xe3e6ea : label === 'Closet' ? 0xd9d2c5 : label === 'Bar' ? 0x8a6a4d : 0xd3d8de;
    monParts.push(box(x1 - x0, h, z1 - z0, (x0 + x1) / 2, h / 2, (z0 + z1) / 2, col));
    if (label === 'Bar') monParts.push(box(x1 - x0 + 0.04, 0.03, z1 - z0 + 0.04, (x0 + x1) / 2, h + 0.015, (z0 + z1) / 2, C.trim));
    else if (label === 'Lav') {
      // basin + WC seen from above
      monParts.push(box(0.36, 0.05, 0.3, (x0 + x1) / 2, 1.0, z0 + 0.3, 0xf4f4f2));
      monParts.push(box(0.36, 0.42, 0.5, (x0 + x1) / 2, 0.21, z1 - 0.4, 0xf4f4f2));
    } else monParts.push(box(x1 - x0 - 0.1, 0.02, z1 - z0 - 0.1, (x0 + x1) / 2, 1.0, (z0 + z1) / 2, 0xa9b0b8));
    labels.push({ text: label, pos: new THREE.Vector3((x0 + x1) / 2, FLOOR_Y + 1.7, (z0 + z1) / 2), small: true });
  }
  const monuments = new THREE.Mesh(merge(monParts), vmat({ side: THREE.DoubleSide }));
  monuments.position.y = FLOOR_Y;
  monuments.castShadow = true; monuments.receiveShadow = true;
  group.add(monuments);

  // ---------------------------------------------------------------- bins & mood lighting
  const binParts = [];
  const moodParts = [];
  const binRuns = [[14.5, 17.6], [21.8, 34.8], [37.5, 46.5], [50.1, 60.6]];
  for (const [z0, z1] of binRuns) {
    const len = z1 - z0, zc = (z0 + z1) / 2;
    for (const s of [-1, 1]) {
      binParts.push(box(0.6, 0.4, len, s * 2.38, 1.82, zc, 0xeef0f2));
      moodParts.push(box(0.02, 0.02, len, s * 2.07, 1.66, zc, 0xffffff));
    }
    binParts.push(box(1.7, 0.32, len, 0, 1.98, zc, 0xeef0f2));
    for (const s of [-1, 1]) moodParts.push(box(0.02, 0.02, len, s * 0.86, 1.8, zc, 0xffffff));
  }
  const bins = new THREE.Mesh(merge(binParts), vmat({ side: THREE.DoubleSide, roughness: 0.6 }));
  bins.position.y = FLOOR_Y;
  bins.castShadow = true;
  group.add(bins);
  const moodMat = new THREE.MeshBasicMaterial({ color: 0xa9c0ff, toneMapped: false });
  clipMaterials.push(moodMat);
  const mood = new THREE.Mesh(merge(moodParts), moodMat);
  mood.position.y = FLOOR_Y;
  group.add(mood);

  // ---------------------------------------------------------------- seat specs
  const specs = [];
  const furniture = []; // { geom: 'suite' | 'pod', x, z, mirror }

  const F = LAYOUT.first;
  for (const { row, z } of F.rows) {
    for (const c of F.cols) {
      furniture.push({ kind: c.position === 'window' ? 'suiteWin' : 'suiteMid', x: c.x, z, mirror: c.doorSide < 0 });
      specs.push({
        cabin: 'First', row, letter: c.letter, position: c.position,
        x: c.x + 0.06 * c.doorSide, z: z + 0.6, yaw: 0, pitch: F.suiteLength, width: F.suiteWidth, zone: `Suite ${row}${c.letter}`,
      });
    }
  }

  const B = LAYOUT.business;
  const bizWalls = [];
  B.blocks.forEach((block, bi) => {
    for (const col of B.columns) {
      let zMin = Infinity, zMax = -Infinity;
      for (const { row, z } of block) {
        const aft = row % 2 === 1;              // odd rows face the tail
        const yaw = aft ? Math.PI : 0;
        const dir = aft ? -1 : 1;               // seat sits this way from the suite centre
        const seatZ = z + 0.41 * dir;
        const side = col.mirror ? -1 : 1;       // local +x maps to world side * dir
        const seatX = col.x + side * dir * -0.1;
        furniture.push({ kind: 'pod', x: col.x, z: seatZ, yaw, mirror: col.mirror });
        specs.push({
          cabin: 'Business', row, letter: aft ? col.odd : col.even, position: col.position,
          x: seatX, z: seatZ, yaw, pitch: B.podLength, width: B.seatWidth,
          zone: `${['Business (forward)', 'Business (mid)', 'Business (aft)'][bi]}, ${aft ? 'rear' : 'forward'}-facing`,
        });
        zMin = Math.min(zMin, seatZ + 0.55 * dir, seatZ - 1.45 * dir);
        zMax = Math.max(zMax, seatZ + 0.55 * dir, seatZ - 1.45 * dir);
      }
      // walls along both sides of the column; lower on the window side
      const hw = B.columnWidth / 2;
      for (const sx of [-1, 1]) {
        const x = col.x + sx * hw;
        const windowSide = col.kind === 'win' && Math.sign(col.x) === sx;
        const centreDivider = col.kind === 'mid' && Math.sign(col.x) === -sx;
        if (centreDivider && col.x > 0) continue; // one shared divider for the centre pair
        bizWalls.push(...suiteWall(x, zMin, zMax, windowSide ? 0.78 : centreDivider ? 1.25 : 1.15));
      }
    }
  });

  const rowsOf = (groups, seatWidth, aisle) => {
    const total = groups.reduce((s, g) => s + g.length * seatWidth, 0) + aisle * (groups.length - 1);
    let x = -total / 2;
    const out = [];
    groups.forEach((g, gi) => {
      g.forEach((letter, i) => {
        let position = 'middle';
        if ((gi === 0 && i === 0) || (gi === groups.length - 1 && i === g.length - 1)) position = 'window';
        else if ((gi > 0 && i === 0) || (gi < groups.length - 1 && i === g.length - 1)) position = 'aisle';
        out.push({ letter, x: x + (i + 0.5) * seatWidth, position });
      });
      x += g.length * seatWidth + aisle;
    });
    return out;
  };

  const P = LAYOUT.premium;
  const pCols = rowsOf(P.groups, P.seatWidth, P.aisle);
  for (const { row, z } of P.rows) {
    for (const c of pCols) specs.push({ cabin: 'Premium', row, ...c, z, yaw: 0, pitch: 1.0, width: P.seatWidth, zone: 'Premium Economy' });
  }

  const E = LAYOUT.economy;
  const eCols = rowsOf(E.groups, E.seatWidth, E.aisle);
  const at = (L) => eCols.find((c) => c.letter === L);
  for (const { row, z } of E.rows) {
    let cols;
    if (row <= 38) cols = eCols;
    else {
      // the fuselage tapers: the outer seats drop and the pairs re-letter
      const centre = eCols.filter((c) => 'DEFG'.includes(c.letter));
      const left = [{ ...at('B'), letter: 'A', position: 'window' }, { ...at('C'), letter: 'C', position: 'aisle' }];
      const right = [{ ...at('H'), letter: 'H', position: 'aisle' }, { ...at('J'), letter: 'K', position: 'window' }];
      cols = row <= 41 ? [...left, ...centre, ...right] : left;
    }
    for (const c of cols) {
      specs.push({ cabin: 'Economy', row, ...c, z, yaw: 0, pitch: E.pitch, width: E.seatWidth, zone: row <= 38 ? 'Economy' : 'Economy (aft taper)' });
    }
  }

  // ---------------------------------------------------------------- seat instances
  const seats = [];
  const classMeshes = {};
  const proxies = [];
  const tmpM = new THREE.Matrix4();
  const tmpQ = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);

  const geoms = {
    First: firstSeatGeometry(),
    Business: businessSeatGeometry(),
    Premium: premiumSeatGeometry(),
    Economy: economySeatGeometry(),
  };
  const proxySize = {
    First: [0.8, 1.4, 0.8], Business: [0.75, 1.4, 0.8], Premium: [0.56, 1.3, 0.75], Economy: [0.457, 1.2, 0.6],
  };
  const fabricMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, map: noiseTexture(0xffffff, 0.12, 128) });
  const leatherMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42 });
  clipMaterials.push(fabricMat, leatherMat);
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });

  for (const cabin of Object.keys(CLASSES)) {
    const list = specs.filter((s) => s.cabin === cabin);
    const mat = fabricMat;
    const mesh = new THREE.InstancedMesh(geoms[cabin], mat, list.length);
    mesh.name = `seats:${cabin}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const [pw, ph, pd] = proxySize[cabin];
    const pg = new THREE.BoxGeometry(pw, ph, pd);
    pg.translate(0, ph / 2, 0.05);
    const proxy = new THREE.InstancedMesh(pg, proxyMat, list.length);
    proxy.name = `pick:${cabin}`;
    mesh.userData.seats = [];
    proxy.userData.seats = mesh.userData.seats;
    list.forEach((s, i) => {
      tmpQ.setFromAxisAngle(up, s.yaw);
      tmpM.compose(new THREE.Vector3(s.x, FLOOR_Y, s.z), tmpQ, one);
      mesh.setMatrixAt(i, tmpM);
      proxy.setMatrixAt(i, tmpM);
      mesh.setColorAt(i, new THREE.Color(1, 1, 1));
      const seat = new Seat({ ...s, mesh, instanceId: i });
      mesh.userData.seats.push(seat);
      seats.push(seat);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    proxy.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    proxy.computeBoundingSphere();
    group.add(mesh, proxy);
    classMeshes[cabin] = mesh;
    proxies.push(proxy);
  }

  // Suite shells and business pods: instanced. Mirrored copies use mirrored
  // geometry so every First door opens onto an aisle and every Business
  // console sits on the correct side.
  const furnMat = vmat({ roughness: 0.55 });
  for (const [kind, geom] of [
    ['suiteWin', suiteShellGeometry(F.suiteLength, F.suiteWidth, F.wallHeight, { windowSide: true })],
    ['suiteMid', suiteShellGeometry(F.suiteLength, F.suiteWidth, F.wallHeight)],
    ['pod', businessPodGeometry(B.columnWidth)],
  ]) {
    for (const mirrored of [false, true]) {
      const list = furniture.filter((f) => f.kind === kind && f.mirror === mirrored);
      if (!list.length) continue;
      const m = new THREE.InstancedMesh(mirrored ? mirrorX(geom) : geom, furnMat, list.length);
      m.name = `${kind === 'pod' ? 'business-pods' : 'first-suite-shells'}${mirrored ? ':mirrored' : ''}`;
      list.forEach((f, i) => {
        tmpQ.setFromAxisAngle(up, f.yaw ?? 0);
        tmpM.compose(new THREE.Vector3(f.x, FLOOR_Y, f.z), tmpQ, one);
        m.setMatrixAt(i, tmpM);
      });
      m.castShadow = true; m.receiveShadow = true;
      m.computeBoundingSphere();
      group.add(m);
    }
  }

  const bizWallMesh = new THREE.Mesh(merge(bizWalls), furnMat);
  bizWallMesh.position.y = FLOOR_Y;
  bizWallMesh.castShadow = true; bizWallMesh.receiveShadow = true;
  bizWallMesh.name = 'business-suite-walls';
  group.add(bizWallMesh);

  // ---------------------------------------------------------------- zone labels
  const zoneLabels = [
    { text: 'First · 1-2-1', pos: new THREE.Vector3(0, FLOOR_Y + 2.2, 12.4), cls: 'First' },
    { text: 'Business · 1-2-1', pos: new THREE.Vector3(0, FLOOR_Y + 2.2, 16.1), cls: 'Business' },
    { text: 'Business · 1-2-1', pos: new THREE.Vector3(0, FLOOR_Y + 2.2, 28.0), cls: 'Business' },
    { text: 'Business · 1-2-1', pos: new THREE.Vector3(0, FLOOR_Y + 2.2, 40.2), cls: 'Business' },
    { text: 'Premium · 2-4-2', pos: new THREE.Vector3(0, FLOOR_Y + 2.2, 44.9), cls: 'Premium' },
    { text: 'Economy · 3-4-3', pos: new THREE.Vector3(0, FLOOR_Y + 2.2, 55.5), cls: 'Economy' },
    { text: 'Flight deck', pos: new THREE.Vector3(0, FLOOR_Y + 1.6, 3.6), small: true },
  ];

  return { group, seats, classMeshes, proxies, clipMaterials, labels: [...zoneLabels, ...labels] };
}

// ---------------------------------------------------------------------------

function floorStrip(z0, z1) {
  const pos = [], idx = [], uv = [];
  const n = Math.max(2, Math.ceil((z1 - z0) / 0.5));
  for (let i = 0; i <= n; i++) {
    const z = z0 + (z1 - z0) * (i / n);
    const hw = cabinHalfWidth(z, FLOOR_Y);
    pos.push(-hw, FLOOR_Y, z, hw, FLOOR_Y, z);
    uv.push(-hw / 1.5, z / 1.5, hw / 1.5, z / 1.5);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // ensure normals point up
  const nrm = g.attributes.normal;
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
  return g;
}

/** Cabin lining above the floor: sidewalls + ceiling. */
function innerShell(z0, z1, seg) {
  const pos = [], idx = [];
  const zs = [];
  for (let z = z0; z <= z1 + 1e-6; z += 0.5) zs.push(z);
  zs.forEach((z) => {
    const { r, yc } = section(z);
    const ri = r - WALL;
    const ca = THREE.MathUtils.clamp((FLOOR_Y - yc) / ri, -1, 1);
    const aMax = Math.acos(ca);
    for (let i = 0; i <= seg; i++) {
      const a = -aMax + (2 * aMax * i) / seg;
      pos.push(ri * Math.sin(a), yc + ri * Math.cos(a), z);
    }
  });
  const m = seg + 1;
  for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < seg; i++) {
    const a = j * m + i, b = a + 1, c = a + m, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export { INNER };
