import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { PipelineResult } from '../orchestrator/pipeline.js';
import type { PipelineProgressEvent } from '../types/progress.js';
import type { EmpiricalTestEvent } from '../types/technician.js';

interface DesignJob {
  id: string;
  prompt: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'blocked' | 'max_iterations';
  result?: PipelineResult;
  events: PipelineProgressEvent[];
  createdAt: string;
  completedAt?: string;
}

const jobs = new Map<string, DesignJob>();

export function startAPIServer(
  port: number,
  runDesign: (prompt: string) => Promise<PipelineResult>,
  iterateDesign: (id: string, testData: EmpiricalTestEvent) => Promise<PipelineResult>,
) {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      await handleRequest(req, res, runDesign, iterateDesign);
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }));
    }
  });

  server.listen(port, () => {
    process.stderr.write(`[API] Listening on http://localhost:${port}\n`);
  });

  return server;
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  runDesign: (prompt: string) => Promise<PipelineResult>,
  iterateDesign: (id: string, testData: EmpiricalTestEvent) => Promise<PipelineResult>,
) {
  const url = new URL(req.url || '/', `http://localhost`);
  const path = url.pathname;
  const method = req.method || 'GET';

  // POST /design — submit a new design job
  if (method === 'POST' && path === '/design') {
    const body = await readBody(req);
    const { prompt } = body;
    if (!prompt) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing "prompt" field' }));
      return;
    }

    const id = randomUUID();
    const job: DesignJob = {
      id,
      prompt,
      status: 'running',
      events: [],
      createdAt: new Date().toISOString(),
    };
    jobs.set(id, job);

    res.writeHead(202);
    res.end(JSON.stringify({ id, status: 'running' }));

    try {
      const result = await runDesign(prompt);
      job.result = result;
      job.status = result.status === 'blocked' ? 'blocked' : result.status === 'completed' ? 'completed' : 'failed';
      job.completedAt = new Date().toISOString();
    } catch (err) {
      job.status = 'failed';
      job.completedAt = new Date().toISOString();
      job.result = {
        status: 'failed',
        errors: [err instanceof Error ? err.message : String(err)],
        finalState: null,
      };
    }
    return;
  }

  // GET /design/:id — get job status and result
  const designMatch = path.match(/^\/design\/([a-f0-9-]+)$/);
  if (method === 'GET' && designMatch) {
    const id = designMatch[1];
    const job = jobs.get(id);
    if (!job) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Design not found' }));
      return;
    }
    res.writeHead(200);
    res.end(JSON.stringify({
      id: job.id,
      status: job.status,
      prompt: job.prompt,
      result: job.result ? {
        status: job.result.status,
        stlPath: job.result.stlPath,
        errors: job.result.errors?.slice(0, 5),
        constraints: job.result.finalState?.globalConstraints ? {
          boundingBox: job.result.finalState.globalConstraints.maxBoundingBox,
          material: job.result.finalState.globalConstraints.materialProfile.name,
        } : null,
      } : null,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    }));
    return;
  }

  // GET /design/:id/stl — download the STL file
  const stlMatch = path.match(/^\/design\/([a-f0-9-]+)\/stl$/);
  if (method === 'GET' && stlMatch) {
    const id = stlMatch[1];
    const job = jobs.get(id);
    if (!job || !job.result?.stlPath) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'STL not available' }));
      return;
    }
    if (!existsSync(job.result.stlPath)) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'STL file not found on disk' }));
      return;
    }
    const stlBuffer = readFileSync(job.result.stlPath);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${id}.stl"`);
    res.writeHead(200);
    res.end(stlBuffer);
    return;
  }

  // POST /design/:id/iterate — submit empirical test data
  const iterateMatch = path.match(/^\/design\/([a-f0-9-]+)\/iterate$/);
  if (method === 'POST' && iterateMatch) {
    const id = iterateMatch[1];
    const job = jobs.get(id);
    if (!job) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Design not found' }));
      return;
    }
    const body = await readBody(req);
    const testData = body as EmpiricalTestEvent;
    if (!testData.performanceMetrics?.type) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing performanceMetrics.type field' }));
      return;
    }
    res.writeHead(202);
    res.end(JSON.stringify({ id, status: 'iterating', testType: testData.performanceMetrics.type }));

    try {
      const result = await iterateDesign(id, testData);
      job.result = result;
      job.status = result.status;
      job.completedAt = new Date().toISOString();
    } catch (err) {
      job.status = 'failed';
      job.completedAt = new Date().toISOString();
    }
    return;
  }

  // GET /jobs — list all jobs
  if (method === 'GET' && path === '/jobs') {
    const list = Array.from(jobs.values()).map(j => ({
      id: j.id,
      status: j.status,
      prompt: j.prompt.slice(0, 80),
      createdAt: j.createdAt,
    }));
    res.writeHead(200);
    res.end(JSON.stringify(list));
    return;
  }

  // GET /health
  if (method === 'GET' && path === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}
