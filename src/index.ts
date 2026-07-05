import { configDotenv } from 'dotenv';
import { createDeepSeekClient } from './llm/deepseek.js';
import { createOpenRouterClient } from './llm/openrouter.js';
import type { LLMClient } from './llm/types.js';
import { runPipeline, type PipelineOptions } from './orchestrator/pipeline.js';
import { formatProgressEvent } from './types/progress.js';
import { loadConfig } from './config/index.js';

configDotenv();

function detectProvider(): { name: string; createClient: () => LLMClient } {
  if (process.env.OPENROUTER_API_KEY) {
    return { name: 'openrouter', createClient: () => createOpenRouterClient() };
  }
  if (process.env.DEEPSEEK_API_KEY) {
    return { name: 'deepseek', createClient: () => createDeepSeekClient() };
  }
  throw new Error('No LLM API key found. Set OPENROUTER_API_KEY or DEEPSEEK_API_KEY in .env');
}

function printHelp() {
  console.log(`automech — AI-driven mechanical CAD pipeline

Commands:
  automech design "<prompt>"              Create a new design from scratch
  automech design --stl <path> "<prompt>" Improve an existing STL — renders it, critiques it, regenerates as OpenSCAD
  automech design --scad <path> "<prompt>" Improve existing OpenSCAD code — renders, evaluates, improves
  automech iterate <run-id> "<feedback>"  Iterate on a previous run with specific feedback
  automech compare <run-a> <run-b>        Diff two runs — volume, facets, file size
  automech list                           List recent runs from output/

Examples:
  automech design "A print-in-place articulated fidget chain toy"
  automech design --stl part.stl "Add a thumb grip and make the arms thinner"
  automech design --scad model.scad "Reduce overhangs and thicken the walls"
  automech iterate a1b2c3d4 "Make the central post 2mm taller and add fillets"
  automech list`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help') {
    printHelp();
    process.exit(0);
  }

  const config = loadConfig();
  const provider = detectProvider();
  console.log(`Provider: ${provider.name}`);

  // ── list ──
  if (command === 'list') {
    const { readFileSync, existsSync } = await import('fs');
    const { join, resolve } = await import('path');
    const indexPath = join(resolve(process.cwd(), 'output'), 'index.json');
    if (existsSync(indexPath)) {
      const index = JSON.parse(readFileSync(indexPath, 'utf-8'));
      if (index.length === 0) console.log('No runs yet.');
      else {
        console.log(`\nRecent runs (${index.length}):`);
        for (const r of index.reverse().slice(0, 20)) {
          console.log(`  ${r.runId.slice(0, 8)}  ${r.status.padEnd(12)} ${r.prompt?.slice(0, 60)}`);
        }
      }
    } else {
      console.log('No runs yet. Try "automech design" first.');
    }
    return;
  }

  // ── iterate <run-id> <feedback> ──
  if (command === 'iterate') {
    const runId = args[1];
    const feedback = args.slice(2).join(' ');
    if (!runId || !feedback) {
      console.error('Usage: automech iterate <run-id> "<feedback>"');
      process.exit(1);
    }

    const result = await runPipeline(
      provider.createClient(),
      feedback,
      (e) => { const msg = formatProgressEvent(e); if (msg) console.log(msg); },
      config,
      { iterationRunId: runId, iterationFeedback: feedback },
    );

    printResult(result);
    return;
  }

  // ── compare <run-id-a> <run-id-b> ──
  if (command === 'compare') {
    const runA = args[1];
    const runB = args[2];
    if (!runA || !runB) {
      console.error('Usage: automech compare <run-id> <run-id>');
      process.exit(1);
    }
    const { readFileSync, existsSync } = await import('fs');
    const { join, resolve } = await import('path');
    const outDir = resolve(process.cwd(), 'output');

    const stlA = join(outDir, runA, 'output.stl');
    const stlB = join(outDir, runB, 'output.stl');
    if (!existsSync(stlA)) { console.error(`STL not found: ${stlA}`); process.exit(1); }
    if (!existsSync(stlB)) { console.error(`STL not found: ${stlB}`); process.exit(1); }

    const a = readFileSync(stlA);
    const b = readFileSync(stlB);
    // Load and analyze both STLs
    const { parseSTLFacets, computeSignedVolume } = await import('./stl/shared.js');
    const facetsA = parseSTLFacets(a).length;
    const facetsB = parseSTLFacets(b).length;
    const volA = computeSignedVolume(parseSTLFacets(a));
    const volB = computeSignedVolume(parseSTLFacets(b));
    const sizeA = a.length;
    const sizeB = b.length;

    const volDelta = Math.abs(volA - volB);
    const volPct = volA > 0 ? (volDelta / volA * 100).toFixed(1) : '0';

    console.log(`Comparing ${runA.slice(0, 8)} ↔ ${runB.slice(0, 8)}:`);
    console.log(`  Facets:      ${facetsA} → ${facetsB}  (Δ ${facetsB - facetsA > 0 ? '+' : ''}${facetsB - facetsA})`);
    console.log(`  Volume:      ${volA.toFixed(0)} → ${volB.toFixed(0)} mm³  (Δ ${volB - volA > 0 ? '+' : ''}${volDelta.toFixed(0)} mm³, ${volPct}%)`);
    console.log(`  File size:   ${(sizeA / 1024).toFixed(1)} → ${(sizeB / 1024).toFixed(1)} KB  (Δ ${sizeB - sizeA > 0 ? '+' : ''}${((sizeB - sizeA) / 1024).toFixed(1)} KB)`);
    return;
  }

  // ── design [--stl <path>] [--scad <path>] "<prompt>" ──
  if (command === 'design') {
    let stlPath: string | undefined;
    let scadPath: string | undefined;
    let promptStart = 1;

    if (args[1] === '--stl' && args[2]) { stlPath = args[2]; promptStart = 3; }
    if (args[1] === '--scad' && args[2]) { scadPath = args[2]; promptStart = 3; }

    const prompt = args.slice(promptStart).join(' ');
    if (!prompt) {
      console.error('Error: design requires a prompt.');
      process.exit(1);
    }

    const options: PipelineOptions = {};
    if (stlPath) options.existingStlPath = stlPath;
    if (scadPath) options.existingScadPath = scadPath;

    const result = await runPipeline(
      provider.createClient(),
      prompt,
      (e) => { const msg = formatProgressEvent(e); if (msg) console.log(msg); },
      config,
      Object.keys(options).length > 0 ? options : undefined,
    );

    printResult(result);
    return;
  }

  console.error(`Unknown command: ${command}. Try "automech help".`);
  process.exit(1);
}

function printResult(result: Awaited<ReturnType<typeof runPipeline>>) {
  console.log(`\nStatus: ${result.status}`);
  if (result.runId) console.log(`Run ID: ${result.runId.slice(0, 8)}`);
  if (result.stlPath) console.log(`STL:   ${result.stlPath}`);
  if (result.renderPaths?.length) result.renderPaths.forEach((p, i) => console.log(`Render #${i + 1}: ${p}`));
  if (result.errors.length) console.log(`Issues: ${result.errors.slice(0, 5).join('; ')}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
