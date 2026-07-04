---
name: automech
description: AI-driven mechanical engineering pipeline for autonomous CAD generation. Use when designing FDM-printable parts (brackets, mounts, enclosures), mechanical assemblies, or running structural/acoustic simulations. Handles LLM-driven procedural CAD generation via @jscad/modeling with automated manufacturing validation.
---

# Automech — AI-Driven Mechanical Engineering Pipeline

## What This Pipeline Does

Automech is a deterministic multi-agent pipeline that converts natural language descriptions into validated 3D-printable STL files. It uses DeepSeek for the LLM layer and `@jscad/modeling` for procedural CAD geometry.

**Architecture**: Architect (constraint parsing) → Draftsman (code generation) → Sandbox (execution) → Physicist (simulation) → Machinist (printability validation). The pipeline iterates up to 5 times, feeding validation flags from later nodes back to the Draftsman for correction.

## How to Invoke

All commands run from the project root.

### `npm run dev -- design "<prompt>"`

Full pipeline: parses the prompt into constraints, generates JSCAD code, executes it in a sandbox, validates physics and manufacturability, outputs STL.

```bash
npm run dev -- design "Build a mounting bracket for a 5mm rod with two M3 bolt holes, use PA-CF, 50x40x30mm"
```

### Other commands (stubs)

- `npm run dev -- simulate <stl>` — Not yet implemented
- `npm run dev -- validate <stl>` — Not yet implemented
- `npm run dev -- iterate <design-id>` — Not yet implemented

### Key Environment

- `DEEPSEEK_API_KEY` must be set in `.env`
- The pipeline runs locally (no Docker required; Docker sandbox is optional, auto-fallback)

## When to Use This Skill

Load this skill when the user:
- Asks to design a 3D-printable mechanical part
- Requests a CAD model from a text description
- Wants to iterate on a part using physical test data
- Needs manufacturing validation (overhangs, wall thickness, build volume)
- Asks about mechanical snap-fits, bolt patterns, or thermal insert geometries

## Supported Materials

| ID | Material | Tensile Strength | Max Strain | Max Overhang | Min Wall | Nozzle | Bed | Build Plate |
|----|----------|-----------------|------------|-------------|----------|--------|-----|-------------|
| PLA | Standard PLA | 50 MPa | 3% | 55° | 0.8mm | 210°C | 60°C | textured_pei |
| PETG | PETG (default) | 48 MPa | 5% | 50° | 1.0mm | 245°C | 80°C | textured_pei |
| PA-CF | Carbon-fiber nylon | 110 MPa | 1.5% | 40° | 1.2mm | 290°C | 90°C | engineering |
| TPU | Flexible TPU | 35 MPa | 60% | 35° | 1.2mm | 235°C | 40°C | smooth_pei |

### Material Shrinkage Compensation

Each material has shrinkage factors (`shrinkageXY`, `shrinkageZ`) and a `holeOffset` applied at CAD generation time — not at slicer time. This ensures internal tolerances remain accurate.

| Material | Shrinkage XY | Shrinkage Z | Hole Offset |
|----------|-------------|-------------|-------------|
| PLA | 0.3% | 0.5% | 0.10mm |
| PETG | 0.4% | 0.6% | 0.15mm |
| PA-CF | 0.2% | 0.3% | 0.05mm |
| TPU | 0.6% | 0.8% | 0.20mm |

## Clearance Profiles

Clearances (in mm) for press-fit, sliding-fit, loose-fit, and bearing-fit per material:

| Profile | pressFit | slidingFit | looseFit | bearingFit |
|---------|----------|------------|----------|------------|
| pla | 0.04 | 0.15 | 0.30 | 0.06 |
| petg | 0.08 | 0.25 | 0.50 | 0.12 |
| pa-cf | 0.03 | 0.12 | 0.25 | 0.05 |
| tpu | 0.15 | 0.35 | 0.60 | 0.20 |
| standard (fallback) | 0.05 | 0.20 | 0.40 | 0.08 |

## Hardware Registry (Available Fasteners)

