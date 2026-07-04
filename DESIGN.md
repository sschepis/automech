Here is the formal technical design document synthesizing the architecture we just built.

---

# Technical Design Document: AI-Driven Mechanical Engineering Pipeline

## 1. System Overview

This system defines a deterministic, multi-agent pipeline for autonomous mechanical design. It bridges the gap between probabilistic Large Language Models (LLMs) and rigid physical constraints by enforcing a strict TypeScript orchestration layer.

By replacing spatial hallucination with math-driven procedural CAD and headless simulation loops, the system generates functional hardware—ranging from structural brackets to complex acoustic tuning stacks (e.g., polygonal air-intake assemblies)—optimized specifically for closed-coreXY FDM hardware like the Bambu Lab P2S using high-temperature engineering filaments (PA-CF).

## 2. Core Architecture: The Orchestration Loop

The pipeline operates as a typed state machine (a Directed Cyclic Graph) rather than an open-ended conversational agent swarm. A single source of truth, the `CADPipelineEvent` object, passes through specialized nodes.

### 2.1 The Shared State Interface

```typescript
interface CADPipelineEvent {
  iteration: number;
  globalConstraints: {
    maxBoundingBox: [number, number, number];
    materialProfile: MaterialProfile;
    targetPhysics?: any; // e.g., acoustic resonance targets, load limits
  };
  proceduralCode: string | null; 
  simulationResults: SimulationData | null;
  manufacturingFlags: string[]; 
}

```

### 2.2 Agent Node Definitions

* **The Architect (Initialization):** Parses the human intent and defines the strict numerical bounding boxes, physics targets, and material profiles.
* **The Draftsman (Generation):** A pure code-generation node. It writes procedural CAD logic in TypeScript to meet the Architect's parameters.
* **The Physicist (Simulation):** A hybrid execution/evaluation node. It compiles the CAD, runs headless deterministic solvers, and uses an LLM to translate mathematical failures into plain-English geometric feedback.
* **The Machinist (Manufacturing):** Evaluates the resulting mesh against physical fabrication constraints (overhangs, thin walls, build volume).

## 3. Procedural CAD Generation (The Draftsman)

To ensure structural typing and avoid syntax hallucinations from languages like OpenSCAD, the Draftsman operates entirely within TypeScript using functional programming (`@jscad/modeling`).

* **Interface-Driven Design:** The Draftsman is provided strict interfaces (e.g., `AcousticStackParams`) and must output a pure function returning a `Geom3` object.
* **Boolean Composition:** Geometry is constructed mathematically using standard primitives (cylinders, cubes) and boolean operations (union, subtract).
* **Pre-Compilation Checks:** Because the output is standard TypeScript, the orchestrator runs a lightweight compiler check before attempting any spatial rendering. Type failures are immediately routed back to the Draftsman.

## 4. Physics Validation (The Physicist)

This node acts as the sensory cortex of the pipeline, providing deterministic feedback on probabilistic designs.

* **Headless Execution:** The orchestrator writes the generated geometry to a temporary file and spawns a headless solver (e.g., an acoustic resonance solver, kinetic engine, or standard FEA) via Node's `child_process`.
* **Sandboxing:** Solver execution is wrapped in Docker containers with hard timeouts to prevent infinite geometry loops from crashing the orchestration server.
* **LLM Translation Layer:** Raw JSON outputs from the solver are passed to a strictly prompted LLM. This LLM acts as an interpreter, outputting specific geometric directives (e.g., "Decrease inner radius by 2mm to hit target resonance") to append to the state object for the Draftsman's next iteration.

## 5. Manufacturing Validation (The Machinist)

A mathematically perfect part must still survive the realities of FDM fabrication. This node ensures the geometry is printable before G-code is ever generated.

### 5.1 Direct Mesh Analysis (Math Checks)

The orchestrator parses the generated STL file to calculate face normal vectors. It instantly flags geometry containing unsupported overhangs exceeding material limits (e.g., >45 degrees for PA-CF) without spinning up a heavy slicing engine.

### 5.2 Headless Slicer Execution (Toolpath Checks)

For complex volume and extrusion checks, the pipeline integrates directly with a headless slicer CLI (e.g., Bambu Studio CLI). The Machinist parses the `stderr` output to detect:

