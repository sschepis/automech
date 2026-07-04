import { spawn, execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { pathToFileURL } from 'url';
import type { SandboxResult } from '../types/pipeline.js';

const SANDBOX_IMAGE = 'jscad-sandbox';
const EXECUTION_TIMEOUT_MS = 15000;

function isDockerAvailable(): boolean {
  try {
    execSync('docker info', { timeout: 5000, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function isSandboxImagePresent(): boolean {
  try {
    execSync(`docker image inspect ${SANDBOX_IMAGE}`, { timeout: 5000, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export async function executeSandboxedCAD(
  runId: string,
  cadCode: string,
): Promise<SandboxResult> {
  const hostWorkDir = join(tmpdir(), `automech_runs`, runId);
  const projectTmpDir = join(process.cwd(), 'tmp');
  const inputCodePath = join(hostWorkDir, 'draftsman_output.js');
  const localInputPath = join(projectTmpDir, `${runId}.mjs`);
  const outputStlPath = join(hostWorkDir, 'output.stl');

  try {
    mkdirSync(hostWorkDir, { recursive: true });
    writeFileSync(inputCodePath, cadCode, 'utf-8');
  } catch (err) {
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
    } catch (err) {
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

function executeDocker(
  hostWorkDir: string,
  inputCodePath: string,
  outputStlPath: string,
): Promise<SandboxResult> {
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
    sandbox.stderr?.on('data', (data: Buffer) => {
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
      } else if (code === 124) {
        resolve({
          passed: false,
          errorLog: 'EXECUTION_TIMEOUT: In-sandbox timeout reached.',
          flags: ['CRITICAL: Simplify boolean operations or reduce polygon count.'],
        });
      } else {
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

async function executeLocally(
  inputCodePath: string,
  outputStlPath: string,
): Promise<SandboxResult> {
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

    const io = await import('@jscad/io');
    const stlData = io.solidsAsBlob(geometry, { format: 'stl' });

    writeFileSync(outputStlPath, Buffer.from(stlData));

    return { passed: true, stlPath: outputStlPath, flags: [] };
  } catch (err) {
    return {
      passed: false,
      errorLog: err instanceof Error ? err.message : String(err),
      flags: ['ERROR: Local execution failed.'],
    };
  }
}
