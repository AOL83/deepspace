import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type NodeType =
  | 'ship'
  | 'console'
  | 'star'
  | 'planet'
  | 'moon'
  | 'station'
  | 'room'
  | 'avatar'
  | 'city'
  | 'building'
  | 'shelf'
  | 'cartridge'
  | 'portal'
  | 'anomaly'
  | 'signal'
  | 'gate'
  | 'reference';

type SpaceLayer = 'ship' | 'system' | 'orbit' | 'hub' | 'interior' | 'surface' | 'runtime';
type ActionId = 'select' | 'enter' | 'back' | 'scan' | 'route' | 'focus' | 'reset' | 'launchAvatar' | 'interact' | 'hack' | 'build';

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
  actionHint?: string;
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

interface WorldFlag {
  id: string;
  label: string;
  active: boolean;
}

const fallbackBoot: BootSequence = {
  title: 'ARK NAVIGATION OS v0.2 BETA',
  phrase: 'Every node is a container. Every container can become a world.',
  lines: [
    'BOOT SEQUENCE INITIATED',
    '[CORE] Recursive vessel model online',
    '[NAV]  QDSM nested containers online',
    '[AVTR] Avatar Core beta shell linked',
    '[DIR]  Live World Director standing by',
    'ARK BETA ENVIRONMENT READY'
  ]
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const CLICK_DRAG_THRESHOLD = 6;

const nodeLibrary: Record<string, QDSMNode> = {
  ark_vessel: {
    id: 'ark_vessel',
    name: 'Ark Vessel',
    type: 'ship',
    layer: 'ship',
    parentId: null,
    containerId: 'ship_bridge',
    localPosition: { x: 0, y: 0, z: 0 },
    displayRadius: 14,
    color: '#38bdf8',
    discovered: true,
    description: 'Your recursive spacecraft container. The ship is the first TARDIS-like environment.'
  },
  nav_console: {
    id: 'nav_console',
    name: 'QDSM Navigation Console',
    type: 'console',
    layer: 'ship',
    parentId: 'ark_vessel',
    containerId: 'ship_bridge',
    enterContainerId: 'sol_system',
    localPosition: { x: 0, y: 0, z: -36 },
    displayRadius: 8,
    color: '#22d3ee',
    discovered: true,
    description: 'The ship star-map console. Enter it to open Sol System navigation.',
    actionHint: 'Enter Node opens the Sol System map.'
  },
  avatar_core_terminal: {
    id: 'avatar_core_terminal',
    name: 'Avatar Core Terminal',
    type: 'avatar',
    layer: 'ship',
    parentId: 'ark_vessel',
    containerId: 'ship_bridge',
    enterContainerId: 'avatar_bay',
    localPosition: { x: -34, y: 0, z: 24 },
    displayRadius: 6,
    color: '#a78bfa',
    discovered: true,
    description: 'Persistent identity terminal. Enter to inspect avatar status, cross-world skills, and launch readiness.'
  },
  cartridge_rack: {
    id: 'cartridge_rack',
    name: 'Adaptive Cartridge Rack',
    type: 'shelf',
    layer: 'ship',
    parentId: 'ark_vessel',
    containerId: 'ship_bridge',
    enterContainerId: 'game_store',
    localPosition: { x: 34, y: 0, z: 24 },
    displayRadius: 6,
    color: '#f59e0b',
    discovered: true,
    description: 'Local cartridge access point. This mirrors the future in-world game store import shelf.'
  },
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
    description: 'Repeating signal from the outer belt. Scanning it primes a unique scenario.'
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
    description: 'Unknown energy field detected beyond the inner planets. Live Director can unlock this after scanning.'
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
    description: 'Earth Orbit container origin. The Moon, station, and atmosphere are mapped relative to this anchor.'
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
    description: "Earth's natural satellite, mapped inside Earth Orbit rather than flattened into Sol System scale."
  },
  ark_orbital_hub: {
    id: 'ark_orbital_hub',
    name: 'Ark Orbital Hub',
    type: 'station',
    layer: 'orbit',
    parentId: 'earth_origin',
    containerId: 'earth_orbit',
    enterContainerId: 'orbital_hub',
    localPosition: { x: -34, y: 0, z: 26 },
    displayRadius: 5,
    color: '#93c5fd',
    discovered: true,
    description: 'Earth-orbit starbase. Dock here to access Avatar Bay, shuttle launch, and cartridge services.'
  },
  atmosphere_gate_earth: {
    id: 'atmosphere_gate_earth',
    name: 'Atmosphere Gate',
    type: 'gate',
    layer: 'orbit',
    parentId: 'earth_origin',
    containerId: 'earth_orbit',
    enterContainerId: 'earth_district',
    localPosition: { x: 0, y: 0, z: -42 },
    displayRadius: 3,
    color: '#67e8f9',
    discovered: true,
    description: 'Transition marker for Earth descent. Enter or Launch Avatar to load the Earth Beta district.'
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
  },
  hub_core: {
    id: 'hub_core',
    name: 'Orbital Hub Core',
    type: 'station',
    layer: 'hub',
    parentId: 'ark_orbital_hub',
    containerId: 'orbital_hub',
    localPosition: { x: 0, y: 0, z: 0 },
    displayRadius: 11,
    color: '#60a5fa',
    discovered: true,
    description: 'Docked inside Ark Orbital Hub. This is the first beta service hub.'
  },
  avatar_bay_node: {
    id: 'avatar_bay_node',
    name: 'Avatar Bay',
    type: 'avatar',
    layer: 'hub',
    parentId: 'hub_core',
    containerId: 'orbital_hub',
    enterContainerId: 'avatar_bay',
    localPosition: { x: -36, y: 0, z: 0 },
    displayRadius: 6,
    color: '#a78bfa',
    discovered: true,
    description: 'Avatar preparation room. Use it to inspect launch readiness and persistent identity.'
  },
  shuttle_gate: {
    id: 'shuttle_gate',
    name: 'Earth Shuttle Gate',
    type: 'gate',
    layer: 'hub',
    parentId: 'hub_core',
    containerId: 'orbital_hub',
    enterContainerId: 'earth_district',
    localPosition: { x: 36, y: 0, z: 0 },
    displayRadius: 6,
    color: '#22d3ee',
    discovered: true,
    description: 'Board the shuttle and launch the avatar into Earth Beta.'
  },
  hub_cartridge_kiosk: {
    id: 'hub_cartridge_kiosk',
    name: 'Cartridge Kiosk',
    type: 'shelf',
    layer: 'hub',
    parentId: 'hub_core',
    containerId: 'orbital_hub',
    enterContainerId: 'game_store',
    localPosition: { x: 0, y: 0, z: -38 },
    displayRadius: 5,
    color: '#f59e0b',
    discovered: true,
    description: 'Orbital cartridge kiosk. A shortcut to the same library you can enter from Earth.'
  },
  avatar_pod: {
    id: 'avatar_pod',
    name: 'Beta Avatar Pod',
    type: 'avatar',
    layer: 'interior',
    parentId: 'avatar_bay_node',
    containerId: 'avatar_bay',
    localPosition: { x: 0, y: 0, z: 0 },
    displayRadius: 8,
    color: '#c084fc',
    discovered: true,
    description: 'Persistent avatar shell. Current state: Beta body online, cross-world identity ready.'
  },
  loadout_terminal: {
    id: 'loadout_terminal',
    name: 'Loadout Terminal',
    type: 'console',
    layer: 'interior',
    parentId: 'avatar_pod',
    containerId: 'avatar_bay',
    localPosition: { x: -28, y: 0, z: -18 },
    displayRadius: 5,
    color: '#22d3ee',
    discovered: true,
    description: 'Shows Avatar Core stats, universal skills, and world adapter rules.'
  },
  launch_cradle: {
    id: 'launch_cradle',
    name: 'Launch Cradle',
    type: 'gate',
    layer: 'interior',
    parentId: 'avatar_pod',
    containerId: 'avatar_bay',
    enterContainerId: 'earth_district',
    localPosition: { x: 28, y: 0, z: -18 },
    displayRadius: 5,
    color: '#67e8f9',
    discovered: true,
    description: 'Launches the avatar from orbit into the Earth Beta district.'
  },
  earth_landing_pad: {
    id: 'earth_landing_pad',
    name: 'Earth Landing Pad',
    type: 'city',
    layer: 'surface',
    parentId: 'earth_origin',
    containerId: 'earth_district',
    localPosition: { x: 0, y: 0, z: 0 },
    displayRadius: 8,
    color: '#4ade80',
    discovered: true,
    description: 'Spawn point for the Earth Beta district. This is the first GTA-style test space.'
  },
  game_store_building: {
    id: 'game_store_building',
    name: 'Game Store',
    type: 'building',
    layer: 'surface',
    parentId: 'earth_landing_pad',
    containerId: 'earth_district',
    enterContainerId: 'game_store',
    localPosition: { x: 34, y: 0, z: -10 },
    displayRadius: 8,
    color: '#f59e0b',
    discovered: true,
    description: 'In-world cartridge store. Enter to access online shelves, Ark originals, and local import concept.'
  },
  training_zone: {
    id: 'training_zone',
    name: 'Training Zone',
    type: 'portal',
    layer: 'surface',
    parentId: 'earth_landing_pad',
    containerId: 'earth_district',
    localPosition: { x: -36, y: 0, z: 18 },
    displayRadius: 6,
    color: '#84cc16',
    discovered: true,
    description: 'Avatar movement and ability test area. Later this can teach cross-world skills.'
  },
  debug_terminal: {
    id: 'debug_terminal',
    name: 'Debug Terminal',
    type: 'console',
    layer: 'surface',
    parentId: 'earth_landing_pad',
    containerId: 'earth_district',
    localPosition: { x: -12, y: 0, z: -34 },
    displayRadius: 4,
    color: '#fb7185',
    discovered: true,
    description: 'Hack-layer test node. Interact or Hack to unlock a hidden cartridge shelf event.'
  },
  store_floor: {
    id: 'store_floor',
    name: 'Store Floor',
    type: 'building',
    layer: 'interior',
    parentId: 'game_store_building',
    containerId: 'game_store',
    localPosition: { x: 0, y: 0, z: 0 },
    displayRadius: 9,
    color: '#fbbf24',
    discovered: true,
    description: 'Interior of the Ark-compatible game store.'
  },
  ark_originals_shelf: {
    id: 'ark_originals_shelf',
    name: 'Ark Originals Shelf',
    type: 'shelf',
    layer: 'interior',
    parentId: 'store_floor',
    containerId: 'game_store',
    localPosition: { x: -32, y: 0, z: -12 },
    displayRadius: 5,
    color: '#38bdf8',
    discovered: true,
    description: 'Original Ark story and world cartridges.'
  },
  local_import_shelf: {
    id: 'local_import_shelf',
    name: 'Local PC Import Shelf',
    type: 'shelf',
    layer: 'interior',
    parentId: 'store_floor',
    containerId: 'game_store',
    localPosition: { x: 0, y: 0, z: -26 },
    displayRadius: 5,
    color: '#f97316',
    discovered: true,
    description: 'Adaptive Cartridge concept shelf. Future browser picker lets user choose local owned files or folders.'
  },
  test_cartridge: {
    id: 'test_cartridge',
    name: 'Test Cartridge',
    type: 'cartridge',
    layer: 'interior',
    parentId: 'store_floor',
    containerId: 'game_store',
    enterContainerId: 'test_cartridge_world',
    localPosition: { x: 32, y: 0, z: -12 },
    displayRadius: 5,
    color: '#c084fc',
    discovered: true,
    description: 'First bootable demo cartridge. Enter it to prove cartridge runtime traversal.'
  },
  hidden_cartridge: {
    id: 'hidden_cartridge',
    name: 'Hidden Debug Cartridge',
    type: 'cartridge',
    layer: 'interior',
    parentId: 'store_floor',
    containerId: 'game_store',
    enterContainerId: 'test_cartridge_world',
    localPosition: { x: 0, y: 0, z: 28 },
    displayRadius: 4,
    color: '#fb7185',
    discovered: false,
    description: 'Unlocked by the Live World Director after the Debug Terminal hack event.'
  },
  cartridge_runtime_core: {
    id: 'cartridge_runtime_core',
    name: 'Demo Runtime Core',
    type: 'cartridge',
    layer: 'runtime',
    parentId: 'test_cartridge',
    containerId: 'test_cartridge_world',
    localPosition: { x: 0, y: 0, z: 0 },
    displayRadius: 12,
    color: '#c084fc',
    discovered: true,
    description: 'A mounted cartridge runtime. This proves the recursive console can enter and exit a game world.'
  },
  demo_enemy: {
    id: 'demo_enemy',
    name: 'Training Daemon',
    type: 'anomaly',
    layer: 'runtime',
    parentId: 'cartridge_runtime_core',
    containerId: 'test_cartridge_world',
    localPosition: { x: 34, y: 0, z: -8 },
    displayRadius: 5,
    color: '#ef4444',
    discovered: true,
    description: 'Live-service enemy placeholder. Later this becomes a state-machine encounter.'
  },
  demo_reward: {
    id: 'demo_reward',
    name: 'Memory Reward',
    type: 'portal',
    layer: 'runtime',
    parentId: 'cartridge_runtime_core',
    containerId: 'test_cartridge_world',
    localPosition: { x: -34, y: 0, z: -8 },
    displayRadius: 5,
    color: '#22c55e',
    discovered: true,
    description: 'Completing a cartridge can write a persistent memory back to Avatar Core.'
  }
};