* Features falling below the minimum safe wall thickness.
* Overall dimensions exceeding the 256x256x256mm build volume.
* Impossible bridging scenarios.

### 5.3 Upstream Thermal Shrinkage Compensation

Instead of relying on blanket slicer scaling—which crushes internal bearing tolerances and hardware holes—shrinkage is handled dynamically in the CAD generation layer.

* **Material Profiles:** Defined configuration objects store XY shrinkage, Z compression, and absolute hole-offset radii.
* **Wrapper Functions:** The Draftsman designs at the *ideal* dimensions using utility functions like `compensatedHole()`. The Orchestrator applies the `MaterialProfile` scaling matrix to the entire geometry just before STL export, ensuring perfect dimensional accuracy for high-temp polymers.

## 6. Error Handling & Context Management

To prevent LLM context window collapse during complex iterative loops, the pipeline enforces a **"diff-only" memory policy**. The Draftsman is never fed the entire history of failed scripts. It receives only the *current* failing code, the overarching constraints, and the specific failure flags from the Physicist and Machinist. Once the code passes both validation gates, the orchestrator outputs the final optimized model.

Here is the addition to the Technical Design Document, formalizing how the pipeline handles physical hardware integration.

---

## 7. Hardware Fastener Integration (The Hardware Library)

To support complex, multi-part modular assemblies (such as stacked mechanical housings or modular sensor mounts), the pipeline must handle physical fasteners deterministically. LLMs cannot be trusted to calculate the exact countersink depth, clearance diameter, or taper angle for an M3 socket head cap screw or a brass heat-set insert.

Instead of allowing the Draftsman to hallucinate hole dimensions, the architecture enforces a strictly typed **Hardware Library**.

### 7.1 The Typed Fastener Registry

The system maintains a centralized, hardcoded registry of physical hardware. This ensures that whenever the AI agent needs to join two parts, it calls upon pre-validated geometric parameters rather than generating raw numbers.

```typescript
export interface FastenerProfile {
  id: string;
  type: 'bolt' | 'heat_set_insert' | 'nut';
  threadSize: string;
  clearanceRadius: number;
  headRadius?: number;
  headDepth?: number;
  insertTaperAngle?: number; // Crucial for thermal inserts
  insertDepth?: number;
}

export const HARDWARE_REGISTRY: Record<string, FastenerProfile> = {
  M3_SOCKET_CAP: {
    id: 'm3_shcs',
    type: 'bolt',
    threadSize: 'M3',
    clearanceRadius: 1.65, // 3.3mm diameter for a loose fit
    headRadius: 2.85,      // 5.7mm diameter head
    headDepth: 3.0
  },
  M3_HEAT_SET_SHORT: {
    id: 'm3_insert_short',
    type: 'heat_set_insert',
    threadSize: 'M3',
    clearanceRadius: 2.0,  // 4.0mm pilot hole for thermal pressing
    insertDepth: 4.0,
    insertTaperAngle: 4.0  // Standard taper for thermoplastic flow
  }
};

```

### 7.2 Subtractive Boolean Tools ("Negative Space" Modeling)

The registry does not generate the solid bolts; it generates the **negative space** (the void) required to accept the hardware. The Hardware Library provides pure functions that return standard `Geom3` objects representing the exact empty volume needed for a flush fit.

For thermoplastic FDM printing (like PA-CF), heat-set inserts are the standard. The library generates the precise tapered pilot hole required for the brass insert to melt into the polymer securely, integrating the `MaterialProfile` shrinkage compensation upstream.

```typescript
import { primitives, transforms } from '@jscad/modeling';
import { MaterialProfile } from './material_profiles';
import { FastenerProfile } from './hardware_registry';

const { cylinder } = primitives;
const { translate } = transforms;

export function generateFastenerVoid(
  fastener: FastenerProfile, 
  depth: number, 
  material: MaterialProfile
) {
  // Calculates the physical void required, automatically adding the material's
  // specific shrinkage offset so the final printed hole is perfectly sized.
  const compensatedRadius = fastener.clearanceRadius + material.holeOffset;

  if (fastener.type === 'heat_set_insert') {
    // Generate a tapered cylinder for the heated brass insert
    return cylinder({
      radius: compensatedRadius,
      height: fastener.insertDepth,
      segments: 32
      // Additional logic for taper application would go here
    });
  }

  if (fastener.type === 'bolt') {
    // Generate a stacked cylinder for the bolt shaft and the countersunk head
    const shaft = cylinder({ radius: compensatedRadius, height: depth });
    const head = translate(
      [0, 0, depth / 2], 
      cylinder({ radius: fastener.headRadius! + material.holeOffset, height: fastener.headDepth! })
    );
    return booleans.union(shaft, head);
  }
}

```

