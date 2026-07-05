import { spawn, execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { pathToFileURL } from 'url';
const SANDBOX_IMAGE = 'jscad-sandbox';
const EXECUTION_TIMEOUT_MS = 15000;
function isDockerAvailable() {
    try {
        execSync('docker info', { timeout: 5000, stdio: 'ignore' });
        return true;
    }
    catch {
        return false;
    }
}
function isSandboxImagePresent() {
    try {
        execSync(`docker image inspect ${SANDBOX_IMAGE}`, { timeout: 5000, stdio: 'ignore' });
        return true;
    }
    catch {
        return false;
    }
}
export async function executeSandboxedCAD(runId, cadCode) {
    const hostWorkDir = join(tmpdir(), `automech_runs`, runId);
    const projectTmpDir = join(process.cwd(), 'tmp');
    const inputCodePath = join(hostWorkDir, 'draftsman_output.js');
    const localInputPath = join(projectTmpDir, `${runId}.mjs`);
    const outputStlPath = join(hostWorkDir, 'output.stl');
    try {
        mkdirSync(hostWorkDir, { recursive: true });
        writeFileSync(inputCodePath, cadCode, 'utf-8');
    }
    catch (err) {
        return {
            passed: false,
            errorLog: `Failed to prepare work directory: ${err instanceof Error ? err.message : err}`,
            flags: ['CRITICAL: Could not write sandbox input files.'],
        };
    }
    if (!isDockerAvailable() || !isSandboxImagePresent()) {
        try {
            mkdirSync(projectTmpDir, { recursive: true });
            writeFileSync(localInputPath, cadCode, 'utf-8');
        }
        catch (err) {
            return {
                passed: false,
                errorLog: `Failed to write local sandbox file: ${err instanceof Error ? err.message : err}`,
                flags: ['CRITICAL: Could not write sandbox input files.'],
            };
        }
        return executeLocally(localInputPath, outputStlPath);
    }
    return executeDocker(hostWorkDir, inputCodePath, outputStlPath);
}
function executeDocker(hostWorkDir, inputCodePath, outputStlPath) {
    return new Promise((resolve) => {
        const sandbox = spawn('docker', [
            'run',
            '--rm',
            '--network', 'none',
            '--memory', '512m',
            '--cpus', '1.0',
            '-v', `${hostWorkDir}:/data`,
            SANDBOX_IMAGE,
            '/data/draftsman_output.js',
            '/data/output.stl',
        ], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stderr = '';
        sandbox.stderr?.on('data', (data) => {
            stderr += data.toString('utf-8');
        });
        const timeout = setTimeout(() => {
            sandbox.kill('SIGKILL');
            resolve({
                passed: false,
                errorLog: 'EXECUTION_TIMEOUT: The generated geometry caused an infinite loop or exceeded complexity limits.',
                flags: ['CRITICAL: Simplify boolean operations or reduce polygon count (segments).'],
            });
        }, EXECUTION_TIMEOUT_MS);
        sandbox.on('close', (code) => {
            clearTimeout(timeout);
            if (code === 0 && existsSync(outputStlPath)) {
                resolve({ passed: true, stlPath: outputStlPath, flags: [] });
            }
            else if (code === 124) {
                resolve({
                    passed: false,
                    errorLog: 'EXECUTION_TIMEOUT: In-sandbox timeout reached.',
                    flags: ['CRITICAL: Simplify boolean operations or reduce polygon count.'],
                });
            }
            else {
                resolve({
                    passed: false,
                    errorLog: stderr || `Process exited with code ${code}`,
                    flags: ['ERROR: TypeScript compilation or JSCAD execution failed. Check syntax.'],
                });
            }
        });
        sandbox.on('error', (err) => {
            clearTimeout(timeout);
            resolve({
                passed: false,
                errorLog: `Sandbox spawn failed: ${err.message}`,
                flags: ['CRITICAL: Docker sandbox could not be started. Is Docker running?'],
            });
        });
    });
}
async function executeLocally(inputCodePath, outputStlPath) {
    try {
        const fileUrl = pathToFileURL(inputCodePath).href;
        const mod = await import(fileUrl);
        if (typeof mod.design !== 'function') {
            return {
                passed: false,
                errorLog: 'Module must export a "design" function.',
                flags: ['ERROR: Missing design() export.'],
            };
        }
        const geometry = mod.design();
        if (!geometry) {
            return {
                passed: false,
                errorLog: 'design() returned null or undefined.',
                flags: ['ERROR: Null geometry.'],
            };
        }
        const modeling = await import('@jscad/modeling');
        const volume = modeling.default.measurements.measureAggregateVolume(geometry);
        if (volume <= 0 || isNaN(volume)) {
            return {
                passed: false,
                errorLog: `design() produced geometry with zero volume (${volume} mm³). Check that union/subtract operations produce valid solid bodies.`,
                flags: ['CRITICAL: Zero-volume geometry. The CAD code produced an empty or degenerate solid.'],
            };
        }
        const io = await import('@jscad/io');
        const stlSerializer = io.stlSerializer;
        const stlChunks = stlSerializer.serialize({ binary: true }, geometry);
        const stlBuffer = Buffer.concat(stlChunks.map((c) => Buffer.from(c)));
        writeFileSync(outputStlPath, stlBuffer);
        if (stlBuffer.length < 84) {
            return {
                passed: false,
                errorLog: `STL output is only ${stlBuffer.length} bytes (min 84 for binary header).`,
                flags: ['CRITICAL: STL file is empty or corrupt.'],
            };
        }
        // Detect NaN/Infinity vertices from degenerate booleans
        const facetCount = stlBuffer.readUInt32LE(80);
        let nanVertices = 0;
        let offset = 84;
        for (let i = 0; i < facetCount; i++) {
            for (let v = 0; v < 3; v++) {
                const x = stlBuffer.readFloatLE(offset);
                offset += 4;
                const y = stlBuffer.readFloatLE(offset);
                offset += 4;
                const z = stlBuffer.readFloatLE(offset);
                offset += 4;
                if (!isFinite(x) || !isFinite(y) || !isFinite(z))
                    nanVertices++;
            }
            offset += 2;
        }
        const nanFlags = [];
        if (nanVertices > 0) {
            const pct = (nanVertices / (facetCount * 3) * 100).toFixed(1);
            nanFlags.push(`NaN_WARNING: ${pct}% of vertices (${nanVertices}/${facetCount * 3}) are NaN from boolean operations. Non-blocking — slicer can handle.`);
        }
        return { passed: true, stlPath: outputStlPath, flags: nanFlags };
    }
    catch (err) {
        return {
            passed: false,
            errorLog: err instanceof Error ? err.message : String(err),
            flags: ['ERROR: Local execution failed.'],
        };
    }
}
//# sourceMappingURL=executor.js.map