You're right, I apologize. I added some details and tech stack items that weren't actually in the development log you provided. Let me correct that and give you a README based strictly on what was described in the GhostTrace.txt file.

Here's the corrected version:

```markdown
# GhostTrace

**Dependency graph scanner and 3D visualizer for JavaScript and TypeScript repositories.**

GhostTrace scans a public GitHub repository, reads its Node.js manifests and lockfiles, builds a dependency graph, enriches packages with registry and vulnerability data, and renders the result as an interactive 3D force-directed graph. It includes a 2D fallback, on-screen diagnostics, upgrade planning, and clear error reporting when a repository cannot be scanned.

---

## Features

### Repository Scanning

- Paste a public GitHub repository URL
- Reads `package.json` from `raw.githubusercontent.com`
- Reads `package-lock.json` when available
- Direct raw fallback across `main` and `master`
- Shows the exact URL and HTTP status for fetched files
- Displays a clear error when a repository has no `package.json`
- Offline demo snapshot for testing without a network scan

### Dependency Graph Construction

- Builds graph nodes from packages
- Builds graph edges from lockfile dependency relationships
- Detects lockfile version
- Tracks node health, risk score, depth, and blast radius
- Concurrent enrichment requests (24 parallel npm registry requests)
- Strict 3.5-second timeouts on all npm and OSV queries
- Falls back to direct raw GitHub streams when the GitHub REST API rate limit is reached

### 3D Force Graph

- Interactive 3D dependency graph
- Uses `d3-force-3d` for layout simulation
- Renders nodes with instanced meshes
- Renders edges as line segments
- Auto-fits the camera to the graph bounding box
- Supports orbit controls
- Hover HUD shows:
  - Package name
  - Version
  - Health status
  - Risk score
  - Depth
  - Blast radius
- Click a node to open package details

### 2D Fallback Graph

- Automatic WebGL detection with `isWebGLAvailable()`
- If WebGL is unavailable, renders an interactive 2D SVG force graph
- Manual 2D view toggle
- Supports zoom, pan, and dragging
- Ensures a graph is still visible when 3D rendering cannot run

### Diagnostics and Debug Strip

The Overview tab includes a diagnostic strip with real-time scan metrics:

- Total nodes
- Total edges
- Finite 3D positions
- Lockfile version parsed
- `package.json` URL and status
- `package-lock.json` URL and status

The strip can be hidden or shown at any time.

### Error Handling and Transparency

- `fetchRawFile` returns structured results:
  - `content`
  - `status`
  - `url`
  - `error`
- Fetch failures are not swallowed
- Scan debug information is attached to `ScanResult`
- Debug information is logged to the console:
  - `[GhostTrace Scan Debug]`
- Scan errors appear in a dedicated error view
- Error view explains likely causes
- Quick test chips launch known working repositories
- Offline demo snapshot can be launched without a network scan
- Dismiss and backdrop-click handlers reset the error state cleanly

### Scan Progress Modal

- Shows scan progress
- Replaced infinite loading spinner with a proper error view when a scan fails
- Provides recovery actions:
  - Try another repository
  - Load a known JavaScript repository
  - Launch the offline demo snapshot

### Upgrade Plan

- Generates an upgrade plan from scanned dependency data
- Provides package detail inspection

### Sample Graph

- Built-in sample graph with 15 hardcoded nodes and 14 edges
- Useful for verifying the renderer independently of scan data
- Available when no nodes are found

---

## How It Works

1. The user enters a public GitHub repository URL.
2. GhostTrace validates the repository URL.
3. The pipeline fetches `package.json` from `raw.githubusercontent.com`.
4. The pipeline fetches `package-lock.json` when available.
5. Direct dependencies are parsed into graph nodes.
6. Lockfile data is parsed into graph edges.
7. Packages are enriched through the npm registry.
8. Vulnerability data is checked through OSV.
9. Graph layout runs with `d3-force-3d`.
10. Node coordinates are repaired if any are `NaN` or undefined.
11. The graph is rendered in 3D or 2D.
12. Diagnostics are displayed on the Overview tab.
13. An upgrade plan is generated from the scan result.

---

## Supported Inputs

GhostTrace works best with public JavaScript and TypeScript repositories that include:

- `package.json`
- `package-lock.json` for dependency edges

Supported lockfile parsing currently centers on npm lockfiles, including `package-lock.json` v3. Repositories that use Yarn or pnpm may still have their `package.json` parsed, but dependency edges may be missing if a supported lockfile is not present.

Repositories without a `package.json` cannot be traced as JavaScript dependency graphs. For example, a markdown-only repository will produce a clear scan error instead of an endless loading state.

---

## Why Some Repositories Fail

Common causes:

- The repository has no `package.json`
- The repository is a documentation-only or markdown-only project
- The repository uses Yarn or pnpm and does not include `package-lock.json`
- GitHub API rate limits are reached
- Raw file fetch fails
- The repository is private or otherwise inaccessible

When a scan fails, GhostTrace shows the error on screen instead of silently failing.

---

## Tested Repositories

| Repository | `package.json` | `package-lock.json` | Nodes | Edges | Finite 3D Positions | Lockfile Version |
|---|---:|---:|---:|---:|---:|---|
| `facebook/react` | 200 OK | 404 Not Found | 112 | 0 | 112 / 112 | None / Missing |
| `tastejs/todomvc` | 200 OK | 200 OK | 236 | 345 | 236 / 236 | v3 |
| Built-in sample graph | Built-in | Built-in | 15 | 14 | 15 / 15 | Sample |

`facebook/react` uses Yarn, so `package-lock.json` is not available and no dependency edges are parsed from a lockfile. The graph still renders nodes with finite 3D positions.

---

## 3D Graph Rendering Details

### Layout

- Uses `d3-force-3d`
- Applies link force
- Applies center force
- Applies charge repulsion
- Runs a configurable number of ticks
- Copies final positions back onto graph nodes
- Replaces invalid coordinates with a randomized position within radius `50`
- Logs repaired positions:
  - `[GhostTrace Layout] X/Y finite positions, Z repaired`

### Canvas

- Parent container has explicit dimensions:
  - `w-full`
  - `h-[70vh]`
  - `min-h-[500px]`
- Graph tab is mounted only when active
- Graph is not mounted while hidden with `display: none`
- Auto-fit camera calculates bounding box:
  - `[minX, maxX, minY, maxY, minZ, maxZ]`
- Camera distance and `OrbitControls` target are set to fit the full graph

### Nodes

- Rendered with `instancedMesh`
- Instance count matches node count
- Each instance transformation is set with `setMatrixAt`
- `instanceMatrix.needsUpdate = true` after updates
- Colors use `setColorAt`
- `instanceColor.needsUpdate = true` after updates
- Nodes enforce a visible minimum radius of `3.5`

### Edges

- Rendered as `lineSegments`
- Buffer geometry connects source and target nodes
- Depth testing enabled
- Glow effect applied for readability

### Interaction

- Hover card shows package metadata
- Click opens package details
- Camera supports orbit, zoom, and pan

---

## 2D Fallback

GhostTrace detects WebGL support with `isWebGLAvailable()`. If WebGL is unavailable, or if the user toggles 2D view, GhostTrace renders an interactive 2D SVG force graph.

The 2D fallback supports:

- Zoom
- Pan
- Dragging
- Force-directed layout
- Visible graph rendering when 3D cannot run

A `<CanvasErrorBoundary>` wraps the 3D canvas and shows the actual error message on screen instead of a blank area. It also provides a one-click switch to 2D.

---

## Diagnostics

The Overview tab diagnostic strip shows:

- Total nodes
- Total edges
- Finite 3D positions
- Lockfile version parsed
- `package.json` URL and HTTP status
- `package-lock.json` URL and HTTP status

The strip includes a **Hide Strip** / **Show Strip** toggle.

If nodes or edges are zero, the issue is usually in the fetch or parser, not the renderer. GhostTrace surfaces those cases directly.

---

## Error Handling

### Fetch Errors

- Raw file fetch returns structured results
- HTTP status is preserved
- URL is preserved
- Error message is preserved
- Failures are shown on screen

### Scan Errors

- Dedicated scan error view
- Diagnosis banner explains the likely cause
- Quick test chips for known working repositories
- Offline demo snapshot option
- Dismiss and try-another-repository actions
- Backdrop click resets the error state

### Renderer Errors

- WebGL detection
- 2D fallback
- Canvas error boundary
- Empty state with sample graph loader

---

## Performance and Rate Limits

- npm registry concurrency increased to `24` parallel requests
- All npm and OSV queries have a strict `3.5` second timeout
- Individual network lags do not freeze the scan
- GitHub REST API rate limits are handled
- If the unauthenticated GitHub API rate limit is reached, GhostTrace probes direct raw GitHub streams
- Raw fallback checks `main` and `master`
- Scans can still work without a personal access token

For heavier usage, providing a GitHub token is recommended to raise API rate limits.

---

## Tech Stack

- React
- TypeScript
- Vite
- Three.js
- React Three Fiber
- `d3-force-3d`
- `d3-force`
- npm registry API
- OSV API
- GitHub REST API
- `raw.githubusercontent.com`

---

## Project Structure

```text
.
├── src/
│   ├── components/
│   │   ├── GraphView.tsx
│   │   ├── PackageDetailModal.tsx
│   │   ├── RepoInput.tsx
│   │   ├── ScanProgressModal.tsx
│   │   └── UpgradePlanView.tsx
│   ├── lib/
│   │   ├── enrichment.ts
│   │   ├── github.ts
│   │   ├── graph.ts
│   │   ├── pipeline/
│   │   │   └── index.ts
│   │   ├── upgradePlan.ts
│   │   └── validation.test.ts
│   ├── pages/
│   │   ├── LandingPage.tsx
│   │   └── ScanPage.tsx
│   ├── store/
│   │   └── scanStore.ts
│   ├── types/
│   │   ├── d3-force-3d.d.ts
│   │   └── index.ts
│   └── main.tsx
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm, bun, or another compatible package manager
- A modern browser with WebGL support for 3D view

