import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';

const OUTPUT_DIR = resolve(process.cwd(), 'output');

export interface ExecutionResult {
  success: boolean;
  runId: string;
  stlPath?: string;
  pngPaths?: string[];
  error?: string;
}

function findOpenscad(): string | null {
  const paths = [
    'openscad',
    '/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD',
    '/Applications/OpenSCAD-2021.01.app/Contents/MacOS/OpenSCAD',
    '/usr/local/bin/openscad',
  ];

  for (const p of paths) {
    try {
      execSync(`test -x "${p}"`, { timeout: 1000, stdio: 'ignore' });
      return p;
    } catch { /* try next */ }
  }

  // Also try scanning for any OpenSCAD*.app
  try {
    const apps = execSync('ls /Applications/OpenSCAD*.app/Contents/MacOS/OpenSCAD 2>/dev/null', { encoding: 'utf-8', timeout: 2000, stdio: 'pipe' }).trim();
    if (apps) return apps.split('\n')[0];
  } catch { /* not found */ }

  return null;
}

export async function executeOpenSCAD(
  code: string,
): Promise<ExecutionResult> {
  const runId = randomUUID();

  const openscad = findOpenscad();
  if (!openscad) {
    return { success: false, runId, error: 'OpenSCAD not found. Install it: brew install openscad' };
  }

  const workDir = join(OUTPUT_DIR, runId);
  mkdirSync(workDir, { recursive: true });

  const scadPath = join(workDir, 'model.scad');
  const stlPath = join(workDir, 'output.stl');

  writeFileSync(scadPath, code, 'utf-8');

  // Generate STL
  try {
    const result = execSync(`"${openscad}" -o "${stlPath}" --export-format binstl "${scadPath}"`, {
      timeout: 60000,
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    if (!existsSync(stlPath)) {
      return { success: false, runId, error: 'OpenSCAD ran but produced no STL output.' };
    }
  } catch (err: any) {
    const stdout = err?.stdout?.toString() ?? '';
    const stderr = err?.stderr?.toString() ?? '';
    const msg = (stderr || stdout || err?.message || 'unknown error').slice(0, 400);
    return { success: false, runId, error: `OpenSCAD failed: ${msg}` };
  }

  // Generate renders from 2 angles
  const pngPaths: string[] = [];
  const views: Array<{ name: string; camera: string }> = [
    { name: 'perspective', camera: '0,0,0,55,0,25,0' },
    { name: 'top', camera: '0,0,0,0,0,100,0' },
  ];

  for (const view of views) {
    const pngPath = join(workDir, `${view.name}.png`);
    try {
      execSync(
        `"${openscad}" -o "${pngPath}" --render --imgsize=800,600 --viewall --autocenter --camera=${view.camera} "${scadPath}"`,
        { timeout: 30000, stdio: 'pipe' },
      );
      if (existsSync(pngPath)) {
        pngPaths.push(pngPath);
      }
    } catch {
      // render failure is non-fatal — we still have the STL
    }
  }

  return { success: true, runId, stlPath, pngPaths };
}