const containers: Record<string, QDSMContainer> = {
  ship_bridge: {
    id: 'ship_bridge',
    name: 'Ark Vessel Bridge',
    layer: 'ship',
    originNodeId: 'ark_vessel',
    parentContainerId: null,
    parentNodeId: null,
    visibleNodeIds: ['ark_vessel', 'nav_console', 'avatar_core_terminal', 'cartridge_rack'],
    cameraPosition: new THREE.Vector3(0, 58, 118),
    cameraTarget: new THREE.Vector3(0, 0, 0),
    scaleNote: 'Ship container. This is the player boot environment and recursive vessel root.'
  },
  sol_system: {
    id: 'sol_system',
    name: 'Sol System',
    layer: 'system',
    originNodeId: 'sol_sun',
    parentContainerId: 'ship_bridge',
    parentNodeId: 'nav_console',
    visibleNodeIds: ['sol_sun', 'sol_earth', 'sol_mars', 'outer_belt_signal_001', 'anomaly_773'],
    cameraPosition: new THREE.Vector3(40, 120, 330),
    cameraTarget: new THREE.Vector3(86, 0, 32),
    scaleNote: 'Sun-anchored system container. Moons and hubs are collapsed into local containers.'
  },
  earth_orbit: {
    id: 'earth_orbit',
    name: 'Earth Orbit',
    layer: 'orbit',
    originNodeId: 'earth_origin',
    parentContainerId: 'sol_system',
    parentNodeId: 'sol_earth',
    visibleNodeIds: ['earth_origin', 'sol_moon', 'ark_orbital_hub', 'atmosphere_gate_earth', 'sun_parent_reference'],
    cameraPosition: new THREE.Vector3(24, 58, 128),
    cameraTarget: new THREE.Vector3(8, 0, 0),
    scaleNote: 'Earth-anchored orbit container. Moon and station are local to Earth.'
  },
  orbital_hub: {
    id: 'orbital_hub',
    name: 'Ark Orbital Hub',
    layer: 'hub',
    originNodeId: 'hub_core',
    parentContainerId: 'earth_orbit',
    parentNodeId: 'ark_orbital_hub',
    visibleNodeIds: ['hub_core', 'avatar_bay_node', 'shuttle_gate', 'hub_cartridge_kiosk'],
    cameraPosition: new THREE.Vector3(0, 62, 122),
    cameraTarget: new THREE.Vector3(0, 0, -8),
    scaleNote: 'Orbital service hub. Avatar launch and cartridge access are staged here.'
  },
  avatar_bay: {
    id: 'avatar_bay',
    name: 'Avatar Bay',
    layer: 'interior',
    originNodeId: 'avatar_pod',
    parentContainerId: 'orbital_hub',
    parentNodeId: 'avatar_bay_node',
    visibleNodeIds: ['avatar_pod', 'loadout_terminal', 'launch_cradle'],
    cameraPosition: new THREE.Vector3(0, 45, 88),
    cameraTarget: new THREE.Vector3(0, 0, -6),
    scaleNote: 'Avatar preparation container. Launch Avatar loads the Earth Beta district.'
  },
  earth_district: {
    id: 'earth_district',
    name: 'Earth Beta District',
    layer: 'surface',
    originNodeId: 'earth_landing_pad',
    parentContainerId: 'earth_orbit',
    parentNodeId: 'atmosphere_gate_earth',
    visibleNodeIds: ['earth_landing_pad', 'game_store_building', 'training_zone', 'debug_terminal'],
    cameraPosition: new THREE.Vector3(0, 70, 112),
    cameraTarget: new THREE.Vector3(0, 0, -8),
    scaleNote: 'Ground beta container. This is the first GTA-style city block test surface.'
  },
  game_store: {
    id: 'game_store',
    name: 'Game Store',
    layer: 'interior',
    originNodeId: 'store_floor',
    parentContainerId: 'earth_district',
    parentNodeId: 'game_store_building',
    visibleNodeIds: ['store_floor', 'ark_originals_shelf', 'local_import_shelf', 'test_cartridge', 'hidden_cartridge'],
    cameraPosition: new THREE.Vector3(0, 48, 88),
    cameraTarget: new THREE.Vector3(0, 0, -6),
    scaleNote: 'Cartridge store container. Shelves represent original, imported, and hidden runtime packages.'
  },
  test_cartridge_world: {
    id: 'test_cartridge_world',
    name: 'Test Cartridge Runtime',
    layer: 'runtime',
    originNodeId: 'cartridge_runtime_core',
    parentContainerId: 'game_store',
    parentNodeId: 'test_cartridge',
    visibleNodeIds: ['cartridge_runtime_core', 'demo_enemy', 'demo_reward'],
    cameraPosition: new THREE.Vector3(0, 54, 102),
    cameraTarget: new THREE.Vector3(0, 0, -4),
    scaleNote: 'Mounted game runtime container. Exit returns to the Game Store shelf layer.'
  }
};

