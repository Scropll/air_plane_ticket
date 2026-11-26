import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Box with a baked vertex colour, optional x-rotation about its centre. */
export function box(w, h, d, x, y, z, color, rotX = 0, rotY = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotX) g.rotateX(rotX);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return paint(g, color);
}

export function cyl(rt, rb, h, x, y, z, color, seg = 16, rotX = 0) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  if (rotX) g.rotateX(rotX);
  g.translate(x, y, z);
  return paint(g, color);
}

export function paint(g, color) {
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (g.index) g = g.toNonIndexed();
  return g;
}

export function merge(parts) {
  const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

/**
 * Lofts a lifting surface through a list of airfoil sections.
 * section: { o: Vector3 (leading edge), c: chord, t: thickness ratio,
 *            chordDir: Vector3, thickDir: Vector3, camber }
 */
export function loft(sections, n = 24) {
  // cosine-spaced chordwise stations, TE -> upper -> LE -> lower -> TE
  const us = [];
  for (let i = 0; i <= n; i++) us.push(0.5 * (1 - Math.cos((Math.PI * i) / n)));
  const ring = [];
  for (let i = n; i >= 0; i--) ring.push([us[i], 1]);
  for (let i = 1; i <= n; i++) ring.push([us[i], -1]);

  const thick = (u) =>
    5 * (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u ** 3 - 0.1036 * u ** 4);

  const pos = [];
  const P = new THREE.Vector3();
  for (const s of sections) {
    for (const [u, side] of ring) {
      const camber = (s.camber ?? 0.02) * 4 * u * (1 - u);
      const tt = side * thick(u) * s.t * 0.5 + camber;
      P.copy(s.o).addScaledVector(s.chordDir, u * s.c).addScaledVector(s.thickDir, tt * s.c);
      pos.push(P.x, P.y, P.z);
    }
  }
  const m = ring.length;
  const idx = [];
  for (let j = 0; j < sections.length - 1; j++) {
    for (let i = 0; i < m - 1; i++) {
      const a = j * m + i, b = a + 1, c = a + m, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  // tip cap
  const base = (sections.length - 1) * m;
  for (let i = 1; i < n; i++) idx.push(base + i, base + m - 1 - i, base + i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Mirror a non-indexed geometry across x = 0 with the triangle winding put
 * back the right way round. Use this instead of a negative instance scale,
 * which InstancedMesh renders inside-out.
 */
export function mirrorX(geometry) {
  const g = geometry.clone();
  g.scale(-1, 1, 1);
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name];
    const n = a.itemSize;
    for (let t = 0; t < a.count; t += 3) {
      for (let k = 0; k < n; k++) {
        const i1 = (t + 1) * n + k, i2 = (t + 2) * n + k;
        const tmp = a.array[i1]; a.array[i1] = a.array[i2]; a.array[i2] = tmp;
      }
    }
  }
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
