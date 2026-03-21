import * as dotenv from 'dotenv';
// Load env vars BEFORE any other imports that use them
dotenv.config();

import type { TaskList } from 'graphile-worker';
import { initializeWorker, shutdownWorker } from './lib/worker.js';
import autoGradeWritten, { type AutoGradeWrittenPayload } from './jobs/auto-grade-written.js';
import autoGradeUML, { type AutoGradeUMLPayload } from './jobs/auto-grade-uml.js';
import autoSubmitExpired from './jobs/auto-submit-expired.js';

/**
 * Standalone Graphile Worker entry point.
 *
 * Runs ONLY the background job processor — no HTTP server, no static files.
 * Used in Kubernetes to scale the grading pipeline independently of the web tier.
 *
 * Usage: node dist/server/worker.js
 */

const taskList: TaskList = {
  'auto-grade-written': (payload, helpers) =>
    autoGradeWritten(payload as AutoGradeWrittenPayload, helpers),
  'auto-grade-uml': (payload, helpers) => autoGradeUML(payload as AutoGradeUMLPayload, helpers),
  'auto-submit-expired': (payload, helpers) => autoSubmitExpired(payload, helpers),
};

console.log('Starting Graphile Worker (standalone mode)...');

initializeWorker(taskList)
  .then(() => {
    console.log('✓ Graphile Worker running (standalone mode)');
  })
  .catch((err) => {
    console.error('FATAL: Failed to initialize Graphile Worker:', err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down worker...');
  await shutdownWorker();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down worker...');
  await shutdownWorker();
  process.exit(0);
});
