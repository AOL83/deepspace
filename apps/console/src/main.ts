import './style.css';
import * as THREE from 'three';

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

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App container not found');

app.innerHTML = `<div class="layout"><aside class="panel"><h1>ARK NAVIGATION OS // BOOT</h1><p id="boot-phrase"></p><ol id="boot-lines"></ol></aside><main class="viewport"><div class="hud"><div class="hud-item"><strong>Title:</strong> <span id="hud-title"></span></div><div class="hud-item"><strong>Mode:</strong> Runtime Smoke Test</div><div class="hud-item"><strong>Location:</strong> Sol Sector</div><div class="hud-item"><strong>Node Count:</strong> <span id="hud-count">0</span></div><div class="hud-item"><strong>Selected Node:</strong> <span id="hud-selected">None</span></div></div></main></div>`;

const bootPhrase = document.querySelector<HTMLElement>('#boot-phrase')!;
const bootLines = document.querySelector<HTMLOListElement>('#boot-lines')!;
const hudTitle = document.querySelector<HTMLElement>('#hud-title')!;
const hudCount = document.querySelector<HTMLElement>('#hud-count')!;
const hudSelected = document.querySelector<HTMLElement>('#hud-selected')!;
const viewport = document.querySelector<HTMLElement>('.viewport')!;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#030712');
const camera = new THREE.PerspectiveCamera(70, viewport.clientWidth / viewport.clientHeight, 0.1, 5000);
camera.position.set(0, 60, 280);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
viewport.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const pointLight = new THREE.PointLight(0xffffff, 1.2);
pointLight.position.set(30, 30, 60);
scene.add(pointLight);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const meshToNode = new Map<THREE.Object3D, UniverseNode>();

const loadData = async (): Promise<{ boot: BootSequence; nodes: UniverseNode[] }> => {
  try {
    const [bootRes, nodesRes] = await Promise.all([
      fetch(`${API_BASE_URL}/boot/sequence`),
      fetch(`${API_BASE_URL}/universe/nodes`)
    ]);

    if (!bootRes.ok || !nodesRes.ok) throw new Error('API response invalid');

    const boot = (await bootRes.json()) as BootSequence;
    const nodePayload = (await nodesRes.json()) as { nodes: UniverseNode[] };
    return { boot, nodes: nodePayload.nodes };
  } catch {
    return { boot: fallbackBoot, nodes: fallbackNodes };
  }
};

const renderBoot = (boot: BootSequence): void => {
  hudTitle.textContent = boot.title;
  bootPhrase.textContent = boot.phrase;
  bootLines.innerHTML = boot.lines.map((line) => `<li>${line}</li>`).join('');
};

const renderNodes = (nodes: UniverseNode[]): void => {
  hudCount.textContent = String(nodes.length);
  for (const node of nodes) {
    const geometry = new THREE.SphereGeometry(node.metadata.radius * 3, 24, 24);
    const material = new THREE.MeshStandardMaterial({
      color: node.metadata.color,
      wireframe: node.type === 'anomaly' || node.type === 'signal'
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(node.coordinates.x / 8, node.coordinates.y / 8, node.coordinates.z / 8);
    mesh.userData.rotationSpeed = 0.002 + Math.random() * 0.01;
    meshToNode.set(mesh, node);
    scene.add(mesh);
  }
};

renderer.domElement.addEventListener('click', (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects([...meshToNode.keys()]);
  if (hits.length > 0) {
    const node = meshToNode.get(hits[0].object);
    if (node) {
      hudSelected.textContent = `${node.name} (${node.type})`;
    }
  }
});

const animate = (): void => {
  for (const obj of meshToNode.keys()) {
    obj.rotation.y += obj.userData.rotationSpeed as number;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
};

window.addEventListener('resize', () => {
  camera.aspect = viewport.clientWidth / viewport.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(viewport.clientWidth, viewport.clientHeight);
});

const init = async (): Promise<void> => {
  const { boot, nodes } = await loadData();
  renderBoot(boot);
  renderNodes(nodes);
  animate();
};

void init();