### 7.3 Draftsman Implementation

By exposing this library to the Draftsman, the agent's cognitive load is vastly reduced. The Architect node simply instructs the Draftsman to "use M3 heat-set inserts to mount the flange."

The Draftsman then imports the registry and subtracts the pre-validated tool geometry from its primary mechanical shape, ensuring assembly tolerances are guaranteed by the code rather than guessed by the AI.

```typescript
import { HARDWARE_REGISTRY, generateFastenerVoid } from './hardware_library';
import { PACF_PROFILE } from './material_profiles';
import { booleans, transforms } from '@jscad/modeling';

export function designSensorMount() {
  const primaryBody = /* ... generated primary geometry ... */;
  
  // The Draftsman retrieves the precise void geometry
  const m3InsertVoid = generateFastenerVoid(
    HARDWARE_REGISTRY.M3_HEAT_SET_SHORT, 
    5, 
    PACF_PROFILE
  );

  // Positions the void where the hardware needs to go
  const positionedVoid = transforms.translate([15, 15, 0], m3InsertVoid);

  // Subtracts the perfect hardware tolerance from the main body
  return booleans.subtract(primaryBody, positionedVoid);
}

```

Here is the technical implementation for the **Clearances & Snap-Fit Library**.

Implementing this in a procedural TypeScript environment requires a shift in how the AI approaches geometry. Rather than drawing two shapes and placing them next to each other, the pipeline must use parametric offsets to generate the "negative space" female receptacle directly from the male component, and it must use rigid cantilever mechanics to calculate snap-fit limits.

---

## 8. Modular Assembly & Mating Surfaces (Implementation)

### 8.1 The Parameter-Offset Pattern for Clearances

The most computationally efficient way to guarantee perfect mating in JSCAD is not to use 3D expansions (which can cause infinite loop timeouts during orchestration), but to enforce a **Parameter-Offset Pattern**.

When designing a modular system—such as sliding individual sensor nodes into the rail of a 16-channel modular array—the Draftsman never manually defines the dimensions of the receiving slot. Instead, it passes the male geometry's parameters through a clearance wrapper to generate the boolean subtraction void.

```typescript
import { primitives, booleans, transforms } from '@jscad/modeling';
import { ClearanceProfile } from './clearance_profiles';
import { PACF_PROFILE } from './material_profiles';

// The base parameters for the male component (e.g., an EEG dry-electrode node chassis)
export interface NodeParams {
  width: number;
  length: number;
  depth: number;
}

export function generateMatingVoid(
  node: NodeParams, 
  clearance: number, 
  material: MaterialProfile
) {
  // 1. Add the specific mating clearance (e.g., 0.15mm for a sliding fit)
  // 2. Add the material shrinkage offset to ensure the printed void doesn't compress
  const totalOffset = clearance + material.holeOffset;

  return primitives.cuboid({
    size: [
      node.width + (totalOffset * 2),
      node.length + (totalOffset * 2),
      node.depth + (totalOffset * 2)
    ]
  });
}

```

By enforcing this library, the Draftsman agent simply calls `generateMatingVoid(myNode, PACF_CLEARANCES.slidingFit, PACF_PROFILE)` and subtracts the result from the main chassis array, guaranteeing a perfect mechanical fit right off the printer bed.

### 8.2 Snap-Fit Cantilever Mechanics (The Math)

Snap-fits in FDM printing are notoriously difficult because layer adhesion and material properties dictate success. High-strength engineering materials like carbon fiber-reinforced nylon (PA-CF) are extremely rigid; if the Draftsman generates a standard thick snap-fit hook, the PA-CF will shatter rather than bend.

Therefore, the Draftsman cannot just draw a hook. It must use the **Cantilever Beam Deflection Formula** to calculate the required length of the snap-fit beam based on the material's maximum permissible strain.

