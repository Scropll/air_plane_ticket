import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { buildAircraft, buildGlassRoof } from './aircraft.js';
import { buildCabin, CLASSES } from './cabin.js';
import { CloudSea } from './clouds.js';
import { FLOOR_Y, CABIN_Z0, CABIN_Z1, CUT_HEIGHT, LENGTH } from './dims.js';

// ------------------------------------------------------------------ renderer
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.55;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;
app.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.className = 'labels';
app.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.05, 14000);

// ------------------------------------------------------------------ sky + sun
const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 38), THREE.MathUtils.degToRad(-130));
const sky = new Sky();
sky.scale.setScalar(12000);
const su = sky.material.uniforms;
su.turbidity.value = 1.6;
su.rayleigh.value = 1.1;
su.mieCoefficient.value = 0.003;
su.mieDirectionalG.value = 0.82;
su.sunPosition.value.copy(sunDir);
scene.add(sky);

// image-based lighting from the same sky
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
const envSky = new Sky();
envSky.scale.setScalar(1000);
Object.assign(envSky.material.uniforms.sunPosition.value, sunDir);
for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) envSky.material.uniforms[k].value = su[k].value;
envScene.add(envSky);
// a bright cloud floor in the environment so the belly picks up bounce light
const envFloor = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshBasicMaterial({ color: 0xd8dfe8, side: THREE.DoubleSide }));
envFloor.rotation.x = -Math.PI / 2; envFloor.position.y = -60;
envScene.add(envFloor);
scene.environment = pmrem.fromScene(envScene, 0.02).texture;
scene.environmentIntensity = 0.9;

const sun = new THREE.DirectionalLight(0xfff4e6, 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
const sc = sun.shadow.camera;
sc.left = -42; sc.right = 42; sc.top = 42; sc.bottom = -42; sc.near = 1; sc.far = 260;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.025;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(0xcfe0ff, 0xe9edf2, 0.55));

// ------------------------------------------------------------------ aircraft
const aircraft = new THREE.Group();
aircraft.name = 'aircraft';
scene.add(aircraft);
const airframe = buildAircraft();
const cabin = buildCabin();
aircraft.add(airframe.group, cabin.group);

// cutaway clipping: removes everything above the cut plane between the
// flight-deck bulkhead and the fin root (planes intersect -> clip only the box)
const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e4);
const clipPlanes = [
  cutPlane,
  new THREE.Plane(new THREE.Vector3(0, 0, 1), -CABIN_Z1), // negative (clipped) for z < CABIN_Z1
  new THREE.Plane(new THREE.Vector3(0, 0, -1), CABIN_Z0),  // negative (clipped) for z > CABIN_Z0
];
for (const m of [...airframe.clipMaterials, ...cabin.clipMaterials]) {
  m.clippingPlanes = clipPlanes;
  m.clipIntersection = true;
  m.clipShadows = true;
}

// clear glass roof over the cutaway, shown in the top-down view
const glassRoof = buildGlassRoof(CABIN_Z0, CABIN_Z1, FLOOR_Y + CUT_HEIGHT);
glassRoof.visible = false;
aircraft.add(glassRoof);

const clouds = new CloudSea(scene, sunDir);

// ambient occlusion for the top-down view (contact shadows between seats)
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight);
gtao.normalMaterial.clippingPlanes = clipPlanes;
gtao.normalMaterial.clipIntersection = true;
gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 2, scale: 1.2, samples: 16 });
gtao.blendIntensity = 0.9;
composer.addPass(gtao);
composer.addPass(new OutputPass());

