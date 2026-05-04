import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type UniverseNodeType = 'star' | 'planet' | 'moon' | 'anomaly' | 'signal';

interface UniverseNode {
  id: string;
  name: string;
  type: UniverseNodeType;
  sectorId: string;
  coordinates: { x: number; y: number; z: number };
  discovered: boolean;
  metadata: { color: string; radius: number; description: string };
}

interface BootSequence {
  title: string;
  phrase: string;
  lines: string[];
}

interface RuntimeEvent {
  time: string;
  message: string;
}

const fallbackBoot: BootSequence = {
  title: 'ARK NAVIGATION OS v0.1',
  phrase: 'Darkness is not empty. It is an address space.',
  lines: [
    'BOOT SEQUENCE INITIATED',
    '[CORE] Node runtime online',
    '[NAV]  Sol Sector indexed',
    '[LOG]  Runtime event stream opened',
    'ARK NAVIGATION OS READY'
  ]
};

const fallbackNodes: UniverseNode[] = [
  { id: 'sol_sun', name: 'Sun', type: 'star', sectorId: 'sol_sector', coordinates: { x: 0, y: 0, z: 0 }, discovered: true, metadata: { color: '#ffd27a', radius: 4, description: 'Central star of the Sol system.' } },
  { id: 'sol_earth', name: 'Earth', type: 'planet', sectorId: 'sol_sector', coordinates: { x: 120, y: 0, z: 0 }, discovered: true, metadata: { color: '#3b82f6', radius: 1, description: 'Home world.' } },
  { id: 'sol_moon', name: 'Moon', type: 'moon', sectorId: 'sol_sector', coordinates: { x: 126, y: 1, z: 0 }, discovered: true, metadata: { color: '#d1d5db', radius: 0.3, description: "Earth's natural satellite." } },
  { id: 'sol_mars', name: 'Mars', type: 'planet', sectorId: 'sol_sector', coordinates: { x: 220, y: 0, z: 45 }, discovered: true, metadata: { color: '#ff5533', radius: 0.8, description: 'Red planet in the Sol system.' } },
  { id: 'outer_belt_signal_001', name: 'Outer Belt Signal', type: 'signal', sectorId: 'sol_sector', coordinates: { x: 390, y: -18, z: 130 }, discovered: false, metadata: { color: '#22d3ee', radius: 0.4, description: 'Repeating signal from the outer belt.' } },
  { id: 'anomaly_773', name: 'Outer Belt Anomaly', type: 'anomaly', sectorId: 'sol_sector', coordinates: { x: 420, y: -30, z: 160 }, discovered: false, metadata: { color: '#a855f7', radius: 0.6, description: 'Unknown energy field detected beyond the inner planets.' } }
];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const SCENE_SCALE = 8;
const CLICK_DRAG_THRESHOLD = 6;

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App container not found');

app.innerHTML = `
  <div class="layout">
    <aside class="panel">
      <section class="panel-section boot-section">
        <p class="eyebrow">ARK NAVIGATION OS // BOOT</p>
        <h1 id="boot-title">ARK NAVIGATION OS</h1>
        <p id="boot-phrase" class="boot-phrase"></p>
        <ol id="boot-lines" class="boot-lines"></ol>
      </section>

      <section class="panel-section command-deck">
        <p class="eyebrow">COMMAND DECK</p>
        <div class="button-grid">
          <button id="scan-button" type="button">SCAN LOCAL SPACE</button>
          <button id="route-button" type="button">PLOT ROUTE</button>
          <button id="focus-button" type="button">FOCUS NODE</button>
          <button id="reset-button" type="button">RESET VIEW</button>
        </div>
      </section>

      <section class="panel-section node-panel">
        <p class="eyebrow">NODE INFO</p>
        <h2 id="node-name">No node selected</h2>
        <dl>
          <div><dt>Type</dt><dd id="node-type">--</dd></div>
          <div><dt>Status</dt><dd id="node-status">--</dd></div>
          <div><dt>Sector</dt><dd id="node-sector">--</dd></div>
          <div><dt>Coordinates</dt><dd id="node-coordinates">--</dd></div>
        </dl>
        <p id="node-description" class="node-description">Touch a planet, star, signal, or anomaly to inspect it.</p>
      </section>

      <section class="panel-section log-section">
        <p class="eyebrow">RUNTIME EVENT STREAM</p>
        <div id="event-log" class="event-log"></div>
      </section>
    </aside>

    <main class="viewport">
      <canvas id="scene-canvas"></canvas>
      <div id="labels" class="labels"></div>
      <div class="hud">
        <div class="hud-item"><strong>Title:</strong> <span id="hud-title"></span></div>
        <div class="hud-item"><strong>Mode:</strong> Runtime Smoke Test</div>
        <div class="hud-item"><strong>Location:</strong> Sol Sector</div>
        <div class="hud-item"><strong>Runtime:</strong> <span id="hud-source">Fallback</span></div>
        <div class="hud-item"><strong>Node Count:</strong> <span id="hud-count">0</span></div>
        <div class="hud-item"><strong>Selected Node:</strong> <span id="hud-selected">None</span></div>
        <div class="hud-item control-hint"><strong>Map Controls:</strong> drag rotate / wheel zoom / right-drag pan / tap node</div>
      </div>
    </main>
  </div>`;