The formula for strain ($\epsilon$) at the base of a cantilever beam with a point load is:
$\epsilon = \frac{3 \cdot y \cdot t}{2 \cdot L^2}$
Where:

* $y$ = Maximum deflection (the depth of the hook undercut)
* $t$ = Thickness of the beam at the base
* $L$ = Length of the beam

### 8.3 The Snap-Fit Generator Function

We expose a pure TypeScript function to the Draftsman that solves for $L$ (Length) automatically. The Architect defines the material's maximum strain threshold, and the library generates the exact geometry required to prevent snapping.

```typescript
export interface SnapFitConstraints {
  deflectionDepth: number; // How deep the hook grabs (e.g., 1.5mm)
  beamThickness: number;   // How thick the FDM printed wall is (e.g., 1.6mm)
  maxStrain: number;       // Material limit: e.g., 0.02 (2%) for PA-CF
  width: number;           // The width of the clip
}

export function generateCantileverClip(constraints: SnapFitConstraints) {
  // 1. Solve for the minimum safe beam length to prevent the material from shattering
  // L = sqrt( (3 * y * t) / (2 * maxStrain) )
  const minLength = Math.sqrt(
    (3 * constraints.deflectionDepth * constraints.beamThickness) / 
    (2 * constraints.maxStrain)
  );

  // Add a 10% safety factor for FDM layer-line weaknesses
  const safeLength = minLength * 1.10;

  // 2. Procedurally generate the geometry in JSCAD
  const beam = primitives.cuboid({
    size: [constraints.width, safeLength, constraints.beamThickness],
    center: [0, safeLength / 2, constraints.beamThickness / 2]
  });

  // Generate the hook triangle (simplified for example)
  const hook = primitives.polyhedron({
      // Polyhedron points defining a 45-degree insertion angle and flat retention face
      // matching constraints.deflectionDepth
      /* ... points/faces array ... */
  });
  
  const positionedHook = transforms.translate([0, safeLength, 0], hook);

  return booleans.union(beam, positionedHook);
}

```

### 8.4 Integration into the Agent Pipeline

When the Architect node initializes the `CADPipelineEvent`, it passes the material's strain limits.

If the user requests a modular assembly on the Bambu Lab P2S using PA-CF, the Architect node passes `maxStrain: 0.015` (1.5%). When the Draftsman calls the `generateCantileverClip` function to create the retaining clips for the assembly, the function will mathematically enforce a much longer cantilever beam than it would if the material were a flexible PETG (`maxStrain: 0.05`).

This completely eliminates the AI's tendency to guess structural dimensions, forcing it to adhere to the physical realities of the fabrication substrate.

Here is the technical implementation for the **Technician Node Data Schema**.

To close the loop between virtual generation and physical reality, the pipeline must ingest bench-test data cleanly. If the system is designing a polygonal stack for acoustic tuning (like a Transpeller assembly) or testing dry-electrode materials for a 16-channel EEG headset, the theoretical simulation will always deviate slightly from the physical prototype.

