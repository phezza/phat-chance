# NavDash - Marine Navigation Dashboard

## Overview

A marine navigation dashboard that connects to a Signal K server (e.g., Digital Yacht NavLink2) via WebSocket and displays live NMEA data from the onboard network.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS
- **Routing**: Wouter
- **API framework**: Express 5 (shared API server, not used by navdash)
- **Data source**: Signal K WebSocket (`/signalk/v1/stream?subscribe=all`)

## Artifacts

### navdash (main app, previewPath: `/`)
Located at `artifacts/navdash/`. Frontend-only React app connecting to Signal K.

**Pages:**
- `/` — Dashboard: Compass, speed gauges, wind rose, autopilot status, position
- `/charts` — Charts: Boat-centred map with toggleable layers (Dark/OSM base, OpenSeaMap seamarks, RainViewer precipitation radar, AIS overlay with CPA-coloured threat rings, persisted trail, true-wind compass widget, click-to-add waypoint route planner with distance/bearing/ETA legs) and a live instrument HUD overlay
- `/navigation` — Navigation: Heading, COG, leeway, depth, position
- `/wind` — Wind: Apparent/true speed+angle, Beaufort scale
- `/instruments` — Instruments: All gauges in a grid view
- `/ais` — AIS: Split list + live map with AIS targets (sorted by collision threat), boat marker, detail overlay with CPA/TCPA collision risk panel and threat-coloured marker rings
- `/tracking` — Tracking: Manual trip recorder (start/stop/clear) with stats
- `/track/:vesselId` — Public read-only tracker (consumes deployed api-server `/api/track/...`)
- `/autopilot` — Autopilot: heading/state controls (Signal K mode only)
- `/settings` — Settings: Signal K host/port config, raw data viewer, cloud uplink config

**Shared map helpers:**
- `src/lib/mapIcons.ts` — `makeBoatIcon`, `makeAISIcon` (with optional threat ring + pulse), `getAISShipColor`, `makeWaypointIcon`
- `src/lib/cpa.ts` — Closest Point of Approach (CPA/TCPA) calculation, threat classification (`none`/`info`/`caution`/`warning`/`danger`), and `fmtNm`/`fmtTcpa` formatters

**localStorage keys:**
- `navdash_charts_trail_v1` — boat trail breadcrumbs (max 1500 points)
- `navdash_charts_route_v1` — user-planned route waypoints

**Key files:**
- `src/lib/signalk.ts` — Signal K WebSocket client, data types, unit conversions
- `src/lib/SignalKContext.tsx` — React context provider for Signal K state
- `src/components/CompassRose.tsx` — Canvas compass rose with heading needle
- `src/components/GaugeRing.tsx` — Canvas arc gauge for speed/depth/wind
- `src/components/WindRose.tsx` — Canvas wind direction/speed polar display
- `src/components/DataTile.tsx` — Numeric data display tile
- `src/components/StatusBar.tsx` — Connection status indicator

## Signal K Connection

Default host: `192.168.1.1:3000` (Digital Yacht NavLink2 default)

Connects to: `ws://<host>:<port>/signalk/v1/stream?subscribe=all`

Configuration is stored in localStorage and editable from the Settings page.

## Key Commands

- `pnpm --filter @workspace/navdash run dev` — run dashboard locally
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Supported Signal K Paths

- `navigation.speedOverGround` — SOG
- `navigation.speedThroughWater` — STW
- `navigation.headingMagnetic` / `navigation.headingTrue`
- `navigation.courseOverGroundTrue` / `navigation.courseOverGroundMagnetic`
- `navigation.position` — GPS lat/lon
- `environment.wind.speedApparent` / `environment.wind.angleApparent`
- `environment.wind.speedTrue` / `environment.wind.angleTrueWater`
- `environment.depth.belowKeel` / `environment.depth.belowSurface`
- `environment.water.temperature`
- `steering.autopilot.state` / `steering.autopilot.target.headingMagnetic`
- `navigation.magneticVariation`, `navigation.trip.log`, `navigation.log`
- AIS vessel data from `vessels.urn:mrn:imo:mmsi:*` contexts