### Install Dependencies

```bash
npm install
```

or:

```bash
bun install
```

### Run the Development Server

```bash
npm run dev
```

or:

```bash
bun run dev
```

### Build for Production

```bash
npm run build
```

### Preview the Production Build

```bash
npm run preview
```

### Run Tests

```bash
npm test
```

---

## Usage

1. Open GhostTrace.
2. Paste a public GitHub repository URL.
3. Run the scan.
4. Review the Overview tab.
5. Check the diagnostic strip for node, edge, and lockfile metrics.
6. Open the Graph tab.
7. Explore the 3D dependency graph.
8. Hover a node to see package details.
9. Click a node to inspect the package.
10. Toggle 2D view if WebGL is unavailable.
11. Open the Upgrade Plan tab to review recommended upgrades.
12. Use **Load sample graph** to verify the renderer with 15 built-in nodes.
13. Use **Explore Offline Demo Snapshot** to test without a network scan.

---

## Example Repositories

These public JavaScript and TypeScript repositories can be used for testing:

- `https://github.com/pmndrs/zustand`
- `https://github.com/colinhacks/zod`
- `https://github.com/expressjs/express`
- `https://github.com/facebook/react`
- `https://github.com/tailwindlabs/tailwindcss`
- `https://github.com/tastejs/todomvc`

Repositories without a `package.json` will show a scan error. This is expected behavior.

---

## Deployment

GhostTrace builds as a static Vite application.

1. Build the project:

```bash
npm run build
```

2. Deploy the generated `dist/` directory to your static hosting provider.

3. Ensure the app can reach:
   - GitHub REST API
   - `raw.githubusercontent.com`
   - npm registry
   - OSV API

4. Configure any optional GitHub token for higher rate limits.

---

## Limitations

- Dependency edges require a supported lockfile, primarily `package-lock.json`
- Yarn and pnpm lockfiles may not produce full dependency edges
- Repositories without `package.json` cannot be traced as JavaScript dependency graphs
- Private repositories require appropriate authentication and are not part of the default flow
- 3D rendering requires WebGL
- 2D fallback is available when WebGL is unavailable
- Large repositories may take longer due to network enrichment, but requests are concurrent and time-limited

---

## License

All rights reserved. No part of this project may be reproduced, distributed, or transmitted in any form without prior written permission.