// camera finish for the aerial view: slight lens fringing, vignette, a gentle
// grade (cool shadows, warm highlights) and fine film grain
const photoFinish = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; varying vec2 vUv;
    float hash(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
    void main(){
      vec2 c = vUv - 0.5;
      vec2 aspect = vec2(uRes.x / uRes.y, 1.0);
      float r = length(c * aspect);
      vec2 off = c * 0.0016 * r;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv - off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv + off).b;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(col, col * vec3(0.96, 0.99, 1.05), 1.0 - smoothstep(0.0, 0.5, l));
      col = mix(col, col * vec3(1.03, 1.0, 0.96), smoothstep(0.55, 1.0, l));
      col = mix(vec3(l), col, 1.06);                       // a touch more saturation
      col = col * col * (3.0 - 2.0 * col) * 0.18 + col * 0.82; // soft S-curve
      col *= mix(1.0, smoothstep(1.05, 0.25, r), 0.28);   // vignette
      float g = hash(vUv * uRes + fract(uTime) * 91.7) - 0.5;
      col += g * 0.028 * (1.0 - l * 0.6);                  // grain, stronger in shadows
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`,
});
composer.addPass(photoFinish);
photoFinish.uniforms.uRes.value.set(window.innerWidth * renderer.getPixelRatio(), window.innerHeight * renderer.getPixelRatio());

// ------------------------------------------------------------------ labels
const labelObjects = [];
for (const l of cabin.labels) {
  const el = document.createElement('div');
  el.className = 'zone-label' + (l.small ? ' small' : '');
  if (l.cls) el.style.setProperty('--accent', CLASSES[l.cls].accent);
  el.textContent = l.text;
  const o = new CSS2DObject(el);
  o.position.copy(l.pos);
  o.visible = false;
  aircraft.add(o);
  labelObjects.push(o);
}

// ------------------------------------------------------------------ controls
const controls = new OrbitControls(camera, labelRenderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxDistance = 600;

const VIEWS = {
  exterior: { pos: new THREE.Vector3(-58, 9, -30), target: new THREE.Vector3(0, -0.5, 33) },
  cabin: { pos: new THREE.Vector3(17, 21, -2), target: new THREE.Vector3(0, FLOOR_Y, 24) },
};
camera.position.copy(VIEWS.exterior.pos);
controls.target.copy(VIEWS.exterior.target);

let mode = 'exterior';
let cutTarget = 1e4;      // where the cut plane is heading
let cutCurrent = 40;      // animated value (absolute y)
let swayAmt = 1;          // aircraft sway, faded out while inside
let tween = null;

function flyTo(pos, target, dur = 1.4) {
  tween = {
    p0: camera.position.clone(), t0: controls.target.clone(),
    p1: pos.clone(), t1: target.clone(), t: 0, dur,
  };
}

function setMode(m, opts = {}) {
  mode = m;
  document.body.dataset.mode = m;
  for (const b of document.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed', String(b.dataset.view === m));
  const cut = m === 'cabin' || m === 'photo';
  cutTarget = cut ? FLOOR_Y + CUT_HEIGHT : 1e4;
  if (cut && cutCurrent > 30) cutCurrent = 8;
  if (m === 'photo') cutCurrent = cutTarget;
  glassRoof.visible = m === 'photo';
  clouds.setAerial(m === 'photo');
  camera.near = m === 'photo' ? 20 : 0.05;
  for (const o of labelObjects) o.visible = m === 'cabin';
  controls.enabled = m !== 'photo';
  camera.up.set(0, 1, 0);
  if (m === 'photo') { tween = null; framePhoto(); }
  controls.minDistance = m === 'seat' ? 0.01 : 4;
  controls.enablePan = m !== 'seat';
  controls.rotateSpeed = m === 'seat' ? -0.35 : 1;
  controls.enableZoom = m !== 'seat';
  camera.fov = m === 'seat' ? 68 : m === 'photo' ? 14 : 42;
  camera.updateProjectionMatrix();
  if (m === 'photo') framePhoto();
  if (!opts.keepCamera) {
    if (m === 'exterior') flyTo(VIEWS.exterior.pos, VIEWS.exterior.target, 1.8);
    if (m === 'cabin') flyTo(VIEWS.cabin.pos, VIEWS.cabin.target, 1.8);
  }
}

/** Straight-down aerial framing, nose at the top, whole aircraft in frame. */
function framePhoto() {
  const zc = LENGTH / 2;
  const halfLen = LENGTH / 2 + 1.5;
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const dist = halfLen / Math.tan(halfFov);
  camera.up.set(0, 0, -1);
  camera.position.set(0, dist, zc);
  camera.lookAt(0, 0, zc);
  controls.target.set(0, 0, zc);
}

// ------------------------------------------------------------------ seats API
const seats = cabin.seats;
const byId = new Map(seats.map((s) => [s.id, s]));
const WHITE = new THREE.Color(1, 1, 1);
const HILITE = new THREE.Color(1.9, 1.45, 0.55);
const HOVER = new THREE.Color(1.35, 1.35, 1.6);
let selected = null;
let hovered = null;

function paintSeat(seat, color) {
  seat.mesh.setColorAt(seat.instanceId, color);
  seat.mesh.instanceColor.needsUpdate = true;
}

function selectSeat(seat, { focus = true } = {}) {
  if (selected && selected !== seat) paintSeat(selected, WHITE);
  selected = seat;
  if (!seat) { renderInfo(null); return; }
  paintSeat(seat, HILITE);
  renderInfo(seat);
  if (focus) {
    if (mode !== 'cabin') setMode('cabin', { keepCamera: true });
    const t = seat.floor.clone();
    t.y += 0.6;
    const offset = new THREE.Vector3(5.5, 7.5, -6.5);
    if (seat.floor.x > 0.3) offset.x *= 1; else if (seat.floor.x < -0.3) offset.x *= -1;
    flyTo(t.clone().add(offset), t, 1.3);
  }
}

function sitIn(seat) {
  if (!seat) return;
  selectSeat(seat, { focus: false });
  setMode('seat', { keepCamera: true });
  const eye = seat.eye();
  const look = eye.clone().addScaledVector(seat.facing(), 0.05);
  look.y += 0.004; // look very slightly up, over the seat ahead
  flyTo(eye, look, 1.6);
}

function findSeat(query) {
  const q = String(query).trim().toUpperCase().replace(/\s+/g, '');
  return byId.get(q) || null;
}

// public, for the console and for tests
window.cabin = {
  seats,
  findSeat,
  select: (id) => { const s = findSeat(id); if (s) selectSeat(s); return s; },
  sit: (id) => { const s = findSeat(id); if (s) sitIn(s); return s; },
  view: (m) => setMode(m),
  summary: () => Object.fromEntries(Object.keys(CLASSES).map((c) => [c, seats.filter((s) => s.cabin === c).length])),
};

// ------------------------------------------------------------------ UI
const info = document.getElementById('seat-info');
const tooltip = document.getElementById('tooltip');

function describe(seat) {
  const label = CLASSES[seat.cabin].label;
  const p = seat.position === 'sofa' ? 'sofa seat' : `${seat.position} seat`;
  const pos = p[0].toUpperCase() + p.slice(1);
  return { label, pos };
}

function renderInfo(seat) {
  if (!seat) {
    info.hidden = true;
    return;
  }
  const { label, pos } = describe(seat);
  info.hidden = false;
  info.style.setProperty('--accent', CLASSES[seat.cabin].accent);
  info.querySelector('.si-id').textContent = seat.id;
  info.querySelector('.si-class').textContent = label;
  info.querySelector('.si-row').textContent = seat.row;
  info.querySelector('.si-letter').textContent = seat.letter;
  info.querySelector('.si-pos').textContent = pos;
  info.querySelector('.si-zone').textContent = seat.zone;
  info.querySelector('.si-pitch').textContent = seat.cabin === 'First'
    ? `${seat.pitch.toFixed(2)} m suite` : seat.cabin === 'Business' ? `${seat.pitch.toFixed(2)} m flat-bed pod` : `${seat.pitch.toFixed(2)} m pitch`;
  info.querySelector('.si-width').textContent = `${seat.width.toFixed(3)} m`;
  info.querySelector('.si-station').textContent = `${seat.floor.z.toFixed(2)} m from nose`;
  info.querySelector('.si-instance').textContent = `${seat.mesh.name} #${seat.instanceId}`;
}

