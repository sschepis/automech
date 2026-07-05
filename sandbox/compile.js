import { readFileSync, writeFileSync, existsSync } from 'fs';
import { pathToFileURL } from 'url';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const [, , inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  process.stderr.write('Usage: node compile.js <input.js> <output.stl>\n');
  process.exit(1);
}

if (!existsSync(inputPath)) {
  process.stderr.write(`Input file not found: ${inputPath}\n`);
  process.exit(1);
}

const startTime = Date.now();
const timeoutMs = 12000;

const timeout = setTimeout(() => {
  process.stderr.write('EXECUTION_TIMEOUT: Geometry generation exceeded complexity limits.\n');
  process.exit(124);
}, timeoutMs);

try {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const libPath = resolve(__dirname, 'automech-lib.js');

  if (existsSync(libPath)) {
    const lib = await import(pathToFileURL(libPath).href);
    globalThis.automechLib = lib;
  }

  const io = await import('@jscad/io');
  const absolutePath = resolve(inputPath);
  const fileUrl = pathToFileURL(absolutePath).href;
  const mod = await import(fileUrl);

  if (typeof mod.design !== 'function') {
    process.stderr.write('ERROR: Module must export a "design" function that returns a Geom3 object.\n');
    process.exit(2);
  }

  const geometry = mod.design();

  if (!geometry) {
    process.stderr.write('ERROR: design() returned null or undefined.\n');
    process.exit(3);
  }

  const stlData = io.solidsAsBlob(geometry, { format: 'stl' });
  writeFileSync(outputPath, Buffer.from(stlData));
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`EXECUTION_ERROR: ${message}\n`);
  process.exit(4);
} finally {
  clearTimeout(timeout);
  const elapsed = Date.now() - startTime;
  process.stderr.write(`Compilation completed in ${elapsed}ms\n`);
}
