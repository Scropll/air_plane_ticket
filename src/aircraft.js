import * as THREE from 'three';
import {
  LENGTH, RADIUS, NOSE_LEN, TAIL_START, LAYOUT, FLOOR_Y, WALL,
  section, surfacePoint,
} from './dims.js';
import { loft } from './geom.js';

const DEG = Math.PI / 180;

/**
 * Builds the exterior airframe. Returns { group, clipMaterials, fans, lights }.
 * Plain white livery, no logo, no titles.
 */
export function buildAircraft() {
  const group = new THREE.Group();
  group.name = 'airframe';

  const white = new THREE.MeshPhysicalMaterial({
    color: 0xf5f7f9, roughness: 0.32, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.25,
  });
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0xdfe3e8, roughness: 0.45, metalness: 0.25, side: THREE.DoubleSide,
  });
  const tailMat = white.clone();
  tailMat.side = THREE.DoubleSide;
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x1b2430, roughness: 0.08, metalness: 0.4, clearcoat: 1, side: THREE.DoubleSide,
  });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.5, metalness: 0.6 });
  const nacelleMat = white.clone();
  nacelleMat.side = THREE.DoubleSide;
  const lipMat = new THREE.MeshStandardMaterial({ color: 0xc9cdd2, roughness: 0.25, metalness: 0.9 });

  const clipMaterials = [white, glass];

  // ---------------------------------------------------------------- fuselage
  const zs = [];
  for (let i = 0; i <= 40; i++) zs.push(NOSE_LEN * Math.pow(i / 40, 1.6));
  for (let z = NOSE_LEN + 0.5; z < TAIL_START; z += 0.5) zs.push(z);
  for (let i = 0; i <= 40; i++) zs.push(TAIL_START + (LENGTH - TAIL_START) * (i / 40));
  const fus = ringSurface(zs, 72, (z) => section(z), 0);
  const fuselage = new THREE.Mesh(fus, white);
  fuselage.castShadow = false; // let the sun light the cabin in the cutaway
  fuselage.receiveShadow = false; // interior would otherwise shadow the skin
  fuselage.name = 'fuselage';
  group.add(fuselage);

  // tail cone / APU exhaust
  const apu = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.5, 20, 1, true), darkMetal);
  const tail = section(LENGTH);
  apu.rotation.x = Math.PI / 2;
  apu.position.set(0, tail.yc, LENGTH + 0.2);
  group.add(apu);

  // belly fairing (wing-to-body)
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), white);
  belly.scale.set(2.9, 1.15, 12.5);
  belly.position.set(0, -2.55, 36.5);
  group.add(belly);

  // ---------------------------------------------------------- flight-deck glass
  const cockpitPanes = [
    // [z0, z1, a0, a1] in degrees from the top
    [2.55, 3.45, 9, 36],
    [3.55, 4.35, 42, 63],
    [4.45, 5.05, 46, 64],
  ];
  for (const side of [1, -1]) {
    for (const [z0, z1, a0, a1] of cockpitPanes) {
      const g = surfacePatch(z0, z1, side * a0 * DEG, side * a1 * DEG, 0.012, 6, 6, (u, v) => {
        // taper the top edge to give the windscreen its trapezoid look
        return [u, v];
      });
      group.add(new THREE.Mesh(g, glass));
    }
  }

  // ------------------------------------------------------- passenger windows
  const winShape = roundedRect(0.26, 0.38, 0.11);
  const winGeom = new THREE.ShapeGeometry(winShape, 6);
  const doorZs = LAYOUT.doors.map((d) => d.z);
  const winPositions = [];
  for (let z = 7.6; z < 65.6; z += 0.535) {
    if (doorZs.some((dz) => Math.abs(dz - z) < 0.85)) continue;
    winPositions.push(z);
  }
  const winY = FLOOR_Y + 1.12;
  const windows = new THREE.InstancedMesh(winGeom, glass, winPositions.length * 2);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  let wi = 0;
  for (const z of winPositions) {
    const { r, yc } = section(z);
    const a = Math.acos((winY - yc) / r);
    for (const side of [1, -1]) {
      const [x, y] = surfacePoint(z, side * a, 0.012);
      e.set(0, side * Math.PI / 2, 0);
      // lean with the skin (slightly tilted outward above the waist)
      const tilt = Math.asin((winY - yc) / r);
      e.set(0, side * Math.PI / 2, 0, 'YXZ');
      q.setFromEuler(e);
      const qt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), side * -tilt);
      q.premultiply(qt);
      m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
      windows.setMatrixAt(wi++, m4);
    }
  }
  windows.instanceMatrix.needsUpdate = true;
  windows.name = 'passenger-windows';
  group.add(windows);

  // the same windows seen from inside: daylight panels on the cabin lining
  const skyPane = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.25, 1.45, 1.75), side: THREE.DoubleSide });
  clipMaterials.push(skyPane);
  const innerWin = new THREE.InstancedMesh(winGeom, skyPane, winPositions.length * 2);
  const pv = new THREE.Vector3(), ps = new THREE.Vector3();
  for (let i = 0; i < wi; i++) {
    windows.getMatrixAt(i, m4);
    m4.decompose(pv, q, ps);
    const { yc } = section(pv.z);
    const radial = new THREE.Vector3(pv.x, pv.y - yc, 0).normalize();
    pv.addScaledVector(radial, -(WALL + 0.02)); // just inside the lining
    m4.compose(pv, q, new THREE.Vector3(0.9, 0.9, 1));
    innerWin.setMatrixAt(i, m4);
  }
  innerWin.instanceMatrix.needsUpdate = true;
  innerWin.name = 'cabin-windows';
  group.add(innerWin);

  // ------------------------------------------------------------ door outlines
  const lineMat = new THREE.LineBasicMaterial({ color: 0x8f98a3 });
  clipMaterials.push(lineMat);
  for (const d of LAYOUT.doors) {
    for (const side of [1, -1]) {
      const pts = [];
      const hw = LAYOUT.doorWidth / 2, hh = LAYOUT.doorHeight / 2;
      const yc0 = FLOOR_Y + hh + 0.02;
      for (let i = 0; i < 64; i++) {
        const t = (i / 64) * Math.PI * 2;
        const c = Math.cos(t), s = Math.sin(t);
        const zz = d.z + hw * Math.sign(c) * Math.pow(Math.abs(c), 0.25);
        const yy = yc0 + hh * Math.sign(s) * Math.pow(Math.abs(s), 0.25);
        const { r, yc } = section(zz);
        const a = Math.acos(THREE.MathUtils.clamp((yy - yc) / r, -1, 1));
        pts.push(new THREE.Vector3(...surfacePoint(zz, side * a, 0.008)));
      }
      group.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    }
  }

  // ------------------------------------------------------------------- wings
  const wingRootLE = 29.5;
  const sweep = Math.tan(31.5 * DEG);
  const dihedral = Math.tan(6 * DEG);
  const wingY = -1.95;
  const wingSec = (x, chord, t, extraLE = 0) => ({
    o: new THREE.Vector3(x, wingY + x * dihedral, wingRootLE + x * sweep + extraLE),
    c: chord, t,
    chordDir: new THREE.Vector3(0, 0, 1),
    thickDir: new THREE.Vector3(0, 1, 0),
    camber: 0.025,
  });
  const wingSections = [
    wingSec(0, 13.2, 0.15),
    wingSec(3.0, 12.4, 0.14),
    wingSec(11.0, 7.4, 0.115),
    wingSec(29.0, 2.7, 0.095),
    wingSec(31.4, 1.6, 0.09, 1.4),   // raked tip (64.8 m span)
    wingSec(32.4, 0.7, 0.09, 2.6),
  ];
  const wingGeom = loft(wingSections, 28);
  const wingR = new THREE.Mesh(wingGeom, wingMat);
  wingR.castShadow = true; wingR.receiveShadow = true;
  const wingL = wingR.clone();
  wingL.scale.x = -1;
  group.add(wingR, wingL);

  // flap-track fairings
  const fairingGeom = new THREE.CapsuleGeometry(0.22, 2.6, 4, 10);
  fairingGeom.rotateX(Math.PI / 2);
  for (const side of [1, -1]) {
    for (const x of [6.5, 14.5, 19.5, 24.0]) {
      const chord = x < 11 ? 12.4 + (7.4 - 12.4) * ((x - 3) / 8) : 7.4 + (2.7 - 7.4) * ((x - 11) / 18);
      const f = new THREE.Mesh(fairingGeom, wingMat);
      f.position.set(side * x, wingY + x * dihedral - 0.32, wingRootLE + x * sweep + chord * 0.86);
      f.scale.set(1, 1, 1 + chord * 0.05);
      f.castShadow = true;
      group.add(f);
    }
  }

  // ------------------------------------------------------------------ engines
  const fans = [];
  const engineX = 10.2;
  for (const side of [1, -1]) {
    const eng = buildEngine({ nacelleMat, lipMat, darkMetal, fans });
    const wingLE = wingRootLE + engineX * sweep;
    const wy = wingY + engineX * dihedral;
    eng.position.set(side * engineX, wy - 2.45, wingLE - 4.6);
    group.add(eng);
    // pylon
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.1, 6.6), white);
    pylon.position.set(side * engineX, wy - 0.7, wingLE + 0.4);
    pylon.rotation.x = -4 * DEG;
    pylon.castShadow = true;
    group.add(pylon);
  }

  // ----------------------------------------------------------------- empennage
  // horizontal stabiliser
  const hsRootLE = 64.0, hsY = 0.7;
  const hsSweep = Math.tan(35 * DEG), hsDih = Math.tan(7 * DEG);
  const hs = (x, c, t) => ({
    o: new THREE.Vector3(x, hsY + x * hsDih, hsRootLE + x * hsSweep),
    c, t, chordDir: new THREE.Vector3(0, 0, 1), thickDir: new THREE.Vector3(0, 1, 0), camber: -0.01,
  });
  const hsGeom = loft([hs(0, 6.8, 0.11), hs(2.2, 6.0, 0.11), hs(10.6, 2.3, 0.09), hs(10.9, 1.4, 0.09)], 20);
  const hsR = new THREE.Mesh(hsGeom, tailMat);
  hsR.castShadow = true;
  const hsL = hsR.clone(); hsL.scale.x = -1;
  group.add(hsR, hsL);

  // vertical fin
  const finRootLE = 62.5, finY = 2.5, finSweep = Math.tan(41 * DEG);
  const vf = (h, c, t) => ({
    o: new THREE.Vector3(0, finY + h, finRootLE + h * finSweep),
    c, t, chordDir: new THREE.Vector3(0, 0, 1), thickDir: new THREE.Vector3(1, 0, 0), camber: 0,
  });
  const finGeom = loft([vf(0, 10.2, 0.12), vf(0.6, 9.6, 0.12), vf(9.2, 3.2, 0.1), vf(9.45, 2.6, 0.1)], 20);
  const fin = new THREE.Mesh(finGeom, tailMat);
  fin.castShadow = true;
  group.add(fin);
  // dorsal fillet
  const dorsal = loft([
    { o: new THREE.Vector3(0, 2.75, 60.4), c: 3.4, t: 0.12, chordDir: new THREE.Vector3(0, 0, 1), thickDir: new THREE.Vector3(1, 0, 0), camber: 0 },
    { o: new THREE.Vector3(0, 3.3, 62.0), c: 1.6, t: 0.25, chordDir: new THREE.Vector3(0, 0, 1), thickDir: new THREE.Vector3(1, 0, 0), camber: 0 },
  ], 12);
  group.add(new THREE.Mesh(dorsal, tailMat));

  // ------------------------------------------------------- navigation lights
  const lights = [];
  const mkLight = (color, pos, blink) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8),
      new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    m.position.copy(pos);
    m.userData.blink = blink;
    m.userData.base = new THREE.Color(color);
    group.add(m);
    lights.push(m);
  };
  const tipX = 32.4;
  const tipZ = wingRootLE + tipX * sweep + 2.6;
  const tipY = wingY + tipX * dihedral;
  mkLight(0xff2020, new THREE.Vector3(-tipX, tipY, tipZ + 0.1), null);    // port = red
  mkLight(0x20ff60, new THREE.Vector3(tipX, tipY, tipZ + 0.1), null);     // starboard = green
  mkLight(0xffffff, new THREE.Vector3(-tipX, tipY, tipZ + 0.6), 'strobe');
  mkLight(0xffffff, new THREE.Vector3(tipX, tipY, tipZ + 0.6), 'strobe');
  mkLight(0xff3010, new THREE.Vector3(0, RADIUS + 0.08, 32), 'beacon');
  mkLight(0xff3010, new THREE.Vector3(0, -RADIUS - 0.12, 28), 'beacon');
  mkLight(0xffffff, new THREE.Vector3(0, tail.yc, LENGTH + 0.5), 'strobe');

  group.traverse((o) => { if (o.isMesh) o.receiveShadow = o !== fuselage && o !== belly && o !== windows; });

  return { group, clipMaterials, fans, lights };
}

