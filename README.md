# Ark Navigation OS

Ark Navigation OS is a Node-powered virtual console that can compile stories into memory cards, mount them into a runtime, and render them as playable 3D worlds.

## Current Status

This repository currently implements **v0.1 Runtime Console (smoke test only)**:
- Node/Fastify runtime API
- Official boot sequence endpoint
- Seeded Sol Sector nodes endpoint
- Browser cockpit built with Vite + TypeScript + Three.js
- GitHub Pages deployment pipeline for the browser console
- Static fallback data in the browser when API is offline

## Run the API (apps/api)

```bash
cd apps/api
npm install
npm run dev
```

## Test the API

```bash
curl http://localhost:3000/health
curl http://localhost:3000/boot/sequence
curl http://localhost:3000/universe/nodes
```

## Run the Browser Console (apps/console)

```bash
cd apps/console
npm install
npm run dev
```

By default, the console requests data from `http://localhost:3000`.
Set `VITE_API_BASE_URL` if you want to point to another API.

## GitHub Pages Deployment

GitHub Actions workflow: `.github/workflows/deploy-console.yml`

On every push to `main`, the workflow:
1. Installs dependencies in `apps/console`
2. Builds the Vite project
3. Uploads `apps/console/dist`
4. Deploys to GitHub Pages

> GitHub Pages only hosts the static browser console. It does **not** run the Node/Fastify API.
> In GitHub Pages, the console will use fallback data unless `VITE_API_BASE_URL` points to a publicly reachable **HTTPS** API.

## Roadmap

- **v0.1** Runtime Console
- **v0.2** Memory Card System
- **v0.3** Story Compiler
- **v0.4** World Forge
