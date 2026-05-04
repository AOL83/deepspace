import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type NodeType = 'star' | 'planet' | 'moon' | 'anomaly' | 'signal' | 'gate' | 'reference';
type SpaceLayer = 'system' | 'orbit' | 'surface';

interface BootSequence {
  title: string;
  phrase: string;
  lines: string[];
}

interface RuntimeEvent {
  time: string;
  message: string;
}

interface QDSMNode {
  id: string;
  name: string;
  type: NodeType;
  layer: SpaceLayer;
  parentId: string | null;
  containerId: string;
  enterContainerId?: string;
  localPosition: { x: number; y: number; z: number };
  displayRadius: number;
  color: string;
  discovered: boolean;
  description: string;
}

interface QDSMContainer {
  id: string;
  name: string;
  layer: SpaceLayer;
  originNodeId: string;
  parentContainerId: string | null;
  parentNodeId: string | null;
  visibleNodeIds: string[];
  cameraPosition: THREE.Vector3;
  cameraTarget: THREE.Vector3;
  scaleNote: string;
}

const fallbackBoot: BootSequence = {
  title: 'ARK NAVIGATION OS v0.1',
  phrase: 'Darkness is not empty. It is an address space.',
  lines: [
    'BOOT SEQUENCE INITIATED',
    '[CORE] Node runtime online',
    '[NAV]  QDSM container mapper online',
    '[LOG]  Runtime event stream opened',
    'ARK NAVIGATION OS READY'
  ]
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const CLICK_DRAG_THRESHOLD = 6;

const nodeLibrary: Record<string, QDSMNode> = {
  sol_sun: {
    id: 'sol_sun',
    name: 'Sun',
    type: 'star',
    layer: 'system',
    parentId: null,
    containerId: 'sol_system',
    localPosition: { x: 0, y: 0, z: 0 },
    displayRadius: 18,
    color: '#ffd27a',
    discovered: true,
    description: 'Central anchor of the Sol System container.'
  },
  sol_earth: {
    id: 'sol_earth',
    name: 'Earth',
    type: 'planet',
    layer: 'system',
    parentId: 'sol_sun',
    containerId: 'sol_system',
    enterContainerId: 'earth_orbit',
    localPosition: { x: 92, y: 0, z: 0 },
    displayRadius: 6,
    color: '#3b82f6',
    discovered: true,
    description: 'Home world. Enter this node to open the Earth Orbit container.'
  },
  sol_mars: {
    id: 'sol_mars',
    name: 'Mars',
    type: 'planet',
    layer: 'system',
    parentId: 'sol_sun',
    containerId: 'sol_system',
    localPosition: { x: 155, y: 0, z: 46 },
    displayRadius: 5,
    color: '#ff5533',
    discovered: true,
    description: 'Red planet in the Sol System container.'
  },
  outer_belt_signal_001: {
    id: 'outer_belt_signal_001',
    name: 'Outer Belt Signal',
    type: 'signal',
    layer: 'system',
    parentId: 'sol_sun',
    containerId: 'sol_system',
    localPosition: { x: 245, y: -5, z: 105 },
    displayRadius: 3,
    color: '#22d3ee',
    discovered: false,
    description: 'Repeating signal from the outer belt.'
  },
  anomaly_773: {
    id: 'anomaly_773',
    name: 'Outer Belt Anomaly',
    type: 'anomaly',
    layer: 'system',
    parentId: 'sol_sun',
    containerId: 'sol_system',
    localPosition: { x: 278, y: -8, z: 132 },
    displayRadius: 4,
    color: '#a855f7',
    discovered: false,
    description: 'Unknown energy field detected beyond the inner planets.'
  },
  earth_origin: {
    id: 'earth_origin',
    name: 'Earth',
    type: 'planet',
    layer: 'orbit',
    parentId: 'sol_sun',
    containerId: 'earth_orbit',
    localPosition: { x: 0, y: 0, z: 0 },
    displayRadius: 16,
    color: '#3b82f6',
    discovered: true,
    description: 'Earth Orbit container origin. The Moon and atmosphere are mapped relative to this anchor.'
  },
  sol_moon: {
    id: 'sol_moon',
    name: 'Moon',
    type: 'moon',
    layer: 'orbit',
    parentId: 'earth_origin',
    containerId: 'earth_orbit',
    localPosition: { x: 42, y: 1, z: 0 },
    displayRadius: 4,
    color: '#d1d5db',
    discovered: true,
    description: "Earth's natural satellite. It is now mapped inside Earth Orbit rather than flattened into Sol System scale."
  },
  atmosphere_gate_earth: {
    id: 'atmosphere_gate_earth',
    name: 'Atmosphere Gate',
    type: 'gate',
    layer: 'orbit',
    parentId: 'earth_origin',
    containerId: 'earth_orbit',
    localPosition: { x: 0, y: 0, z: -28 },
    displayRadius: 2.5,
    color: '#67e8f9',
    discovered: true,
    description: 'Transition marker for future Earth atmosphere entry and surface mapping.'
  },
  sun_parent_reference: {
    id: 'sun_parent_reference',
    name: 'Sun Direction',
    type: 'reference',
    layer: 'orbit',
    parentId: 'earth_origin',
    containerId: 'earth_orbit',
    localPosition: { x: -130, y: 0, z: 0 },
    displayRadius: 3,
    color: '#ffd27a',
    discovered: true,
    description: 'Parent container reference. This points back toward the Sun / Sol System frame.'
  }
};

const containers: Record<string, QDSMContainer> = {
  sol_system: {
    id: 'sol_system',
    name: 'Sol System',
    layer: 'system',
    originNodeId: 'sol_sun',
    parentContainerId: null,
    parentNodeId: null,
    visibleNodeIds: ['sol_sun', 'sol_earth', 'sol_mars', 'outer_belt_signal_001', 'anomaly_773'],
    cameraPosition: new THREE.Vector3(40, 120, 330),
    cameraTarget: new THREE.Vector3(86, 0, 32),
    scaleNote: 'Sun-anchored system container. Moons are collapsed into planet containers.'
  },
  earth_orbit: {
    id: 'earth_orbit',
    name: 'Earth Orbit',
    layer: 'orbit',
    originNodeId: 'earth_origin',
    parentContainerId: 'sol_system',
    parentNodeId: 'sol_earth',
    visibleNodeIds: ['earth_origin', 'sol_moon', 'atmosphere_gate_earth', 'sun_parent_reference'],
    cameraPosition: new THREE.Vector3(24, 58, 118),
    cameraTarget: new THREE.Vector3(10, 0, 0),
    scaleNote: 'Earth-anchored orbit container. Moon distance is local to Earth.'
  }
};

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
          <button id="enter-button" type="button">ENTER NODE</button>
          <button id="back-button" type="button">BACK / PARENT</button>
        </div>
      </section>

      <section class="panel-section node-panel">
        <p class="eyebrow">NODE INFO</p>
        <h2 id="node-name">No node selected</h2>
        <dl>
          <div><dt>Type</dt><dd id="node-type">--</dd></div>
          <div><dt>Status</dt><dd id="node-status">--</dd></div>
          <div><dt>Layer</dt><dd id="node-sector">--</dd></div>
          <div><dt>Local Position</dt><dd id="node-coordinates">--</dd></div>
        </dl>
        <p id="node-description" class="node-description">Touch a node to inspect it. Use Enter Node to move into a child container.</p>
      </section>

      <section class="panel-section nav-library-section">
        <p class="eyebrow">NAV LIBRARY</p>
        <div id="nav-library" class="button-grid"></div>
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
        <div class="hud-item"><strong>Mode:</strong> QDSM Navigation</div>
        <div class="hud-item"><strong>Container:</strong> <span id="hud-container">Sol System</span></div>
        <div class="hud-item"><strong>Path:</strong> <span id="hud-path">Sol System</span></div>
        <div class="hud-item"><strong>Runtime:</strong> <span id="hud-source">Fallback</span></div>
        <div class="hud-item"><strong>Visible Nodes:</strong> <span id="hud-count">0</span></div>
        <div class="hud-item"><strong>Selected Node:</strong> <span id="hud-selected">None</span></div>
        <div class="hud-item control-hint"><strong>Map Controls:</strong> drag rotate / wheel zoom / right-drag pan / tap node / Enter Node</div>
      </div>
    </main>
  </div>`;

const bootTitle = document.querySelector<HTMLElement>('#boot-title')!;
const bootPhrase = document.querySelector<HTMLElement>('#boot-phrase')!;
const bootLines = document.querySelector<HTMLOListElement>('#boot-lines')!;
const hudTitle = document.querySelector<HTMLElement>('#hud-title')!;
const hudSource = document.querySelector<HTMLElement>('#hud-source')!;
const hudContainer = document.querySelector<HTMLElement>('#hud-container')!;
const hudPath = document.querySelector<HTMLElement>('#hud-path')!;
const hudCount = document.querySelector<HTMLElement>('#hud-count')!;
const hudSelected = document.querySelector<HTMLElement>('#hud-selected')!;
const viewport = document.querySelector<HTMLElement>('.viewport')!;
const canvas = document.querySelector<HTMLCanvasElement>('#scene-canvas')!;
const labelsLayer = document.querySelector<HTMLDivElement>('#labels')!;
const eventLog = document.querySelector<HTMLDivElement>('#event-log')!;
const navLibrary = document.querySelector<HTMLDivElement>('#nav-library')!;
const scanButton = document.querySelector<HTMLButtonElement>('#scan-button')!;
const routeButton = document.querySelector<HTMLButtonElement>('#route-button')!;
const focusButton = document.querySelector<HTMLButtonElement>('#focus-button')!;
const resetButton = document.querySelector<HTMLButtonElement>('#reset-button')!;
const enterButton = document.querySelector<HTMLButtonElement>('#enter-button')!;
const backButton = document.querySelector<HTMLButtonElement>('#back-button')!;
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
controls.minDistance = 12;
controls.maxDistance = 900;

scene.add(new THREE.AmbientLight(0x9fb7ff, 0.45));
const sunLight = new THREE.PointLight(0xfff2cc, 3.2, 1500);
scene.add(sunLight);

const contentGroup = new THREE.Group();
const routeGroup = new THREE.Group();
const pulseGroup = new THREE.Group();
scene.add(contentGroup, routeGroup, pulseGroup);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const meshToNode = new Map<THREE.Object3D, QDSMNode>();
const meshToLabel = new Map<THREE.Object3D, { node: QDSMNode; label: HTMLDivElement }>();
const runtimeEvents: RuntimeEvent[] = [];

let selectedNode: QDSMNode | null = null;
let currentContainerId = 'sol_system';
let currentOriginNode: QDSMNode = nodeLibrary.sol_sun;
let activeRoute: THREE.Line | null = null;
let sourceMode: 'API' | 'Fallback' = 'Fallback';
let pointerStart: { x: number; y: number } | null = null;
let autopilotActive = false;
let desiredCameraPosition = containers.sol_system.cameraPosition.clone();
let lookTarget = containers.sol_system.cameraTarget.clone();

const formatTime = (): string => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const addEvent = (message: string): void => {
  runtimeEvents.unshift({ time: formatTime(), message });
  runtimeEvents.splice(8);
  eventLog.innerHTML = runtimeEvents
    .map((event) => `<div class="event-row"><span>${event.time}</span><p>${event.message}</p></div>`)
    .join('');
};

const toScenePosition = (node: QDSMNode): THREE.Vector3 => new THREE.Vector3(
  node.localPosition.x,
  node.localPosition.y,
  node.localPosition.z
);

const getCurrentContainer = (): QDSMContainer => containers[currentContainerId];

const getContainerPath = (containerId: string): string => {
  const chain: string[] = [];
  let current: QDSMContainer | null = containers[containerId];
  while (current) {
    chain.unshift(current.name);
    current = current.parentContainerId ? containers[current.parentContainerId] : null;
  }
  return chain.join(' > ');
};

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

const loadBoot = async (): Promise<BootSequence> => {
  try {
    const bootRes = await fetch(`${API_BASE_URL}/boot/sequence`);
    if (!bootRes.ok) throw new Error('API response invalid');
    sourceMode = 'API';
    return (await bootRes.json()) as BootSequence;
  } catch {
    sourceMode = 'Fallback';
    return fallbackBoot;
  }
};

const renderBoot = (boot: BootSequence): void => {
  bootTitle.textContent = boot.title;
  hudTitle.textContent = boot.title;
  bootPhrase.textContent = boot.phrase;
  bootLines.innerHTML = boot.lines.map((line) => `<li>${line}</li>`).join('');
  hudSource.textContent = sourceMode;
};

const resetNodePanel = (): void => {
  nodeName.textContent = 'No node selected';
  nodeType.textContent = '--';
  nodeStatus.textContent = '--';
  nodeSector.textContent = '--';
  nodeCoordinates.textContent = '--';
  nodeDescription.textContent = 'Touch a node to inspect it. Use Enter Node to move into a child container.';
  hudSelected.textContent = 'None';
};

const createNodeLabel = (node: QDSMNode): HTMLDivElement => {
  const label = document.createElement('div');
  label.className = `node-label node-label-${node.type}`;
  label.textContent = node.name;
  label.title = node.description;
  labelsLayer.appendChild(label);
  return label;
};

const createOrbitRing = (node: QDSMNode): void => {
  const current = getCurrentContainer();
  if (node.id === current.originNodeId || node.type === 'reference') return;
  const position = toScenePosition(node);
  const radius = Math.sqrt(position.x ** 2 + position.z ** 2);
  if (radius < 1) return;
  const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2, false, 0);
  const points = curve.getPoints(160).map((point) => new THREE.Vector3(point.x, 0, point.y));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0x1f3b64, transparent: true, opacity: 0.35 });
  contentGroup.add(new THREE.LineLoop(geometry, material));
};

const disposeObject = (object: THREE.Object3D): void => {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((item) => item.dispose());
    else if (material) material.dispose();
  });
};

const clearSceneContent = (): void => {
  for (const object of [...contentGroup.children]) {
    contentGroup.remove(object);
    disposeObject(object);
  }
  for (const object of [...routeGroup.children]) {
    routeGroup.remove(object);
    disposeObject(object);
  }
  for (const object of [...pulseGroup.children]) {
    pulseGroup.remove(object);
    disposeObject(object);
  }
  labelsLayer.innerHTML = '';
  meshToNode.clear();
  meshToLabel.clear();
  activeRoute = null;
};

const renderNavLibrary = (): void => {
  const current = getCurrentContainer();
  navLibrary.innerHTML = '';
  for (const nodeId of current.visibleNodeIds) {
    const node = nodeLibrary[nodeId];
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = node.enterContainerId ? `${node.name} >` : node.name;
    button.addEventListener('click', () => selectNode(node));
    navLibrary.appendChild(button);
  }
};

const applyContainerCamera = (container: QDSMContainer): void => {
  desiredCameraPosition = container.cameraPosition.clone();
  lookTarget = container.cameraTarget.clone();
  camera.position.copy(desiredCameraPosition);
  controls.target.copy(lookTarget);
  controls.update();
};

const renderContainer = (containerId: string): void => {
  currentContainerId = containerId;
  const container = getCurrentContainer();
  currentOriginNode = nodeLibrary[container.originNodeId];
  selectedNode = null;
  resetNodePanel();
  clearSceneContent();

  for (const nodeId of container.visibleNodeIds) {
    const node = nodeLibrary[nodeId];
    createOrbitRing(node);
    const geometry = new THREE.SphereGeometry(node.displayRadius, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: node.color,
      emissive: node.type === 'star' || node.type === 'signal' || node.type === 'anomaly' || node.type === 'gate' ? node.color : '#000000',
      emissiveIntensity: node.type === 'star' ? 1.1 : node.type === 'reference' ? 0.7 : node.type === 'gate' ? 0.55 : 0.18,
      roughness: 0.55,
      metalness: 0.08,
      wireframe: node.type === 'anomaly' || node.type === 'signal' || node.type === 'gate' || node.type === 'reference'
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(toScenePosition(node));
    mesh.userData.rotationSpeed = 0.002 + Math.random() * 0.01;
    meshToNode.set(mesh, node);
    meshToLabel.set(mesh, { node, label: createNodeLabel(node) });
    contentGroup.add(mesh);
  }

  hudContainer.textContent = container.name;
  hudPath.textContent = getContainerPath(container.id);
  hudCount.textContent = String(container.visibleNodeIds.length);
  renderNavLibrary();
  applyContainerCamera(container);
  addEvent(`QDSM container loaded: ${container.name}. ${container.scaleNote}`);
};

const updateNodePanel = (node: QDSMNode): void => {
  nodeName.textContent = node.name;
  nodeType.textContent = node.type;
  nodeStatus.textContent = node.discovered ? 'discovered' : 'undiscovered';
  nodeSector.textContent = node.layer;
  nodeCoordinates.textContent = `x ${node.localPosition.x} / y ${node.localPosition.y} / z ${node.localPosition.z}`;
  nodeDescription.textContent = node.description;
};

const focusCameraOnNode = (node: QDSMNode): void => {
  const nodePosition = toScenePosition(node);
  const distance = Math.max(node.displayRadius * 8, 38);
  desiredCameraPosition = nodePosition.clone().add(new THREE.Vector3(distance, distance * 0.5, distance * 1.45));
  lookTarget = nodePosition.clone();
  autopilotActive = true;
};

function selectNode(node: QDSMNode): void {
  selectedNode = node;
  hudSelected.textContent = `${node.name} (${node.type})`;
  updateNodePanel(node);
  focusCameraOnNode(node);
  addEvent(`NAV selected ${node.name} / ${node.type}`);
}

const enterSelectedNode = (): void => {
  if (!selectedNode?.enterContainerId) {
    addEvent('QDSM enter rejected: selected node has no child container.');
    return;
  }
  renderContainer(selectedNode.enterContainerId);
};

const enterParentContainer = (): void => {
  const current = getCurrentContainer();
  if (!current.parentContainerId) {
    addEvent('QDSM back rejected: already at root container.');
    return;
  }
  const parentNodeId = current.parentNodeId;
  renderContainer(current.parentContainerId);
  if (parentNodeId) selectNode(nodeLibrary[parentNodeId]);
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
  if (!selectedNode || selectedNode.id === currentOriginNode.id) {
    addEvent('NAV route plot rejected: select a destination node first.');
    return;
  }

  clearRoute();
  const origin = toScenePosition(currentOriginNode);
  const destination = toScenePosition(selectedNode);
  const mid = origin.clone().lerp(destination, 0.5).add(new THREE.Vector3(0, 20, 0));
  const curve = new THREE.CatmullRomCurve3([origin, mid, destination]);
  const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(80));
  const material = new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.95 });
  activeRoute = new THREE.Line(geometry, material);
  routeGroup.add(activeRoute);

  const distance = origin.distanceTo(destination).toFixed(1);
  addEvent(`NAV route plotted: ${currentOriginNode.name} → ${selectedNode.name} / ${distance} local units.`);
};

const createScanPulse = (): void => {
  const origin = toScenePosition(currentOriginNode);
  const geometry = new THREE.RingGeometry(1, 1.25, 96);
  const material = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
  const pulse = new THREE.Mesh(geometry, material);
  pulse.position.copy(origin);
  pulse.rotation.x = Math.PI / 2;
  pulse.userData.life = 0;
  pulseGroup.add(pulse);
  addEvent(`SCAN pulse emitted inside ${getCurrentContainer().name}.`);
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
  for (const [mesh, entry] of meshToLabel.entries()) {
    const labelPosition = mesh.position.clone();
    labelPosition.y += entry.node.displayRadius + 4;
    const position = labelPosition.project(camera);
    const visible = position.z < 1;
    entry.label.style.display = visible ? 'block' : 'none';
    entry.label.style.transform = `translate(-50%, -50%) translate(${(position.x * 0.5 + 0.5) * width}px, ${(-position.y * 0.5 + 0.5) * height}px)`;
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
  const container = getCurrentContainer();
  desiredCameraPosition = container.cameraPosition.clone();
  lookTarget = container.cameraTarget.clone();
  autopilotActive = true;
  clearRoute();
  addEvent(`NAV camera reset to ${container.name}.`);
});
enterButton.addEventListener('click', enterSelectedNode);
backButton.addEventListener('click', enterParentContainer);

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
  const boot = await loadBoot();
  renderBoot(boot);
  renderContainer('sol_system');
  addEvent(`CORE console online via ${sourceMode} data.`);
  addEvent('QDSM online: nested origin containers enabled.');
  addEvent('NAV manual controls online: drag, zoom, pan, tap node, Enter Node.');
  animate();
};

void init();
