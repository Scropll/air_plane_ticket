import * as THREE from 'three';
import {
  FLOOR_Y, INNER, WALL, CABIN_Z0, LAYOUT, section, cabinHalfWidth,
} from './dims.js';
import { box, cyl, merge } from './geom.js';

/**
 * Cabin classes. `code` is the IATA-style cabin code.
 * Colours are fabric/leather tones baked into the seat geometry.
 */
export const CLASSES = {
  Residence: { code: 'R', label: 'The Residence', accent: '#b8955a' },
  First: { code: 'F', label: 'First', accent: '#a0714f' },
  Premium: { code: 'W', label: 'Premium Economy', accent: '#5f7590' },
  Economy: { code: 'Y', label: 'Economy', accent: '#33557f' },
};

/**
 * A single physical seat. Every seat in the aircraft is one of these, and it
 * is also exactly one instance (instanceId) in its class's InstancedMesh.
 */
export class Seat {
  constructor({ cabin, row, letter, position, x, z, yaw, pitch, width, mesh, instanceId, zone }) {
    this.cabin = cabin;            // 'Residence' | 'First' | 'Premium' | 'Economy'
    this.cabinCode = CLASSES[cabin].code;
    this.row = row;
    this.letter = letter;
    this.id = `${row}${letter}`;
    this.position = position;      // 'window' | 'middle' | 'aisle' | 'centre' | 'sofa'
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
    // seated eye point: a little behind the cushion centre, at head height
    const e = this.floor.clone().addScaledVector(this.facing(), -0.14);
    e.y += this.cabin === 'Residence' ? 1.1 : 1.2;
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
  leg: 0x4b4f55, plastic: 0x9aa0a8, screen: 0x0d1116, white: 0xf2f2ee,
  econ: 0x2f4a6d, econDark: 0x243a57,
  prem: 0x55657a, premDark: 0x3e4b5c,
  firstLeather: 0xc9b08f, firstDark: 0x8a6a4d,
  resLeather: 0xeadfca, resWood: 0x6e4a2f, gold: 0xc9a45c,
  shell: 0xebe6dc, shellWood: 0x7a5636,
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
    box(0.36, 0.15, 0.1, 0, 1.12, 0.3, 0xdfe2e6, th),
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
    box(0.46, 0.13, 0.5, 0, 0.45, -0.02, C.prem),
    box(0.44, 0.28, 0.05, 0, 0.3, -0.3, C.premDark, -0.35),   // leg rest
    box(0.46, 0.78, 0.1, ...back, C.premDark, th),
    box(0.44, 0.22, 0.12, 0, 1.24, 0.35, C.white, th),        // winged headrest
    box(0.08, 0.08, 0.46, 0.25, 0.66, 0.02, C.plastic),
    box(0.08, 0.08, 0.46, -0.25, 0.66, 0.02, C.plastic),
    box(0.32, 0.2, 0.012, 0, sy, sz, C.screen, th),
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

/** Sofa seat module for The Residence (origin = centre of the cushion). */
function sofaSeatGeometry() {
  return merge([
    box(0.66, 0.24, 0.66, 0, 0.12, 0, C.resWood),
    box(0.64, 0.2, 0.62, 0, 0.34, -0.02, C.resLeather),
    box(0.64, 0.6, 0.18, 0, 0.72, 0.26, C.resLeather, 0.1),
    box(0.4, 0.3, 0.12, 0, 0.62, 0.15, C.gold, 0.12),        // cushion
  ]);
}

/** First-class suite shell: walls, sliding door on +x, monitor, ottoman. */
function suiteShellGeometry(L, W, H) {
  const t = 0.05, hl = L / 2, hw = W / 2;
  const doorZ0 = -0.35, doorZ1 = 0.55;
  return merge([
    box(W, H, t, 0, H / 2, -hl, C.shell),                         // forward wall
    box(W, H * 0.8, t, 0, (H * 0.8) / 2, hl, C.shell),            // aft wall (lower)
    box(t, H, L, -hw, H / 2, 0, C.shell),                          // -x wall
    box(t, H, doorZ0 + hl, hw, H / 2, (-hl + doorZ0) / 2, C.shell),
    box(t, H, hl - doorZ1, hw, H / 2, (doorZ1 + hl) / 2, C.shell),
    box(0.03, H - 0.04, doorZ1 - doorZ0, hw + 0.035, H / 2, (doorZ0 + doorZ1) / 2, C.shellWood), // closed sliding door
    box(W + 0.02, 0.03, 0.08, 0, H + 0.015, -hl, C.gold),         // top trims
    box(0.08, 0.03, L, -hw, H + 0.015, 0, C.gold),
    box(0.08, 0.03, L, hw, H + 0.015, 0, C.gold),
    box(0.8, 0.48, 0.03, 0, 1.05, -hl + 0.04, C.screen),          // 32-inch screen
    box(0.52, 0.42, 0.5, 0, 0.21, -0.55, C.firstDark),            // ottoman / bed extension
    box(0.3, 0.62, 1.4, -hw + 0.18, 0.31, 0.1, C.shellWood),      // side console
    box(0.32, 0.02, 1.4, -hw + 0.18, 0.63, 0.1, C.gold),
    box(0.4, 0.03, 0.55, -hw + 0.38, 0.72, -0.35, C.shellWood),   // tray table
  ]);
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
  const inner = innerShell(CABIN_Z0, 60.6, 56);
  const innerMat = new THREE.MeshStandardMaterial({ color: 0xf1eee8, roughness: 0.9, side: THREE.DoubleSide });
  clipMaterials.push(innerMat);
  const innerMesh = new THREE.Mesh(inner, innerMat);
  innerMesh.receiveShadow = true;
  group.add(innerMesh);

  // ---------------------------------------------------------------- floors
  const floorZones = [
    [3.0, CABIN_Z0, 0x3a3f46],
    [CABIN_Z0, LAYOUT.residence.z0, 0x8a8f96],
    [LAYOUT.residence.z0, LAYOUT.residence.z1 + 0.1, 0xc9b79c],
    [LAYOUT.residence.z1 + 0.1, 17.3, 0x6d5a4d],
    [17.3, 20.4, 0x8a8f96],
    [20.4, 26.2, 0x4a5568],
    [26.2, 29.4, 0x8a8f96],
    [29.4, 60.4, 0x34465e],
  ];
  for (const [z0, z1, color] of floorZones) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
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
    box(0.5, 0.32, 0.9, 0, 0.5, 3.8, 0x2b2f35), // pedestal
    box(2 * cabinHalfWidth(CABIN_Z0, FLOOR_Y + 1.0), 2.1, 0.08, 0, 1.05, CABIN_Z0 - 0.04, 0xd8d4cc), // bulkhead
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
    const h = 2.05;
    const col = label === 'Lav' ? 0xe3e6ea : label === 'Closet' ? 0xd9d2c5 : 0xd3d8de;
    monParts.push(box(x1 - x0, h, z1 - z0, (x0 + x1) / 2, h / 2, (z0 + z1) / 2, col));
    monParts.push(box(x1 - x0 - 0.1, 0.02, z1 - z0 - 0.1, (x0 + x1) / 2, 1.0, (z0 + z1) / 2, 0xa9b0b8));
    labels.push({ text: label, pos: new THREE.Vector3((x0 + x1) / 2, FLOOR_Y + 1.7, (z0 + z1) / 2), small: true });
  }
  const monuments = new THREE.Mesh(merge(monParts), vmat({ side: THREE.DoubleSide }));
  monuments.position.y = FLOOR_Y;
  monuments.castShadow = true; monuments.receiveShadow = true;
  group.add(monuments);

  // ---------------------------------------------------------------- residence
  const res = buildResidence();
  const resWalls = new THREE.Mesh(res.walls, vmat({ side: THREE.DoubleSide, roughness: 0.6 }));
  const resFurn = new THREE.Mesh(res.furniture, vmat({ roughness: 0.55 }));
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xcfe4ee, roughness: 0.05, transmission: 0.0, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
  });
  clipMaterials.push(glassMat);
  const resGlass = new THREE.Mesh(res.glass, glassMat);
  for (const m of [resWalls, resFurn, resGlass]) {
    m.position.y = FLOOR_Y; m.castShadow = m !== resGlass; m.receiveShadow = true; group.add(m);
  }

  // ---------------------------------------------------------------- bins & mood lighting
  const binParts = [];
  const moodParts = [];
  const binRuns = [[20.45, 26.15], [29.45, 43.6], [46.1, 57.1]];
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
  const moodMat = new THREE.MeshBasicMaterial({ color: 0x9fb8ff, toneMapped: false });
  clipMaterials.push(moodMat);
  const mood = new THREE.Mesh(merge(moodParts), moodMat);
  mood.position.y = FLOOR_Y;
  group.add(mood);

  // ---------------------------------------------------------------- seats
  const seats = [];
  const classMeshes = {};
  const proxies = [];
  const tmpM = new THREE.Matrix4();
  const tmpQ = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);

  const specs = [];
  // The Residence: a two-seat sofa (certified for taxi, take-off and landing)
  specs.push({ cabin: 'Residence', row: 1, letter: 'A', position: 'sofa', x: -2.38, z: 9.12, yaw: -Math.PI / 2, pitch: 5.2, width: 0.66, zone: 'Living room' });
  specs.push({ cabin: 'Residence', row: 1, letter: 'B', position: 'sofa', x: -2.38, z: 9.78, yaw: -Math.PI / 2, pitch: 5.2, width: 0.66, zone: 'Living room' });

  // First: six closed suites, 1-1-1, rows 2 and 3
  const F = LAYOUT.first;
  const suiteCentres = [];
  F.rows.forEach((row, ri) => {
    const zc = F.z0 + F.suiteLength / 2 + ri * (F.suiteLength + 0.05);
    F.letters.forEach((letter, li) => {
      const x = F.x[li];
      suiteCentres.push({ x, z: zc, mirror: li > 0 });
      specs.push({
        cabin: 'First', row, letter, position: li === 1 ? 'centre' : 'window',
        x, z: zc + 0.35, yaw: 0, pitch: F.suiteLength, width: F.suiteWidth, zone: `Suite ${row}${letter}`,
      });
    });
  });

  // Premium 2-3-2 and Economy 3-4-3
  const rowsOf = (groups, seatWidth, aisle) => {
    const total = groups.reduce((s, g) => s + g.length * seatWidth, 0) + aisle * (groups.length - 1);
    let x = -total / 2;
    const out = [];
    groups.forEach((g, gi) => {
      g.forEach((letter, i) => {
        let position = 'middle';
        const outer = gi === 0 || gi === groups.length - 1;
        if (outer && ((gi === 0 && i === 0) || (gi === groups.length - 1 && i === g.length - 1))) position = 'window';
        else if ((gi > 0 && i === 0) || (gi < groups.length - 1 && i === g.length - 1)) position = 'aisle';
        out.push({ letter, x: x + (i + 0.5) * seatWidth, position });
      });
      x += g.length * seatWidth + aisle;
    });
    return out;
  };
  const P = LAYOUT.premium;
  const pCols = rowsOf(P.groups, P.seatWidth, P.aisle);
  P.rows.forEach((row, i) => {
    for (const c of pCols) specs.push({ cabin: 'Premium', row, ...c, z: P.z0 + i * P.pitch, yaw: 0, pitch: P.pitch, width: P.seatWidth, zone: 'Premium Economy' });
  });
  const E = LAYOUT.economy;
  const eCols = rowsOf(E.groups, E.seatWidth, E.aisle);
  E.sections.forEach((sec, si) => {
    for (let row = sec.rows[0]; row <= sec.rows[1]; row++) {
      const z = sec.z0 + (row - sec.rows[0]) * E.pitch;
      for (const c of eCols) specs.push({ cabin: 'Economy', row, ...c, z, yaw: 0, pitch: E.pitch, width: E.seatWidth, zone: si === 0 ? 'Economy (forward)' : 'Economy (aft)' });
    }
  });

  const geoms = {
    Residence: sofaSeatGeometry(),
    First: firstSeatGeometry(),
    Premium: premiumSeatGeometry(),
    Economy: economySeatGeometry(),
  };
  const proxySize = {
    Residence: [0.66, 1.0, 0.7], First: [0.8, 1.4, 0.8], Premium: [0.5, 1.3, 0.75], Economy: [0.457, 1.2, 0.6],
  };
  const seatMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
  const leatherMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42 });
  clipMaterials.push(seatMat, leatherMat);
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });

  for (const cabin of Object.keys(CLASSES)) {
    const list = specs.filter((s) => s.cabin === cabin);
    const mat = cabin === 'Residence' || cabin === 'First' ? leatherMat : seatMat;
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

  // First-class suite shells: one instance per suite, mirrored so every door
  // opens onto an aisle.
  const shellGeom = suiteShellGeometry(F.suiteLength, F.suiteWidth, F.wallHeight);
  const shellMat = vmat({ side: THREE.DoubleSide, roughness: 0.5 });
  const shells = new THREE.InstancedMesh(shellGeom, shellMat, suiteCentres.length);
  shells.name = 'first-suite-shells';
  suiteCentres.forEach((s, i) => {
    tmpM.compose(new THREE.Vector3(s.x, FLOOR_Y, s.z), new THREE.Quaternion(), new THREE.Vector3(s.mirror ? -1 : 1, 1, 1));
    shells.setMatrixAt(i, tmpM);
  });
  shells.castShadow = true; shells.receiveShadow = true;
  shells.computeBoundingSphere();
  group.add(shells);

  // ---------------------------------------------------------------- zone labels
  const zoneLabels = [
    { text: 'The Residence', pos: new THREE.Vector3(-0.4, FLOOR_Y + 2.2, 10.2), cls: 'Residence' },
    { text: 'First · 1-1-1', pos: new THREE.Vector3(0, FLOOR_Y + 2.2, 15.1), cls: 'First' },
    { text: 'Premium · 2-3-2', pos: new THREE.Vector3(0, FLOOR_Y + 2.2, 23.3), cls: 'Premium' },
    { text: 'Economy · 3-4-3', pos: new THREE.Vector3(0, FLOOR_Y + 2.2, 36.5), cls: 'Economy' },
    { text: 'Economy · 3-4-3', pos: new THREE.Vector3(0, FLOOR_Y + 2.2, 51.5), cls: 'Economy' },
    { text: 'Living room', pos: new THREE.Vector3(-1.0, FLOOR_Y + 1.6, 8.6), small: true },
    { text: 'Bedroom', pos: new THREE.Vector3(-1.4, FLOOR_Y + 1.6, 11.6), small: true },
    { text: 'Shower', pos: new THREE.Vector3(1.05, FLOOR_Y + 1.6, 11.6), small: true },
    { text: 'Flight deck', pos: new THREE.Vector3(0, FLOOR_Y + 1.6, 3.6), small: true },
  ];

  return { group, seats, classMeshes, proxies, clipMaterials, labels: [...zoneLabels, ...labels] };
}