// legend with live counts
const legend = document.getElementById('legend');
const counts = window.cabin.summary();
for (const [k, v] of Object.entries(CLASSES)) {
  const li = document.createElement('li');
  li.style.setProperty('--accent', v.accent);
  const layout = v.layout;
  li.innerHTML = `<span class="swatch"></span><span class="lg-name">${v.label}</span><span class="lg-meta">${layout}</span><span class="lg-count">${counts[k]}</span>`;
  li.addEventListener('click', () => {
    const first = seats.find((s) => s.cabin === k);
    selectSeat(first);
  });
  legend.appendChild(li);
}
document.getElementById('total').textContent = seats.length;

for (const b of document.querySelectorAll('[data-view]')) {
  b.addEventListener('click', () => {
    if (b.dataset.view === 'seat') sitIn(selected || findSeat('1A'));
    else setMode(b.dataset.view);
  });
}
document.getElementById('sit').addEventListener('click', () => sitIn(selected));
document.getElementById('close-info').addEventListener('click', () => {
  if (selected) paintSeat(selected, WHITE);
  selected = null;
  renderInfo(null);
});

const form = document.getElementById('finder');
const input = document.getElementById('seat-query');
const msg = document.getElementById('finder-msg');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const s = findSeat(input.value);
  if (s) { msg.textContent = ''; selectSeat(s); }
  else msg.textContent = `No seat “${input.value.trim()}”. Try 1A, 7E, 26D or 34K.`;
});

// ------------------------------------------------------------------ picking
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerDown = null;

function pick(ev) {
  if (mode === 'exterior') return null;
  const r = renderer.domElement.getBoundingClientRect();
  pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(cabin.proxies, false);
  for (const h of hits) {
    // honour the cutaway: ignore hits that are above the cut plane
    if (mode === 'cabin' && h.point.y > cutCurrent + 0.6) continue;
    const s = h.object.userData.seats[h.instanceId];
    if (mode === 'seat' && s === selected) continue;
    return s;
  }
  return null;
}