const bootTitle = document.querySelector<HTMLElement>('#boot-title')!;
const bootPhrase = document.querySelector<HTMLElement>('#boot-phrase')!;
const bootLines = document.querySelector<HTMLOListElement>('#boot-lines')!;
const hudTitle = document.querySelector<HTMLElement>('#hud-title')!;
const hudSource = document.querySelector<HTMLElement>('#hud-source')!;
const hudCount = document.querySelector<HTMLElement>('#hud-count')!;
const hudSelected = document.querySelector<HTMLElement>('#hud-selected')!;
const viewport = document.querySelector<HTMLElement>('.viewport')!;
const canvas = document.querySelector<HTMLCanvasElement>('#scene-canvas')!;
const labelsLayer = document.querySelector<HTMLDivElement>('#labels')!;
const eventLog = document.querySelector<HTMLDivElement>('#event-log')!;
const scanButton = document.querySelector<HTMLButtonElement>('#scan-button')!;
const routeButton = document.querySelector<HTMLButtonElement>('#route-button')!;
const focusButton = document.querySelector<HTMLButtonElement>('#focus-button')!;
const resetButton = document.querySelector<HTMLButtonElement>('#reset-button')!;
const nodeName = document.querySelector<HTMLElement>('#node-name')!;
const nodeType = document.querySelector<HTMLElement>('#node-type')!;
const nodeStatus = document.querySelector<HTMLElement>('#node-status')!;
const nodeSector = document.querySelector<HTMLElement>('#node-sector')!;
const nodeCoordinates = document.querySelector<HTMLElement>('#node-coordinates')!;
const nodeDescription = document.querySelector<HTMLElement>('#node-description')!;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#030712');
scene.fog = new THREE.FogExp2('#030712', 0.0035);

const camera = new THREE.PerspectiveCamera(70, viewport.clientWidth / viewport.clientHeight, 0.1, 5000);
const defaultCameraPosition = new THREE.Vector3(0, 60, 280);
const defaultLookTarget = new THREE.Vector3(22, 0, 10);
const desiredCameraPosition = defaultCameraPosition.clone();
const lookTarget = defaultLookTarget.clone();
let autopilotActive = false;
camera.position.copy(defaultCameraPosition);
camera.lookAt(lookTarget);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewport.clientWidth, viewport.clientHeight, false);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = true;
controls.panSpeed = 0.65;
controls.rotateSpeed = 0.62;
controls.zoomSpeed = 0.9;
controls.minDistance = 18;
controls.maxDistance = 620;
controls.target.copy(defaultLookTarget);
controls.update();

scene.add(new THREE.AmbientLight(0x9fb7ff, 0.45));
const sunLight = new THREE.PointLight(0xfff2cc, 3.2, 1500);
sunLight.position.set(0, 0, 0);
scene.add(sunLight);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const meshToNode = new Map<THREE.Object3D, UniverseNode>();
const meshToLabel = new Map<THREE.Object3D, HTMLDivElement>();
const runtimeEvents: RuntimeEvent[] = [];
const routeGroup = new THREE.Group();
const pulseGroup = new THREE.Group();
scene.add(routeGroup, pulseGroup);

let selectedNode: UniverseNode | null = null;
let currentNode: UniverseNode | null = null;
let activeRoute: THREE.Line | null = null;
let sourceMode: 'API' | 'Fallback' = 'Fallback';
let pointerStart: { x: number; y: number } | null = null;

const formatTime = (): string => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const addEvent = (message: string): void => {
  runtimeEvents.unshift({ time: formatTime(), message });
  runtimeEvents.splice(8);
  eventLog.innerHTML = runtimeEvents
    .map((event) => `<div class="event-row"><span>${event.time}</span><p>${event.message}</p></div>`)
    .join('');
};

const toScenePosition = (node: UniverseNode): THREE.Vector3 => new THREE.Vector3(
  node.coordinates.x / SCENE_SCALE,
  node.coordinates.y / SCENE_SCALE,
  node.coordinates.z / SCENE_SCALE
);