The Technician Node requires a strictly typed schema that separates *calibration data* (updating how the system understands the printer/material) from *performance data* (updating the specific part's geometric constraints).

---

## 9. Real-World Data Injection (The Technician Node Schema)

### 9.1 The Empirical Test Event Interface

The pipeline exposes an ingestion endpoint that accepts an `EmpiricalTestEvent`. This payload forces the human technician to provide structured, dimensional deltas rather than vague text feedback.

```typescript
export interface EmpiricalTestEvent {
  partId: string;
  iteration: number;
  
  // 1. Environmental & Fabrication Calibration
  // Updates the MaterialProfile for future runs
  fabricationMetrics: {
    ambientTemp: number;
    ambientHumidity: number;
    measuredXY: number; // Actual caliper measurement of the calibration axis
    measuredZ: number;
    measuredHoleRadius: number; 
  };

  // 2. Physical Performance Deltas
  // A discriminated union allowing specific domains (Acoustic, Electrical, Kinetic)
  performanceMetrics: AcousticTest | ImpedanceTest | KineticTest;
}

```

### 9.2 Domain-Specific Metric Schemas

The `performanceMetrics` payload uses structural typing to define exactly what the Technician node needs to calculate the geometric correction.

**Example A: Acoustic Tuning (Polygonal Stacks)**
When bench-testing an air-intake or acoustic resonance chamber, the physical volume and internal wall texture dictate the actual frequency.

```typescript
export interface AcousticTest {
  type: 'acoustic_resonance';
  targetFrequencyHz: number;
  measuredFrequencyHz: number;
  measuredAmplitudeDb: number;
  resonancePeakWidthHz: number; // Indicates how "clean" the resonance is
}

```

**Example B: Structural/Electrical Impedance (EEG Dry Electrodes)**
When fabricating modular nodes that require skin contact, the mechanical pressure generated by the snap-fit cantilever directly impacts signal impedance.

```typescript
export interface ImpedanceTest {
  type: 'contact_impedance';
  targetImpedanceKohms: number;
  measuredImpedanceKohms: number;
  appliedPressureNewtons: number; // The force exerted by the generated retaining clip
  surfaceAreaContactMm2: number;
}

```

### 9.3 The Technician Node Logic (Delta Calculation)

When this payload is ingested, the Technician agent is wrapped in a deterministic evaluation script before it passes instructions to the Architect.

The node calculates the mathematical $\Delta$ (delta) between theoretical and empirical performance.

```typescript
export function evaluateEmpiricalFeedback(testData: EmpiricalTestEvent) {
  // 1. Update the static MaterialProfile based on calipers
  // (e.g., PA-CF shrank 0.2% more than the baseline profile expected)
  updateMaterialProfileRegistry(testData.fabricationMetrics);

  // 2. Generate constraint updates for the Architect
  const constraintUpdates = {};

  if (testData.performanceMetrics.type === 'acoustic_resonance') {
    const metrics = testData.performanceMetrics;
    const deltaHz = metrics.measuredFrequencyHz - metrics.targetFrequencyHz;
    
    if (Math.abs(deltaHz) > 5) { // 5Hz tolerance
      // If the measured frequency is too high, the internal volume must be increased.
      // The Technician outputs a strict instruction to the Architect.
      constraintUpdates['volumeModifier'] = calculateRequiredVolumeShift(deltaHz);
      constraintUpdates['feedback'] = `Physical bench test yielded ${metrics.measuredFrequencyHz}Hz. Target is ${metrics.targetFrequencyHz}Hz. Increase internal chamber volume by ${constraintUpdates['volumeModifier']}%.`;
    }
  }

  if (testData.performanceMetrics.type === 'contact_impedance') {
    const metrics = testData.performanceMetrics;
    if (metrics.measuredImpedanceKohms > metrics.targetImpedanceKohms) {
      // High impedance means insufficient contact pressure or surface area.
      // Instruct the Architect to increase the cantilever deflection constraints.
      constraintUpdates['deflectionDepthModifier'] = 1.15; // Increase pressure by 15%
      constraintUpdates['feedback'] = `Impedance failed at ${metrics.measuredImpedanceKohms} kOhms. Increase cantilever deflection depth by 15% to increase contact pressure.`;
    }
  }

  // 3. Trigger a new orchestration loop with updated constraints
  triggerPipelineIteration(testData.partId, constraintUpdates);
}

```

### 9.4 Closing the Loop

By structuring the schema this way, the LLM is entirely removed from the physics calculations. The Technician node receives the physical data, uses deterministic math to calculate the required volumetric or structural shift, and passes an updated, strict numerical parameter back into the `CADPipelineEvent` for the Draftsman's next iteration.

Here is the technical implementation for the **Execution Security & Sandboxing Architecture**.

When the Draftsman agent generates procedural CAD using standard TypeScript, you are essentially accepting arbitrary code from an LLM. If you execute this code natively on the host orchestration server, a hallucinated recursive loop will spike CPU usage to 100%, and a malicious prompt injection could lead to arbitrary file reads (e.g., `fs.readFileSync('/etc/passwd')`).

To mitigate this, the pipeline executes the code in a completely isolated, ephemeral container that is destroyed immediately after the mesh is generated or a hard timeout is reached.

---

## 10. Execution Security & Sandboxing Architecture (Implementation)

### 10.1 The Ephemeral Docker Environment

We start by building a locked-down Docker image specifically for compiling JSCAD. It contains only the required Node.js runtime and the `@jscad` dependencies.

**Dockerfile (`jscad-sandbox`)**

```dockerfile
# Use a slim, secure base image
FROM node:20-bookworm-slim

# Create a non-root user for execution
RUN groupadd -r caduser && useradd -r -g caduser caduser

# Set up the isolated working directory
WORKDIR /sandbox
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# Copy the compilation wrapper script (not the LLM code)
COPY compile.js ./

# Restrict ownership to the non-root user
RUN chown -R caduser:caduser /sandbox

USER caduser
ENTRYPOINT ["node", "compile.js"]

```

### 10.2 The TypeScript Execution Wrapper

In your core orchestrator codebase, you use Node's `child_process` to spawn this Docker container. You enforce strict boundaries on memory, CPU, and network access directly via Docker CLI flags.

```typescript
import { spawn } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface SandboxResult {
  passed: boolean;
  stlPath?: string;
  errorLog?: string;
  flags: string[];
}

export async function executeSandboxedCAD(
  runId: string, 
  cadCode: string
): Promise<SandboxResult> {
  const hostWorkDir = `/tmp/agent_runs/${runId}`;
  const inputCodePath = join(hostWorkDir, 'draftsman_output.ts');
  const outputStlPath = join(hostWorkDir, 'output.stl');

  // 1. Prepare the host directory
  mkdirSync(hostWorkDir, { recursive: true });
  writeFileSync(inputCodePath, cadCode);

  return new Promise((resolve) => {
    // 2. Spawn the strictly locked-down container
    const sandbox = spawn('docker', [
      'run',
      '--rm',                     // Destroy container immediately after exit
      '--network', 'none',        // Disable all internet/network access
      '--memory', '512m',         // Hard RAM limit to prevent heap exhaustion
      '--cpus', '1.0',            // Restrict to a single core
      '-v', `${hostWorkDir}:/data`, // Mount the temporary run directory
      'jscad-sandbox',            // The image defined above
      '/data/draftsman_output.ts',// Input argument for the compile script
      '/data/output.stl'          // Output argument for the compile script
    ]);

    let stderr = '';
    sandbox.stderr.on('data', (data) => { stderr += data; });

    // 3. Enforce a hard timeout (e.g., 15 seconds) to catch infinite loops
    const timeout = setTimeout(() => {
      sandbox.kill('SIGKILL');
      resolve({
        passed: false,
        errorLog: 'EXECUTION_TIMEOUT: The generated geometry caused an infinite loop or exceeded complexity limits.',
        flags: ['CRITICAL: Simplify boolean operations or reduce polygon count (segments).']
      });
    }, 15000);

    sandbox.on('close', (code) => {
      clearTimeout(timeout);
      
      if (code === 0) {
        resolve({ passed: true, stlPath: outputStlPath, flags: [] });
      } else {
        // A non-zero exit means the LLM wrote invalid TypeScript or failed compilation
        resolve({ 
          passed: false, 
          errorLog: stderr,
          flags: ['ERROR: TypeScript compilation or JSCAD execution failed. Check syntax.']
        });
      }
    });
  });
}

```

### 10.3 The Execution Lifecycle

1. **Write to Host:**
The orchestrator saves the Draftsman's raw string output as a `.ts` file into a temporary, run-specific directory on the host machine.


2. **Container Instantiation:**
The Docker runtime spins up the `jscad-sandbox` container, mounting the host directory as a volume `/data`. The container has no network access and operates as a non-root user.


3. **Compilation & Export:**
Inside the container, `compile.js` imports the LLM's `.ts` file, executes the pure geometric functions, and uses `@jscad/io` to serialize the resulting `Geom3` object into binary STL data.


4. **Host Retrieval & Container Death:**
The container writes `output.stl` to the mounted `/data` volume. Once the process exits, Docker instantly destroys the container (`--rm`), leaving only the clean STL file on the host machine for the Physicist and Machinist nodes to evaluate.


By implementing this architecture, the agentic pipeline remains entirely immune to hallucinated destructive commands, memory leaks, and dependency poisoning, guaranteeing stable uptime even when the Draftsman generates catastrophically broken code.

To build the Architect node, you must stop thinking of prompt engineering as writing instructions, and start thinking of it as defining a strict data extraction schema.

The Architect does not generate code or geometry. It acts as the pipeline’s parser, translating human intent ("Build me a bracket for a 5mm rod that mounts to a wall, use PA-CF") into the rigid, JSON-schema constraints that the Draftsman and Physicist nodes require to operate.

Here is how to structure the system prompt and instruction logic for the Architect node.

## 1. The Core Prompt Architecture

The system prompt for the Architect must be declarative and entirely focused on constraint mapping. It should completely strip the LLM of its conversational tendencies.

```text
# ROLE
You are the Architect Node in a deterministic mechanical engineering pipeline. Your sole purpose is to translate the user's natural language request into a strictly typed JSON object containing physical constraints and material profiles. 

# OPERATING RULES
1. You do NOT design geometry. You define the bounding box and the rules.
2. If the user does not specify a material, default to "PETG" for structural components and "TPU" for flexible components.
3. If the user does not specify clearance tolerances for moving parts, default to a `slidingFit` of 0.20mm.
4. You MUST extract any specific fastener requirements and map them to the HARDWARE_REGISTRY keys (e.g., "m3_shcs", "m3_insert_short").
5. If the request is physically impossible or lacks critical dimensions (e.g., "Build a box" without specifying size), you MUST populate the `clarificationNeeded` array rather than hallucinating dimensions.

```

## 2. Enforcing JSON Schema Output

The most critical part of the Architect node is forcing the LLM to output structured data. You must use function calling (or structured outputs/JSON mode) to guarantee the LLM returns an object matching the `CADPipelineEvent.globalConstraints` interface.

Here is the JSON Schema you provide to the LLM to govern its output:

```json
{
  "name": "initialize_pipeline_constraints",
  "description": "Initializes the engineering constraints based on the user request.",
  "parameters": {
    "type": "object",
    "properties": {
      "targetMaterial": {
        "type": "string",
        "enum": ["PLA", "PETG", "PA-CF", "TPU"],
        "description": "The target FDM fabrication material."
      },
      "maxBoundingBox": {
        "type": "array",
        "items": { "type": "number" },
        "description": "Maximum [X, Y, Z] dimensions in millimeters.",
        "minItems": 3,
        "maxItems": 3
      },
      "fastenersRequired": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Keys mapping to the HARDWARE_REGISTRY."
      },
      "environmentalPhysics": {
        "type": "object",
        "description": "Any specific acoustic, kinetic, or fluid targets.",
        "properties": {
          "targetResonanceHz": { "type": "number" },
          "maxLoadNewtons": { "type": "number" }
        }
      },
      "clarificationNeeded": {
        "type": "array",
        "items": { "type": "string" },
        "description": "If critical dimensions or context are missing, list the specific questions for the human here."
      }
    },
    "required": ["targetMaterial", "maxBoundingBox", "fastenersRequired"]
  }
}

```

## 3. The Orchestration Logic (The Human-in-the-Loop Gate)

The Orchestrator code that executes the Architect node must evaluate the JSON output before triggering the Draftsman. If the Architect populated the `clarificationNeeded` array, the pipeline halts and returns those questions to the user.

```typescript
export async function executeArchitectNode(userPrompt: string) {
  // 1. Call the LLM with the strict system prompt and the JSON schema
  const architectOutput = await llmClient.generateStructured(
    SYSTEM_PROMPT, 
    userPrompt, 
    INITIALIZATION_SCHEMA
  );

  // 2. Evaluate if the Architect has enough data to proceed
  if (architectOutput.clarificationNeeded && architectOutput.clarificationNeeded.length > 0) {
    // Pipeline halts. Return to human for clarification.
    return {
      status: 'BLOCKED_PENDING_USER_INPUT',
      questions: architectOutput.clarificationNeeded
    };
  }

  // 3. Compile the final state object
  const initialState: CADPipelineEvent = {
    iteration: 0,
    globalConstraints: {
      maxBoundingBox: architectOutput.maxBoundingBox,
      // Map the string name back to the typed MaterialProfile object
      materialProfile: loadMaterialProfile(architectOutput.targetMaterial),
      targetPhysics: architectOutput.environmentalPhysics
    },
    proceduralCode: null,
    simulationResults: null,
    manufacturingFlags: []
  };

  // 4. Trigger the Draftsman
  return triggerDraftsmanNode(initialState);
}

```

By constraining the Architect node to this exact schema, you ensure the Draftsman never receives vague instructions like "make it strong," but instead receives the strict parameter `maxLoadNewtons: 50`, which can be mathematically verified by the Physicist node.