labelRenderer.domElement.addEventListener('pointermove', (ev) => {
  if (ev.pointerType === 'touch') return;
  const s = pick(ev);
  if (hovered && hovered !== selected) paintSeat(hovered, WHITE);
  hovered = s;
  if (s && s !== selected) paintSeat(s, HOVER);
  if (s) {
    const { label, pos } = describe(s);
    tooltip.hidden = false;
    tooltip.style.setProperty('--accent', CLASSES[s.cabin].accent);
    tooltip.innerHTML = `<b>${s.id}</b> ${label} · row ${s.row} · ${s.letter} · ${pos}`;
    const x = Math.min(ev.clientX + 14, window.innerWidth - tooltip.offsetWidth - 8);
    tooltip.style.transform = `translate(${x}px, ${ev.clientY + 16}px)`;
    labelRenderer.domElement.style.cursor = 'pointer';
  } else {
    tooltip.hidden = true;
    labelRenderer.domElement.style.cursor = '';
  }
});
labelRenderer.domElement.addEventListener('pointerdown', (ev) => { pointerDown = [ev.clientX, ev.clientY]; });
labelRenderer.domElement.addEventListener('pointerup', (ev) => {
  if (!pointerDown) return;
  const moved = Math.hypot(ev.clientX - pointerDown[0], ev.clientY - pointerDown[1]);
  pointerDown = null;
  if (moved > 5) return;
  const s = pick(ev);
  if (s) selectSeat(s, { focus: mode === 'cabin' });
});
labelRenderer.domElement.addEventListener('dblclick', (ev) => {
  const s = pick(ev);
  if (s) sitIn(s);
});

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
let elapsed = 0;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  // gentle flight motion outside; perfectly still in the cabin so the
  // cutaway and the seat view stay steady
  swayAmt += ((mode === 'exterior' ? 1 : 0) - swayAmt) * Math.min(1, dt * 2);
  if (mode === 'photo') swayAmt = 0;
  aircraft.rotation.z = Math.sin(elapsed * 0.31) * 0.012 * swayAmt;
  aircraft.rotation.x = Math.sin(elapsed * 0.23 + 1) * 0.006 * swayAmt;
  aircraft.position.y = Math.sin(elapsed * 0.4) * 0.35 * swayAmt;
  const bob = Math.sin(elapsed * 0.17) * 3;

  // cut plane animation
  cutCurrent += (Math.min(cutTarget, 40) - cutCurrent) * Math.min(1, dt * 2.5);
  cutPlane.constant = cutTarget > 1e3 && cutCurrent > 39 ? 1e4 : cutCurrent;

  for (const f of airframe.fans) f.rotation.z += dt * 9;
  for (const l of airframe.lights) {
    if (l.userData.blink === 'strobe') l.visible = (elapsed % 1.2) < 0.06;
    if (l.userData.blink === 'beacon') l.visible = (elapsed % 1.0) < 0.12;
  }

  if (tween) {
    tween.t += dt / tween.dur;
    const k = ease(Math.min(1, tween.t));
    camera.position.lerpVectors(tween.p0, tween.p1, k);
    controls.target.lerpVectors(tween.t0, tween.t1, k);
    if (tween.t >= 1) tween = null;
  }
  if (mode !== 'photo') controls.update();

  // the sun's shadow camera tracks the aircraft
  const c = new THREE.Vector3(0, 0, LENGTH / 2);
  sun.position.copy(c).addScaledVector(sunDir, 120);
  sun.target.position.copy(c);

  clouds.update(dt, camera, bob);
  photoFinish.uniforms.uTime.value = elapsed;
  if (mode === 'photo') composer.render(dt);
  else renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  photoFinish.uniforms.uRes.value.set(window.innerWidth * renderer.getPixelRatio(), window.innerHeight * renderer.getPixelRatio());
  if (mode === 'photo') framePhoto();
});

setMode('exterior', { keepCamera: true });
const deep = new URLSearchParams(location.search);
if (deep.has('clean')) document.body.classList.add('clean');
if (deep.get('view')) setMode(deep.get('view'));
if (deep.get('seat')) {
  const s = findSeat(deep.get('seat'));
  if (s) (deep.get('view') === 'seat' ? sitIn(s) : selectSeat(s));
}
if (deep.get('cam')) {
  const v = deep.get('cam').split(',').map(Number);
  tween = null;
  camera.position.set(v[0], v[1], v[2]);
  controls.target.set(v[3], v[4], v[5]);
}
if (deep.has('instant')) { tween && (tween.t = 1); cutCurrent = cutTarget > 1e3 ? 40 : cutTarget; }
frame();