const createStarfield = (): void => {
  const starCount = 1200;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    const radius = 480 + Math.random() * 1000;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xc7d2fe, size: 1.4, sizeAttenuation: true });
  scene.add(new THREE.Points(geometry, material));
};

const loadData = async (): Promise<{ boot: BootSequence; nodes: UniverseNode[] }> => {
  try {
    const [bootRes, nodesRes] = await Promise.all([
      fetch(`${API_BASE_URL}/boot/sequence`),
      fetch(`${API_BASE_URL}/universe/nodes`)
    ]);

    if (!bootRes.ok || !nodesRes.ok) throw new Error('API response invalid');

    const boot = (await bootRes.json()) as BootSequence;
    const nodePayload = (await nodesRes.json()) as { nodes: UniverseNode[] };
    sourceMode = 'API';
    return { boot, nodes: nodePayload.nodes };
  } catch {
    sourceMode = 'Fallback';
    return { boot: fallbackBoot, nodes: fallbackNodes };
  }
};

const renderBoot = (boot: BootSequence): void => {
  bootTitle.textContent = boot.title;
  hudTitle.textContent = boot.title;
  bootPhrase.textContent = boot.phrase;
  bootLines.innerHTML = boot.lines.map((line) => `<li>${line}</li>`).join('');
  hudSource.textContent = sourceMode;
};

const createNodeLabel = (node: UniverseNode): HTMLDivElement => {
  const label = document.createElement('div');
  label.className = `node-label node-label-${node.type}`;
  label.textContent = node.name;
  label.title = node.metadata.description;
  labelsLayer.appendChild(label);
  return label;
};

const createOrbitRing = (node: UniverseNode): void => {
  if (node.id === 'sol_sun') return;
  const radius = Math.sqrt((node.coordinates.x / SCENE_SCALE) ** 2 + (node.coordinates.z / SCENE_SCALE) ** 2);
  const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2, false, 0);
  const points = curve.getPoints(128).map((point) => new THREE.Vector3(point.x, 0, point.y));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0x1f3b64, transparent: true, opacity: 0.35 });
  scene.add(new THREE.LineLoop(geometry, material));
};

const renderNodes = (nodes: UniverseNode[]): void => {
  hudCount.textContent = String(nodes.length);
  currentNode = nodes.find((node) => node.id === 'sol_sun') ?? nodes[0] ?? null;

  for (const node of nodes) {
    createOrbitRing(node);
    const radius = Math.max(node.metadata.radius * 3, 1.4);
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: node.metadata.color,
      emissive: node.type === 'star' || node.type === 'signal' || node.type === 'anomaly' ? node.metadata.color : '#000000',
      emissiveIntensity: node.type === 'star' ? 1.1 : node.type === 'signal' || node.type === 'anomaly' ? 0.5 : 0.08,
      roughness: 0.55,
      metalness: 0.08,
      wireframe: node.type === 'anomaly' || node.type === 'signal'
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(toScenePosition(node));
    mesh.userData.rotationSpeed = 0.002 + Math.random() * 0.01;
    meshToNode.set(mesh, node);
    meshToLabel.set(mesh, createNodeLabel(node));
    scene.add(mesh);
  }
};

const updateNodePanel = (node: UniverseNode): void => {
  nodeName.textContent = node.name;
  nodeType.textContent = node.type;
  nodeStatus.textContent = node.discovered ? 'discovered' : 'undiscovered';
  nodeSector.textContent = node.sectorId;
  nodeCoordinates.textContent = `x ${node.coordinates.x} / y ${node.coordinates.y} / z ${node.coordinates.z}`;
  nodeDescription.textContent = node.metadata.description;
};

const focusCameraOnNode = (node: UniverseNode): void => {
  const nodePosition = toScenePosition(node);
  const distance = Math.max(node.metadata.radius * 14, 32);
  desiredCameraPosition.copy(nodePosition.clone().add(new THREE.Vector3(distance, distance * 0.55, distance * 1.8)));
  lookTarget.copy(nodePosition);
  autopilotActive = true;
};

const selectNode = (node: UniverseNode): void => {
  selectedNode = node;
  hudSelected.textContent = `${node.name} (${node.type})`;
  updateNodePanel(node);
  focusCameraOnNode(node);
  addEvent(`NAV selected ${node.name} / ${node.type}`);
};

const clearRoute = (): void => {
  if (activeRoute) {
    routeGroup.remove(activeRoute);
    activeRoute.geometry.dispose();
    const material = activeRoute.material;
    if (!Array.isArray(material)) material.dispose();
    activeRoute = null;
  }
};