| Key | Type | Thread | Clearance Radius | Head/Insert Details |
|-----|------|--------|-----------------|---------------------|
| M3_SOCKET_CAP | bolt | M3 | 1.65mm | head radius 2.85mm, depth 3.0mm |
| M3_HEAT_SET_SHORT | heat_set_insert | M3 | 2.0mm | depth 4.0mm, taper 4.0° |
| M3_HEAT_SET_LONG | heat_set_insert | M3 | 2.0mm | depth 6.0mm, taper 4.0° |
| M3_NUT | nut | M3 | 3.3mm | — |
| M4_SOCKET_CAP | bolt | M4 | 2.2mm | head radius 3.65mm, depth 4.0mm |
| M4_HEAT_SET_SHORT | heat_set_insert | M4 | 2.7mm | depth 5.0mm, taper 4.0° |
| M5_SOCKET_CAP | bolt | M5 | 2.7mm | head radius 4.35mm, depth 5.0mm |
| M5_HEAT_SET_SHORT | heat_set_insert | M5 | 3.3mm | depth 5.5mm, taper 4.0° |

## Snap-Fit Mechanics

Snap-fits use the cantilever beam deflection formula to compute safe beam length:

```
ε = (3 · y · t) / (2 · L²)
→ L = √((3 · y · t) / (2 · ε_max))
```

Where _y_ = deflection depth (hook undercut), _t_ = beam thickness, _L_ = beam length, ε_max = material max strain. A 10% safety factor is automatically added for FDM layer-line weaknesses. The `generateCantileverClip()` function in `src/geometry/snapfit.ts` produces the full JSCAD geometry.

## Pipeline Nodes

| Node | File | Role |
|------|------|------|
| **Architect** | `src/nodes/architect.ts` | Parses natural language into typed constraints (material, bounding box, fasteners, assembly type). Returns `clarificationNeeded[]` if dimensions are missing instead of hallucinating. |
| **Draftsman** | `src/nodes/draftsman.ts` | Generates procedural CAD code using `@jscad/modeling`. Must export a `design()` function returning a Geom3 object. No file I/O or network — pure geometry only. Receives failure flags from prior iterations as feedback. |
| **Physicist** | `src/nodes/physicist.ts` | Runs deterministic simulation (stub: currently always passes). Translates simulation failures into specific geometric directives (e.g., "Increase wall thickness at [X,Y,Z]"). |
| **Machinist** | `src/nodes/machinist.ts` | Validates overhangs (via STL face normal analysis), wall thickness, build volume (256×256×256mm Bambu P2S limit), and runs headless slicer checks if available. |
| **Technician** | `src/nodes/technician.ts` | Accepts physical bench-test data (`EmpiricalTestEvent`) and back-propagates calibration deltas (shrinkage, hole offset) into the material profile registry. Computes constraint updates for acoustic, impedance, and kinetic test failures. |
| **Sandbox Executor** | `src/sandbox/executor.ts` | Runs Draftsman code in a Docker container (no network, 512MB RAM, 1 CPU, 15s timeout) with automatic local Node.js fallback if Docker is unavailable. |

## Interpretation of Results

- **`completed`**: STL outputted to `/tmp/automech_runs/<runId>/output.stl`
- **`blocked`**: Architect needs clarification — show the user the `clarificationNeeded` questions
- **`max_iterations`** (5 iterations exhausted): Show the errors — the first few flags are the most actionable for re-prompting

## Constraints the Agent Should Enforce

1. Always specify dimensions in the prompt (bounding box `[x, y, z]` in mm)
2. Always specify the material (defaults to PETG if omitted by the user)
3. For bolted assemblies, specify which fasteners from the Hardware Registry to use
4. For snap-fit designs, material `maxStrain` governs beam length — PA-CF needs much longer beams than TPU
5. The Bambu Lab P2S build volume is 256×256×256mm — warn if user exceeds this
6. If a design requires wall thickness below the material's `minWallThickness`, flag it
7. If overhangs exceed the material's `maxOverhangDeg`, flag it
8. Never hallucinate fastener dimensions — always reference the Hardware Registry above