// ---------------------------------------------------------------------------

function buildEngine({ nacelleMat, lipMat, darkMetal, fans }) {
  const g = new THREE.Group();
  // outer nacelle profile (radius, axial) — inlet at axial = 0, flying toward -z
  const outer = [
    [1.78, 0.0], [1.92, 0.15], [2.0, 0.6], [2.04, 1.6], [2.0, 3.0], [1.88, 4.4], [1.66, 5.6],
  ];
  const lathe = (pts, mat, seg = 64) => {
    const geom = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
    geom.rotateX(Math.PI / 2); // lathe axis y -> z
    const m = new THREE.Mesh(geom, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  g.add(lathe(outer, nacelleMat));
  // polished inlet lip
  g.add(lathe([[1.64, 0.35], [1.66, 0.08], [1.78, 0.0], [1.9, 0.12]], lipMat));
  // inlet barrel (inside)
  const barrel = lathe([[1.64, 0.35], [1.62, 1.25]], darkMetal);
  barrel.material = darkMetal.clone();
  barrel.material.side = THREE.DoubleSide;
  g.add(barrel);
  // core cowl + exhaust
  g.add(lathe([[1.42, 5.2], [1.32, 6.2], [1.1, 7.0]], nacelleMat));
  g.add(lathe([[1.0, 6.9], [0.7, 7.6], [0.0, 8.3]], darkMetal));

  // fan
  const fan = new THREE.Group();
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.9, 32), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.3, metalness: 0.7 }));
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -0.45;
  fan.add(spinner);
  // white spiral mark on the spinner (standard on real engines, not a logo)
  const swirl = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.42), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  swirl.position.set(0.2, 0, -0.52);
  swirl.rotation.set(-Math.PI / 2 + 0.45, 0, 0.4);
  fan.add(swirl);
  const bladeGeom = new THREE.BoxGeometry(0.02, 1.15, 0.28);
  bladeGeom.translate(0, 1.0, 0);
  const blades = new THREE.InstancedMesh(bladeGeom, darkMetal, 18);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    m.makeRotationZ(a).multiply(new THREE.Matrix4().makeRotationY(0.55));
    blades.setMatrixAt(i, m);
  }
  fan.add(blades);
  fan.position.z = 1.2;
  g.add(fan);
  fans.push(fan);
  return g;
}

