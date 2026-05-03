import Fastify from 'fastify';
import cors from '@fastify/cors';

type UniverseNodeType = 'star' | 'planet' | 'moon' | 'anomaly' | 'signal';

interface UniverseNode {
  id: string;
  name: string;
  type: UniverseNodeType;
  sectorId: string;
  coordinates: { x: number; y: number; z: number };
  discovered: boolean;
  metadata: {
    color: string;
    radius: number;
    description: string;
  };
}

const bootSequence = {
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

const nodes: UniverseNode[] = [
  {
    id: 'sol_sun',
    name: 'Sun',
    type: 'star',
    sectorId: 'sol_sector',
    coordinates: { x: 0, y: 0, z: 0 },
    discovered: true,
    metadata: {
      color: '#ffd27a',
      radius: 4,
      description: 'Central star of the Sol system.'
    }
  },
  {
    id: 'sol_earth',
    name: 'Earth',
    type: 'planet',
    sectorId: 'sol_sector',
    coordinates: { x: 120, y: 0, z: 0 },
    discovered: true,
    metadata: {
      color: '#3b82f6',
      radius: 1,
      description: 'Home world.'
    }
  },
  {
    id: 'sol_moon',
    name: 'Moon',
    type: 'moon',
    sectorId: 'sol_sector',
    coordinates: { x: 126, y: 1, z: 0 },
    discovered: true,
    metadata: {
      color: '#d1d5db',
      radius: 0.3,
      description: "Earth's natural satellite."
    }
  },
  {
    id: 'sol_mars',
    name: 'Mars',
    type: 'planet',
    sectorId: 'sol_sector',
    coordinates: { x: 220, y: 0, z: 45 },
    discovered: true,
    metadata: {
      color: '#ff5533',
      radius: 0.8,
      description: 'Red planet in the Sol system.'
    }
  },
  {
    id: 'outer_belt_signal_001',
    name: 'Outer Belt Signal',
    type: 'signal',
    sectorId: 'sol_sector',
    coordinates: { x: 390, y: -18, z: 130 },
    discovered: false,
    metadata: {
      color: '#22d3ee',
      radius: 0.4,
      description: 'Repeating signal from the outer belt.'
    }
  },
  {
    id: 'anomaly_773',
    name: 'Outer Belt Anomaly',
    type: 'anomaly',
    sectorId: 'sol_sector',
    coordinates: { x: 420, y: -30, z: 160 },
    discovered: false,
    metadata: {
      color: '#a855f7',
      radius: 0.6,
      description: 'Unknown energy field detected beyond the inner planets.'
    }
  }
];

const fastify = Fastify({ logger: true });

await fastify.register(cors, { origin: true });

fastify.get('/health', async () => ({
  status: 'ok',
  name: 'Ark Navigation OS Runtime',
  version: '0.1.0'
}));

fastify.get('/boot/sequence', async () => bootSequence);

fastify.get('/universe/nodes', async () => ({ nodes }));

const start = async (): Promise<void> => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });

    console.log(`ARK NAVIGATION OS v0.1
NODE-POWERED VIRTUAL SHIP CONSOLE
BOOT SEQUENCE INITIATED

[CORE] Node runtime online
[NAV]  Sol Sector indexed
[LOG]  Runtime event stream opened

Darkness is not empty.
It is an address space.

ARK NAVIGATION OS READY`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};

await start();
