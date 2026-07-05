import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { AutomechConfig } from './types.js';
import { DEFAULT_CONFIG } from './types.js';

export function loadConfig(configPath?: string): AutomechConfig {
  const config = structuredClone(DEFAULT_CONFIG);
  const paths = [
    configPath,
    process.env.AUTOMECH_CONFIG,
    resolve(process.cwd(), 'automech.json'),
    resolve(process.cwd(), '.automech.json'),
  ].filter(Boolean) as string[];

  for (const p of paths) {
    if (existsSync(p)) {
      try {
        const raw = JSON.parse(readFileSync(p, 'utf-8'));
        deepMerge(config, raw);
        break;
      } catch {
        // ignore malformed config
      }
    }
  }

  applyEnvOverrides(config);
  return config;
}

function applyEnvOverrides(config: AutomechConfig) {
  const env = process.env;
  if (env.AUTOMECH_MAX_ITERATIONS) config.pipeline.maxIterations = parseInt(env.AUTOMECH_MAX_ITERATIONS);
  if (env.AUTOMECH_SANDBOX_TIMEOUT) config.pipeline.sandboxTimeoutMs = parseInt(env.AUTOMECH_SANDBOX_TIMEOUT);
  if (env.AUTOMECH_BUILD_VOLUME) {
    const parts = env.AUTOMECH_BUILD_VOLUME.split(',').map(Number);
    if (parts.length === 3) config.manufacturing.buildVolume = parts as [number, number, number];
  }
  if (env.AUTOMECH_DEFAULT_MATERIAL) config.manufacturing.defaultMaterial = env.AUTOMECH_DEFAULT_MATERIAL;
  if (env.AUTOMECH_MODEL) config.llm.model = env.AUTOMECH_MODEL;
  if (env.AUTOMECH_TEMPERATURE) config.llm.temperature = parseFloat(env.AUTOMECH_TEMPERATURE);
  if (env.AUTOMECH_PORT) config.api.port = parseInt(env.AUTOMECH_PORT);
}

function deepMerge(target: any, source: any) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}