const plotRoute = (): void => {
  if (!selectedNode || !currentNode || selectedNode.id === currentNode.id) {
    addEvent('NAV route plot rejected: select a destination node first.');
    return;
  }

  clearRoute();
  const origin = toScenePosition(currentNode);
  const destination = toScenePosition(selectedNode);
  const mid = origin.clone().lerp(destination, 0.5).add(new THREE.Vector3(0, 20, 0));
  const curve = new THREE.CatmullRomCurve3([origin, mid, destination]);
  const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(80));
  const material = new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.95 });
  activeRoute = new THREE.Line(geometry, material);
  routeGroup.add(activeRoute);

  const distance = origin.distanceTo(destination).toFixed(1);
  addEvent(`NAV route plotted: ${currentNode.name} → ${selectedNode.name} / ${distance} AU-sim.`);
};

const createScanPulse = (): void => {
  const origin = currentNode ? toScenePosition(currentNode) : new THREE.Vector3();
  const geometry = new THREE.RingGeometry(1, 1.25, 96);
  const material = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
  const pulse = new THREE.Mesh(geometry, material);
  pulse.position.copy(origin);
  pulse.rotation.x = Math.PI / 2;
  pulse.userData.life = 0;
  pulseGroup.add(pulse);
  addEvent('SCAN pulse emitted across Sol Sector.');
};

const updateScanPulses = (): void => {
  for (const pulse of [...pulseGroup.children]) {
    pulse.userData.life = (pulse.userData.life as number) + 0.016;
    const life = pulse.userData.life as number;
    const scale = 1 + life * 90;
    pulse.scale.set(scale, scale, scale);
    const material = (pulse as THREE.Mesh).material;
    if (!Array.isArray(material)) material.opacity = Math.max(0, 0.75 - life * 0.55);
    if (life > 1.5) {
      pulseGroup.remove(pulse);
      const mesh = pulse as THREE.Mesh;
      mesh.geometry.dispose();
      if (!Array.isArray(mesh.material)) mesh.material.dispose();
    }
  }
};

const updateLabels = (): void => {
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  for (const [mesh, label] of meshToLabel.entries()) {
    const position = mesh.position.clone().project(camera);
    const visible = position.z < 1;
    label.style.display = visible ? 'block' : 'none';
    label.style.transform = `translate(-50%, -50%) translate(${(position.x * 0.5 + 0.5) * width}px, ${(-position.y * 0.5 + 0.5) * height}px)`;
  }
};

canvas.addEventListener('pointerdown', (event: PointerEvent) => {
  pointerStart = { x: event.clientX, y: event.clientY };
});

canvas.addEventListener('pointerup', (event: PointerEvent) => {
  if (!pointerStart) return;
  const dragDistance = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
  pointerStart = null;
  if (dragDistance > CLICK_DRAG_THRESHOLD) return;

  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects([...meshToNode.keys()]);
  if (hits.length > 0) {
    const node = meshToNode.get(hits[0].object);
    if (node) selectNode(node);
  }
});

controls.addEventListener('start', () => {
  autopilotActive = false;
});

scanButton.addEventListener('click', createScanPulse);
routeButton.addEventListener('click', plotRoute);
focusButton.addEventListener('click', () => {
  if (selectedNode) focusCameraOnNode(selectedNode);
  else addEvent('NAV focus rejected: no selected node.');
});
resetButton.addEventListener('click', () => {
  desiredCameraPosition.copy(defaultCameraPosition);
  lookTarget.copy(defaultLookTarget);
  autopilotActive = true;
  clearRoute();
  addEvent('NAV camera reset to Sol Sector overview.');
});

const resizeRenderer = (): void => {
  const width = Math.max(viewport.clientWidth, 1);
  const height = Math.max(viewport.clientHeight, 1);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
};

const animate = (): void => {
  if (autopilotActive) {
    camera.position.lerp(desiredCameraPosition, 0.035);
    controls.target.lerp(lookTarget, 0.05);
    if (camera.position.distanceTo(desiredCameraPosition) < 0.5 && controls.target.distanceTo(lookTarget) < 0.25) {
      autopilotActive = false;
    }
  }

  controls.update();

  for (const obj of meshToNode.keys()) {
    obj.rotation.y += obj.userData.rotationSpeed as number;
  }

  updateScanPulses();
  updateLabels();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
};

window.addEventListener('resize', resizeRenderer);

const init = async (): Promise<void> => {
  resizeRenderer();
  createStarfield();
  const { boot, nodes } = await loadData();
  renderBoot(boot);
  renderNodes(nodes);
  addEvent(`CORE console online via ${sourceMode} data.`);
  addEvent(`NAV indexed ${nodes.length} Sol Sector nodes.`);
  addEvent('NAV manual controls online: drag, zoom, pan, tap node.');
  animate();
};

void init();