// ---------------------------------------------------------------------------

function buildResidence() {
  const R = LAYOUT.residence;
  const H = 2.05, t = 0.06;
  const xL = -2.8, xR = R.aisleX;
  const W = [];
  const wall = (x0, x1, z0, z1, h = H, color = C.shell) =>
    W.push(box(Math.max(t, x1 - x0), h, Math.max(t, z1 - z0), (x0 + x1) / 2, h / 2, (z0 + z1) / 2, color));

  // outer envelope
  wall(xL, xR, R.z0 - t / 2, R.z0 + t / 2);                     // forward wall
  wall(xL, xR, R.z1 - t / 2, R.z1 + t / 2);                     // aft wall
  wall(xR - t / 2, xR + t / 2, R.z0, 8.0);                       // aisle wall, entry door 8.0–8.8
  wall(xR - t / 2, xR + t / 2, 8.8, R.z1);
  W.push(box(0.035, H - 0.06, 0.8, xR + 0.05, H / 2, 8.4, C.resWood)); // entry door (closed)
  // living | bedroom/bath partition, bedroom door x -0.9..-0.2
  wall(xL, -0.9, R.split - t / 2, R.split + t / 2);
  wall(-0.2, xR, R.split - t / 2, R.split + t / 2);
  W.push(box(0.7, H - 0.06, 0.035, -0.55, H / 2, R.split - 0.05, C.resWood));
  // bedroom | shower partition, door z 11.9..12.6
  wall(0.1 - t / 2, 0.1 + t / 2, R.split, 11.9);
  wall(0.1 - t / 2, 0.1 + t / 2, 12.6, R.z1);
  W.push(box(0.035, H - 0.06, 0.7, 0.05, H / 2, 12.25, C.resWood));
  // gold top trims
  W.push(box(xR - xL, 0.03, 0.09, (xL + xR) / 2, H + 0.015, R.z0, C.gold));
  W.push(box(xR - xL, 0.03, 0.09, (xL + xR) / 2, H + 0.015, R.z1, C.gold));
  W.push(box(0.09, 0.03, R.z1 - R.z0, xR, H + 0.015, (R.z0 + R.z1) / 2, C.gold));
  W.push(box(xR - xL, 0.03, 0.09, (xL + xR) / 2, H + 0.015, R.split, C.gold));

  const F = [];
  // living room: sofa frame (seats are instances), coffee table, TV, sideboard
  F.push(box(0.75, 0.62, 0.1, -2.42, 0.31, 8.74, C.resWood));        // sofa arms
  F.push(box(0.75, 0.62, 0.1, -2.42, 0.31, 10.16, C.resWood));
  F.push(box(0.12, 0.85, 1.52, -2.76, 0.42, 9.45, C.resWood));       // sofa back panel
  F.push(box(0.6, 0.04, 0.9, -1.45, 0.42, 9.45, C.resWood));         // coffee table top
  F.push(box(0.5, 0.38, 0.8, -1.45, 0.2, 9.45, C.firstDark));
  F.push(box(0.04, 0.68, 1.15, R.aisleX - 0.06, 1.25, 9.45, C.screen)); // 32" TV
  F.push(box(0.06, 0.74, 1.21, R.aisleX - 0.03, 1.25, 9.45, C.gold));
  F.push(box(2.2, 0.8, 0.34, -0.7, 0.4, R.z0 + 0.2, C.resWood));     // sideboard / bar
  F.push(box(2.2, 0.03, 0.36, -0.7, 0.815, R.z0 + 0.2, C.gold));
  F.push(cyl(0.3, 0.3, 0.42, 0.45, 0.21, 9.9, C.resLeather, 20));    // ottoman
  // bedroom: double bed 2.0 x 1.3
  F.push(box(1.32, 0.34, 2.0, -2.0, 0.17, 11.5, C.resWood));
  F.push(box(1.26, 0.2, 1.94, -2.0, 0.44, 11.52, C.white));
  F.push(box(1.24, 0.06, 1.2, -2.0, 0.56, 11.9, 0xb7a27e));          // throw
  F.push(box(0.5, 0.12, 0.3, -2.3, 0.6, 10.7, C.white));
  F.push(box(0.5, 0.12, 0.3, -1.7, 0.6, 10.7, C.white));
  F.push(box(1.4, 1.0, 0.08, -2.0, 0.6, R.split + 0.08, C.resLeather)); // headboard
  F.push(box(0.4, 0.5, 0.4, -1.05, 0.25, 10.68, C.resWood));          // nightstand
  // shower room
  F.push(box(1.84, 0.012, 2.34, 1.05, 0.006, 11.6, 0x9aa7ad));       // stone floor
  F.push(box(1.0, 0.85, 0.5, 0.75, 0.42, R.split + 0.3, C.resWood)); // vanity
  F.push(box(0.9, 0.04, 0.52, 0.75, 0.86, R.split + 0.3, C.white));
  F.push(box(0.8, 0.6, 0.02, 0.75, 1.35, R.split + 0.06, 0xb9c7cf)); // mirror
  F.push(box(0.4, 0.4, 0.55, 1.65, 0.2, 11.1, C.white));             // WC
  F.push(box(0.85, 0.05, 0.85, 1.5, 0.025, 12.3, 0xd6dde0));          // shower tray

  const G = [
    box(0.02, 2.0, 0.9, 1.06, 1.0, 12.3, 0xffffff),                  // shower glass
    box(0.88, 2.0, 0.02, 1.5, 1.0, 11.84, 0xffffff),
  ];
  return { walls: merge(W), furniture: merge(F), glass: merge(G) };
}

function floorStrip(z0, z1) {
  const pos = [], idx = [];
  const n = Math.max(2, Math.ceil((z1 - z0) / 0.5));
  for (let i = 0; i <= n; i++) {
    const z = z0 + (z1 - z0) * (i / n);
    const hw = cabinHalfWidth(z, FLOOR_Y);
    pos.push(-hw, FLOOR_Y, z, hw, FLOOR_Y, z);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
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