/** Tube surface sampled along z with a variable cross-section. */
function ringSurface(zs, seg, sectionFn, offset) {
  const pos = [], uv = [], idx = [];
  zs.forEach((z, j) => {
    const { r, yc } = sectionFn(z);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      pos.push((r + offset) * Math.sin(a), yc + (r + offset) * Math.cos(a), z);
      uv.push(i / seg, j / (zs.length - 1));
    }
  });
  const m = seg + 1;
  for (let j = 0; j < zs.length - 1; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * m + i, b = a + 1, c = a + m, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A patch that hugs the skin between two stations and two angles. */
function surfacePatch(z0, z1, a0, a1, offset, nu, nv) {
  const pos = [], idx = [];
  for (let j = 0; j <= nv; j++) {
    const z = z0 + (z1 - z0) * (j / nv);
    for (let i = 0; i <= nu; i++) {
      const a = a0 + (a1 - a0) * (i / nu);
      pos.push(...surfacePoint(z, a, offset));
    }
  }
  const m = nu + 1;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * m + i, b = a + 1, c = a + m, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // make it double sided by duplicating with reversed winding is unnecessary:
  return g;
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/**
 * Clear glass shell that replaces the fuselage crown over the cutaway, so the
 * cabin reads as if seen through a glass roof. It only draws above the cut.
 */
export function buildGlassRoof(z0, z1, cutY) {
  const zs = [];
  for (let z = z0; z <= z1 + 1e-6; z += 0.25) zs.push(z);
  const geom = ringSurface(zs, 96, (z) => section(z), 0.01);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.02,
    transparent: true,
    opacity: 0.035,
    clearcoat: 0.5,
    clearcoatRoughness: 0.02,
    envMapIntensity: 0.6,
    specularIntensity: 1,
    depthWrite: false,
  });
  mat.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -cutY)]; // keep y > cut
  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = 'glass-roof';
  mesh.renderOrder = 5;

  // a slim white sill where the glass meets the cut skin, both sides
  const sillMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.35 });
  const group = new THREE.Group();
  group.add(mesh);
  for (const side of [-1, 1]) {
    const pts = zs.map((z) => {
      const { r, yc } = section(z);
      const dy = cutY - yc;
      const x = dy * dy < r * r ? Math.sqrt(r * r - dy * dy) : 0;
      return new THREE.Vector3(side * (x - 0.07), cutY + 0.01, z);
    });
    const curve = new THREE.CatmullRomCurve3(pts);
    const sill = new THREE.Mesh(new THREE.TubeGeometry(curve, zs.length, 0.06, 6, false), sillMat);
    sill.castShadow = true;
    group.add(sill);
  }
  group.name = 'glass-roof';
  return group;
}
