import * as THREE from 'three';
import {
  FLOOR_Y, INNER, WALL, CABIN_Z0, CABIN_Z1, LAYOUT, section, cabinHalfWidth,
} from './dims.js';
import { box, merge } from './geom.js';

/**
 * Cabin classes of the ANA Boeing 777-300ER (77W).
 * `code` is the booking-cabin code; `accent` is only used by the UI.
 */
export const CLASSES = {
  First: { code: 'F', label: 'First', layout: '1-2-1 closed suites', accent: '#8a6a4d' },
  Business: { code: 'J', label: 'Business', layout: '1-2-1 staggered', accent: '#4d5560' },
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

function businessSeatGeometry() {
  return merge([
    box(0.46, 0.3, 0.55, 0, 0.15, 0.02, C.bizDark),
    box(0.54, 0.14, 0.6, 0, 0.42, -0.02, C.biz),
    box(0.54, 0.88, 0.14, 0, 0.9, 0.3, C.biz, 0.16),
    box(0.4, 0.18, 0.12, 0, 1.3, 0.37, C.cover, 0.16),
    box(0.08, 0.12, 0.55, -0.31, 0.6, 0.02, C.bizDark),
  ]);
}

/** Business pod furniture around a seat: side console on +x, ottoman, screen. */
function businessPodGeometry(L) {
  const front = -L + 0.55;
  return merge([
    box(0.95, 1.12, 0.05, 0.12, 0.56, 0.5, C.bizShell),               // shell behind the seat
    box(0.3, 0.72, 1.3, 0.46, 0.36, -0.25, C.bizShell),               // side console
    box(0.32, 0.025, 1.32, 0.46, 0.735, -0.25, C.bizTop),             // console top
    box(0.04, 0.95, L - 0.05, -0.36, 0.475, (front + 0.5) / 2, C.bizShell), // privacy wall
    box(0.66, 0.78, 0.05, 0.0, 0.39, front, C.bizShell),              // foot well front
    box(0.48, 0.4, 0.42, 0, 0.2, front + 0.27, C.bizDark),            // ottoman
    box(0.44, 0.27, 0.03, 0, 0.98, front + 0.02, C.screen),           // 17-inch screen
  ]);
}

function firstSeatGeometry() {
  const th = 0.16, back = [0, 0.95, 0.28];
  return merge([
    box(0.6, 0.3, 0.6, 0, 0.15, 0, C.firstDark),
    box(0.66, 0.16, 0.64, 0, 0.42, -0.02, C.firstLeather),
    box(0.66, 0.98, 0.16, ...back, C.firstLeather, th),
    box(0.44, 0.2, 0.14, 0, 1.38, 0.36, C.white, th),        // pillow
    box(0.12, 0.14, 0.6, 0.39, 0.6, 0.0, C.firstDark),
    box(0.12, 0.14, 0.6, -0.39, 0.6, 0.0, C.firstDark),
  ]);
}

/** First suite shell: walls, closed sliding door on +x, monitor, ottoman. */
function suiteShellGeometry(L, W, H) {
  const t = 0.05, hl = L / 2, hw = W / 2;
  const doorZ0 = -0.3, doorZ1 = 0.5;
  return merge([
    box(W, H, t, 0, H / 2, -hl, C.shell),                         // forward wall
    box(W, H, t, 0, H / 2, hl, C.shell),                          // aft wall
    box(t, H, L, -hw, H / 2, 0, C.shell),                          // -x wall
    box(t, H, doorZ0 + hl, hw, H / 2, (-hl + doorZ0) / 2, C.shell),
    box(t, H, hl - doorZ1, hw, H / 2, (doorZ1 + hl) / 2, C.shell),
    box(0.03, H - 0.04, doorZ1 - doorZ0, hw + 0.035, H / 2, (doorZ0 + doorZ1) / 2, C.wood), // closed door
    box(W + 0.02, 0.03, 0.08, 0, H + 0.015, -hl, C.trim),         // top trims
    box(W + 0.02, 0.03, 0.08, 0, H + 0.015, hl, C.trim),
    box(0.08, 0.03, L, -hw, H + 0.015, 0, C.trim),
    box(0.08, 0.03, L, hw, H + 0.015, 0, C.trim),
    box(0.72, 0.42, 0.03, 0, 0.98, -hl + 0.04, C.screen),         // 23-inch screen
    box(0.5, 0.42, 0.48, 0, 0.21, -0.52, C.firstDark),            // ottoman / bed extension
    box(0.26, 0.62, 1.35, -hw + 0.16, 0.31, 0.12, C.wood),        // side console
    box(0.28, 0.02, 1.35, -hw + 0.16, 0.63, 0.12, C.trim),
    box(0.36, 0.03, 0.5, -hw + 0.34, 0.72, -0.3, C.wood),         // dining table
  ]);
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
    [10.4, 14.5, 0x5a5048],   // First
    [14.5, 17.6, 0x41474f],   // Business
    [17.6, 21.8, 0x8d9299],
    [21.8, 34.9, 0x41474f],
    [34.9, 37.5, 0x8d9299],
    [37.5, 42.9, 0x41474f],
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
      moodParts.push(box(0.02, 0.02, len, s * 2.07, 1.6, zc, 0xffffff));
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
      furniture.push({ kind: 'suite', x: c.x, z, mirror: c.doorSide < 0 });
      specs.push({
        cabin: 'First', row, letter: c.letter, position: c.position,
        x: c.x, z: z + 0.32, yaw: 0, pitch: F.suiteLength, width: F.suiteWidth, zone: `Suite ${row}${c.letter}`,
      });
    }
  }

  const B = LAYOUT.business;
  B.blocks.forEach((block, bi) => {
    for (const { row, z } of block) {
      const cols = row % 2 ? B.odd : B.even;
      for (const c of cols) {
        furniture.push({ kind: 'pod', x: c.x, z, mirror: c.console < 0 });
        specs.push({
          cabin: 'Business', row, letter: c.letter, position: c.position,
          x: c.x, z, yaw: 0, pitch: B.podLength, width: B.seatWidth,
          zone: ['Business (forward)', 'Business (mid)', 'Business (aft)'][bi],
        });
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
    First: [0.8, 1.4, 0.8], Business: [0.6, 1.4, 0.8], Premium: [0.56, 1.3, 0.75], Economy: [0.457, 1.2, 0.6],
  };
  const fabricMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, map: noiseTexture(0xffffff, 0.12, 128) });
  const leatherMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42 });
  clipMaterials.push(fabricMat, leatherMat);
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });

  for (const cabin of Object.keys(CLASSES)) {
    const list = specs.filter((s) => s.cabin === cabin);
    const mat = cabin === 'First' || cabin === 'Business' ? leatherMat : fabricMat;
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

  // Suite shells and business pods: instanced, mirrored so every First door
  // opens onto an aisle and every Business console sits on the right side.
  const furnMat = vmat({ side: THREE.DoubleSide, roughness: 0.55 });
  for (const [kind, geom] of [
    ['suite', suiteShellGeometry(F.suiteLength, F.suiteWidth, F.wallHeight)],
    ['pod', businessPodGeometry(B.podLength)],
  ]) {
    const list = furniture.filter((f) => f.kind === kind);
    const m = new THREE.InstancedMesh(geom, furnMat, list.length);
    m.name = kind === 'suite' ? 'first-suite-shells' : 'business-pods';
    list.forEach((f, i) => {
      tmpM.compose(new THREE.Vector3(f.x, FLOOR_Y, f.z), new THREE.Quaternion(), new THREE.Vector3(f.mirror ? -1 : 1, 1, 1));
      m.setMatrixAt(i, tmpM);
    });
    m.castShadow = true; m.receiveShadow = true;
    m.computeBoundingSphere();
    group.add(m);
  }

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
