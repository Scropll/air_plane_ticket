import * as THREE from 'three';

/**
 * An endless sea of clouds. Each layer is a big horizontal plane that follows
 * the camera in x/z, while the noise field it samples scrolls past at the
 * aircraft's ground speed, so the deck never ends and never stops.
 */
const vert = /* glsl */`
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const frag = /* glsl */`
  uniform float uTravel;
  uniform float uScale;
  uniform float uCover;
  uniform float uSoft;
  uniform float uSeed;
  uniform float uBright;
  uniform vec3 uSunDir;
  uniform vec3 uLit;
  uniform vec3 uShade;
  uniform vec3 uHaze;
  uniform float uFadeNear;
  uniform float uFadeFar;
  varying vec3 vWorld;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 6; i++) { v += a * noise(p); p = r * p * 2.03 + 17.1; a *= 0.5; }
    return v;
  }
  float density(vec2 p) {
    vec2 q = vec2(fbm(p + uSeed), fbm(p + vec2(5.2, 1.3) + uSeed));
    float d = fbm(p + 1.6 * q);
    // cumulus-ish billows
    d += 0.18 * (1.0 - abs(noise(p * 6.0) * 2.0 - 1.0));
    return d;
  }

  void main() {
    vec2 world = vec2(vWorld.x, vWorld.z - uTravel);
    vec2 p = world * uScale;
    float d = density(p);
    float cover = smoothstep(uCover, uCover + uSoft, d);
    if (cover < 0.004) discard;

    // cheap self-shadowing: sample density a little toward the sun
    vec2 sp = p + normalize(uSunDir.xz + 1e-4) * 0.06;
    float ds = density(sp);
    float light = clamp(0.62 + (d - ds) * 3.2, 0.0, 1.0);
    light = mix(light, 1.0, smoothstep(uCover + 0.25, uCover + 0.55, d) * 0.35);
    vec3 col = mix(uShade, uLit, light) * uBright;
    // silver lining on thin edges
    col += uLit * (1.0 - cover) * 0.35 * uBright;

    float dist = length(vWorld.xz - cameraPosition.xz);
    float haze = smoothstep(uFadeNear, uFadeFar, dist);
    col = mix(col, uHaze, haze * 0.85);
    float alpha = cover * (1.0 - smoothstep(uFadeFar * 0.9, uFadeFar * 1.35, dist));

    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class CloudSea {
  constructor(scene, sunDir) {
    this.group = new THREE.Group();
    this.group.name = 'cloud-sea';
    this.travel = 0;
    this.speed = 62; // m/s of apparent drift at this scale
    this.layers = [];
    const defs = [
      // y, scale (1/m), cover, softness, seed, brightness
      { y: -420, scale: 1 / 900, cover: 0.38, soft: 0.22, seed: 11.0, bright: 1.55 },
      { y: -300, scale: 1 / 620, cover: 0.46, soft: 0.2, seed: 3.0, bright: 1.75 },
      { y: -205, scale: 1 / 380, cover: 0.55, soft: 0.16, seed: 7.0, bright: 1.95 },
    ];
    for (const d of defs) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTravel: { value: 0 },
          uScale: { value: d.scale },
          uCover: { value: d.cover },
          uSoft: { value: d.soft },
          uSeed: { value: d.seed },
          uBright: { value: d.bright },
          uSunDir: { value: sunDir.clone() },
          uLit: { value: new THREE.Color(1.0, 0.98, 0.95) },
          uShade: { value: new THREE.Color(0.55, 0.62, 0.74) },
          uHaze: { value: new THREE.Color(0.72, 0.8, 0.9) },
          uFadeNear: { value: 1500 },
          uFadeFar: { value: 6000 },
        },
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(18000, 18000, 1, 1), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = d.y;
      mesh.renderOrder = -10 + this.layers.length;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.layers.push({ mesh, mat, y: d.y, parallax: 1 });
    }

    // a solid undercast so no gap ever shows the void
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(18000, 18000),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.62, 0.72), fog: false }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -520;
    floor.renderOrder = -20;
    this.floor = floor;
    this.group.add(floor);

    // wisps that stream past close to the aircraft for a sense of speed
    this.wisps = [];
    const tex = wispTexture();
    for (let i = 0; i < 26; i++) {
      const mat = new THREE.SpriteMaterial({
        map: tex, color: new THREE.Color(1.7, 1.7, 1.75), transparent: true, depthWrite: false, opacity: 0.0, fog: false,
      });
      const s = new THREE.Sprite(mat);
      this.resetWisp(s, true);
      this.group.add(s);
      this.wisps.push(s);
    }
    scene.add(this.group);
  }

  resetWisp(s, initial) {
    const side = Math.random() < 0.5 ? -1 : 1;
    s.position.set(
      side * (40 + Math.random() * 260),
      -30 - Math.random() * 140,
      initial ? -1800 + Math.random() * 2600 : -1800 - Math.random() * 400,
    );
    const size = 60 + Math.random() * 160;
    s.scale.set(size * 1.8, size * 0.7, 1);
    s.userData.maxOpacity = 0.25 + Math.random() * 0.4;
  }

  update(dt, camera, bob) {
    this.travel += this.speed * dt;
    for (const l of this.layers) {
      l.mat.uniforms.uTravel.value = this.travel;
      l.mesh.position.x = camera.position.x;
      l.mesh.position.z = camera.position.z;
      l.mesh.position.y = l.y + bob;
    }
    this.floor.position.x = camera.position.x;
    this.floor.position.z = camera.position.z;
    for (const s of this.wisps) {
      s.position.z += this.speed * 2.2 * dt;
      if (s.position.z > 900) this.resetWisp(s, false);
      // fade in from the distance, fade out once well behind
      const z = s.position.z;
      const f = THREE.MathUtils.smoothstep(z, -1800, -1200) * (1 - THREE.MathUtils.smoothstep(z, 500, 900));
      s.material.opacity = f * s.userData.maxOpacity;
    }
  }
}

function wispTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 40; i++) {
    const x = 40 + Math.random() * 176, y = 40 + Math.random() * 48, r = 18 + Math.random() * 34;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