const worldFlags: Record<string, WorldFlag> = {
  avatarLinked: { id: 'avatarLinked', label: 'Avatar Core linked', active: true },
  earthLaunchReady: { id: 'earthLaunchReady', label: 'Earth launch authorised', active: false },
  outerSignalScanned: { id: 'outerSignalScanned', label: 'Outer Belt signal scanned', active: false },
  debugShelfUnlocked: { id: 'debugShelfUnlocked', label: 'Hidden cartridge shelf unlocked', active: false },
  testCartridgeBooted: { id: 'testCartridgeBooted', label: 'Test cartridge booted', active: false }
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App container not found');

app.innerHTML = `
  <div class="layout">
    <aside class="panel">
      <section class="panel-section boot-section">
        <p class="eyebrow">ARK NAVIGATION OS // BETA</p>
        <h1 id="boot-title">ARK NAVIGATION OS</h1>
        <p id="boot-phrase" class="boot-phrase"></p>
        <ol id="boot-lines" class="boot-lines"></ol>
      </section>

      <section class="panel-section command-deck">
        <p class="eyebrow">COMMAND DECK</p>
        <div class="button-grid">
          <button id="scan-button" type="button">SCAN / DIRECTOR</button>
          <button id="route-button" type="button">PLOT ROUTE</button>
          <button id="focus-button" type="button">FOCUS NODE</button>
          <button id="reset-button" type="button">RESET VIEW</button>
          <button id="enter-button" type="button">ENTER NODE</button>
          <button id="back-button" type="button">BACK / PARENT</button>
          <button id="launch-button" type="button">LAUNCH AVATAR</button>
          <button id="interact-button" type="button">INTERACT</button>
          <button id="hack-button" type="button">HACK / INSPECT</button>
          <button id="build-button" type="button">BUILD / MOD</button>
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

      <section class="panel-section director-section">
        <p class="eyebrow">LIVE WORLD DIRECTOR</p>
        <div id="director-state" class="system-status"></div>
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
        <div class="hud-item"><strong>Mode:</strong> Recursive Beta</div>
        <div class="hud-item"><strong>Container:</strong> <span id="hud-container">Ship</span></div>
        <div class="hud-item"><strong>Path:</strong> <span id="hud-path">Ship</span></div>
        <div class="hud-item"><strong>Runtime:</strong> <span id="hud-source">Fallback</span></div>
        <div class="hud-item"><strong>Visible Nodes:</strong> <span id="hud-count">0</span></div>
        <div class="hud-item"><strong>Selected Node:</strong> <span id="hud-selected">None</span></div>
        <div class="hud-item control-hint"><strong>Controls:</strong> drag rotate / wheel zoom / tap node / enter / back / launch avatar</div>
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
const directorState = document.querySelector<HTMLDivElement>('#director-state')!;
const scanButton = document.querySelector<HTMLButtonElement>('#scan-button')!;
const routeButton = document.querySelector<HTMLButtonElement>('#route-button')!;
const focusButton = document.querySelector<HTMLButtonElement>('#focus-button')!;
const resetButton = document.querySelector<HTMLButtonElement>('#reset-button')!;
const enterButton = document.querySelector<HTMLButtonElement>('#enter-button')!;
const backButton = document.querySelector<HTMLButtonElement>('#back-button')!;
const launchButton = document.querySelector<HTMLButtonElement>('#launch-button')!;
const interactButton = document.querySelector<HTMLButtonElement>('#interact-button')!;
const hackButton = document.querySelector<HTMLButtonElement>('#hack-button')!;
const buildButton = document.querySelector<HTMLButtonElement>('#build-button')!;
const nodeName = document.querySelector<HTMLElement>('#node-name')!;
const nodeType = document.querySelector<HTMLElement>('#node-type')!;
const nodeStatus = document.querySelector<HTMLElement>('#node-status')!;
const nodeSector = document.querySelector<HTMLElement>('#node-sector')!;
const nodeCoordinates = document.querySelector<HTMLElement>('#node-coordinates')!;
const nodeDescription = document.querySelector<HTMLElement>('#node-description')!;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#020617');
scene.fog = new THREE.FogExp2('#020617', 0.0028);

const camera = new THREE.PerspectiveCamera(70, viewport.clientWidth / viewport.clientHeight, 0.1, 6000);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewport.clientWidth, viewport.clientHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = true;
controls.panSpeed = 0.65;
controls.rotateSpeed = 0.62;
controls.zoomSpeed = 0.9;
controls.minDistance = 10;
controls.maxDistance = 900;

scene.add(new THREE.HemisphereLight(0x9fb7ff, 0x050816, 0.9));
scene.add(new THREE.AmbientLight(0x4f7cff, 0.18));
const keyLight = new THREE.PointLight(0xfff2cc, 3.8, 1800);
keyLight.position.set(0, 60, 0);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x67e8f9, 1.2);
rimLight.position.set(-80, 100, 140);
scene.add(rimLight);

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
let currentContainerId = 'ship_bridge';
let currentOriginNode: QDSMNode = nodeLibrary.ark_vessel;
let activeRoute: THREE.Line | null = null;
let sourceMode: 'API' | 'Fallback' = 'Fallback';
let pointerStart: { x: number; y: number } | null = null;
let autopilotActive = false;
let desiredCameraPosition = containers.ship_bridge.cameraPosition.clone();
let lookTarget = containers.ship_bridge.cameraTarget.clone();
let builtModCount = 0;

const formatTime = (): string => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const addEvent = (message: string): void => {
  runtimeEvents.unshift({ time: formatTime(), message });
  runtimeEvents.splice(10);
  eventLog.innerHTML = runtimeEvents
    .map((event) => `<div class="event-row"><span>${event.time}</span><p>${event.message}</p></div>`)
    .join('');
};

const renderDirectorState = (): void => {
  directorState.innerHTML = Object.values(worldFlags)
    .map((flag) => `<div class="status-row ${flag.active ? 'status-on' : 'status-off'}"><span>${flag.active ? 'ONLINE' : 'LOCKED'}</span><p>${flag.label}</p></div>`)
    .join('');
};

const setFlag = (id: keyof typeof worldFlags, active = true): void => {
  worldFlags[id].active = active;
  renderDirectorState();
};

const toScenePosition = (node: QDSMNode): THREE.Vector3 => new THREE.Vector3(node.localPosition.x, node.localPosition.y, node.localPosition.z);
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
  const starCount = 1800;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    const radius = 520 + Math.random() * 1200;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xc7d2fe, size: 1.35, sizeAttenuation: true, transparent: true, opacity: 0.92 });
  scene.add(new THREE.Points(geometry, material));
};

const loadBoot = async (): Promise<BootSequence> => {
  try {
    const bootRes = await fetch(`${API_BASE_URL}/boot/sequence`);
    if (!bootRes.ok) throw new Error('API response invalid');
    sourceMode = 'API';
    const apiBoot = (await bootRes.json()) as BootSequence;
    return { ...fallbackBoot, title: apiBoot.title ?? fallbackBoot.title };
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

const createGlowShell = (node: QDSMNode, position: THREE.Vector3): void => {
  if (!['star', 'planet', 'gate', 'signal', 'anomaly', 'portal', 'cartridge'].includes(node.type)) return;
  const geometry = new THREE.SphereGeometry(node.displayRadius * 1.22, 32, 32);
  const material = new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: node.type === 'star' ? 0.18 : 0.1, side: THREE.BackSide });
  const shell = new THREE.Mesh(geometry, material);
  shell.position.copy(position);
  contentGroup.add(shell);
};

const createSurfaceGrid = (): void => {
  if (!['surface', 'hub', 'interior', 'runtime', 'ship'].includes(getCurrentContainer().layer)) return;
  const grid = new THREE.GridHelper(110, 22, 0x22d3ee, 0x1e3a5f);
  grid.position.y = -1.5;
  const material = grid.material;
  if (!Array.isArray(material)) {
    material.transparent = true;
    material.opacity = 0.28;
  }
  contentGroup.add(grid);
};

const createOrbitRing = (node: QDSMNode): void => {
  const current = getCurrentContainer();
  if (node.id === current.originNodeId || ['reference', 'room', 'building', 'console', 'shelf', 'avatar', 'cartridge'].includes(node.type)) return;
  const position = toScenePosition(node);
  const radius = Math.sqrt(position.x ** 2 + position.z ** 2);
  if (radius < 1) return;
  const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2, false, 0);
  const points = curve.getPoints(160).map((point) => new THREE.Vector3(point.x, 0, point.y));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0x1f3b64, transparent: true, opacity: 0.35 });
  contentGroup.add(new THREE.LineLoop(geometry, material));
};

const createGeometryForNode = (node: QDSMNode): THREE.BufferGeometry => {
  switch (node.type) {
    case 'ship':
      return new THREE.ConeGeometry(node.displayRadius, node.displayRadius * 2.4, 4);
    case 'station':
      return new THREE.TorusGeometry(node.displayRadius, Math.max(1, node.displayRadius * 0.18), 16, 64);
    case 'console':
    case 'building':
    case 'shelf':
      return new THREE.BoxGeometry(node.displayRadius * 1.8, node.displayRadius * 1.1, node.displayRadius * 1.4);
    case 'avatar':
      return new THREE.CapsuleGeometry(node.displayRadius * 0.45, node.displayRadius * 1.35, 8, 16);
    case 'gate':
    case 'portal':
      return new THREE.TorusGeometry(node.displayRadius, Math.max(0.7, node.displayRadius * 0.12), 16, 64);
    case 'cartridge':
      return new THREE.BoxGeometry(node.displayRadius * 1.2, node.displayRadius * 1.8, node.displayRadius * 0.35);
    case 'city':
      return new THREE.CylinderGeometry(node.displayRadius, node.displayRadius * 1.2, node.displayRadius * 0.45, 6);
    default:
      return new THREE.SphereGeometry(node.displayRadius, 36, 36);
  }
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

const visibleNodesForCurrentContainer = (): QDSMNode[] => {
  const current = getCurrentContainer();
  return current.visibleNodeIds
    .map((nodeId) => nodeLibrary[nodeId])
    .filter((node) => node.discovered || node.id === 'hidden_cartridge' ? worldFlags.debugShelfUnlocked.active || node.id !== 'hidden_cartridge' : true);
};

const renderNavLibrary = (): void => {
  navLibrary.innerHTML = '';
  for (const node of visibleNodesForCurrentContainer()) {
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
  createSurfaceGrid();

  for (const node of visibleNodesForCurrentContainer()) {
    createOrbitRing(node);
    const geometry = createGeometryForNode(node);
    const material = new THREE.MeshStandardMaterial({
      color: node.color,
      emissive: ['star', 'signal', 'anomaly', 'gate', 'portal', 'cartridge'].includes(node.type) ? node.color : '#000000',
      emissiveIntensity: node.type === 'star' ? 1.25 : node.type === 'reference' ? 0.7 : ['gate', 'portal', 'signal', 'anomaly', 'cartridge'].includes(node.type) ? 0.55 : 0.12,
      roughness: ['moon', 'building', 'shelf', 'console'].includes(node.type) ? 0.82 : 0.48,
      metalness: ['ship', 'station', 'console', 'cartridge'].includes(node.type) ? 0.42 : 0.08,
      wireframe: ['anomaly', 'signal', 'gate', 'reference', 'portal'].includes(node.type)
    });
    const mesh = new THREE.Mesh(geometry, material);
    const position = toScenePosition(node);
    mesh.position.copy(position);
    mesh.userData.rotationSpeed = 0.002 + Math.random() * 0.01;
    meshToNode.set(mesh, node);
    meshToLabel.set(mesh, { node, label: createNodeLabel(node) });
    contentGroup.add(mesh);
    createGlowShell(node, position);
  }

  hudContainer.textContent = container.name;
  hudPath.textContent = getContainerPath(container.id);
  hudCount.textContent = String(visibleNodesForCurrentContainer().length);
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
  nodeDescription.textContent = node.actionHint ? `${node.description} ${node.actionHint}` : node.description;
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
  if (selectedNode.id === 'test_cartridge' || selectedNode.id === 'hidden_cartridge') setFlag('testCartridgeBooted');
  renderContainer(selectedNode.enterContainerId);
};

const enterParentContainer = (): void => {
  const current = getCurrentContainer();
  if (!current.parentContainerId) {
    addEvent('QDSM back rejected: already at root ship container.');
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

const runDirector = (action: ActionId): void => {
  const node = selectedNode;

  if (action === 'scan') {
    createScanPulse();
    if (node?.id === 'outer_belt_signal_001') {
      setFlag('outerSignalScanned');
      nodeLibrary.anomaly_773.discovered = true;
      addEvent('DIRECTOR unique scenario primed: Outer Belt Anomaly is now discoverable.');
      renderContainer(currentContainerId);
    } else {
      addEvent('DIRECTOR scan complete: no unique scenario threshold crossed.');
    }
  }

  if (action === 'launchAvatar') {
    const launchable = node?.id === 'sol_earth' || node?.id === 'earth_origin' || node?.id === 'atmosphere_gate_earth' || node?.id === 'shuttle_gate' || node?.id === 'launch_cradle';
    if (!launchable) {
      addEvent('AVATAR launch rejected: select Earth, Atmosphere Gate, Shuttle Gate, or Launch Cradle.');
      return;
    }
    setFlag('earthLaunchReady');
    addEvent('AVATAR launch authorised. Shuttle sequence transferring to Earth Beta District.');
    renderContainer('earth_district');
  }

  if (action === 'interact') {
    if (!node) {
      addEvent('INTERACT rejected: no selected node.');
      return;
    }
    if (node.enterContainerId) {
      addEvent(`INTERACT accepted: opening ${node.name}.`);
      enterSelectedNode();
      return;
    }
    if (node.id === 'local_import_shelf') {
      addEvent('ADAPTIVE CARTRIDGE: local import requires a browser file picker in the next implementation pass.');
      return;
    }
    if (node.id === 'demo_reward') {
      addEvent('AVATAR MEMORY recorded: Test Cartridge traversal complete.');
      return;
    }
    addEvent(`INTERACT: ${node.name} inspected. No deeper container attached yet.`);
  }

  if (action === 'hack') {
    if (node?.id === 'debug_terminal') {
      setFlag('debugShelfUnlocked');
      nodeLibrary.hidden_cartridge.discovered = true;
      addEvent('HACK successful: hidden debug cartridge shelf unlocked in the Game Store.');
      return;
    }
    if (node?.id === 'local_import_shelf') {
      addEvent('HACK/INSPECT: import shelf manifest surface found. Future patch will use file picker and cartridge manifest scanner.');
      return;
    }
    addEvent('HACK/INSPECT complete: no vulnerable or inspectable surface found on selected node.');
  }

  if (action === 'build') {
    if (!['ship_bridge', 'orbital_hub', 'earth_district', 'game_store'].includes(currentContainerId)) {
      addEvent('BUILD rejected: current container does not allow placement yet.');
      return;
    }
    builtModCount += 1;
    const id = `mod_node_${builtModCount}`;
    nodeLibrary[id] = {
      id,
      name: `Placed Mod ${builtModCount}`,
      type: 'console',
      layer: getCurrentContainer().layer,
      parentId: currentOriginNode.id,
      containerId: currentContainerId,
      localPosition: { x: -44 + builtModCount * 12, y: 0, z: 38 },
      displayRadius: 3.2,
      color: '#34d399',
      discovered: true,
      description: 'Fallout-style build placeholder. This object persists until page reload in the current prototype.'
    };
    getCurrentContainer().visibleNodeIds.push(id);
    addEvent(`BUILD/MOD placed ${nodeLibrary[id].name} inside ${getCurrentContainer().name}.`);
    renderContainer(currentContainerId);
  }
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

scanButton.addEventListener('click', () => runDirector('scan'));
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
launchButton.addEventListener('click', () => runDirector('launchAvatar'));
interactButton.addEventListener('click', () => runDirector('interact'));
hackButton.addEventListener('click', () => runDirector('hack'));
buildButton.addEventListener('click', () => runDirector('build'));

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
  renderDirectorState();
  const boot = await loadBoot();
  renderBoot(boot);
  renderContainer('ship_bridge');
  addEvent(`CORE console online via ${sourceMode} data.`);
  addEvent('QDSM online: recursive containers enabled from ship to cartridge runtime.');
  addEvent('DIRECTOR online: scan, hack, build, launch, and cartridge events armed.');
  animate();
};

void init();
