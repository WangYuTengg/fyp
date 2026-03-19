import { run, quickAddJob } from 'graphile-worker';
import type { Runner, TaskList } from 'graphile-worker';
import { WORKER_CONFIG } from '../config/constants.js';

/**
 * Graphile Worker Setup
 * Single worker instance with concurrency: 1 for sequential job processing
 */

let workerInstance: Runner | null = null;

/**
 * Initialize Graphile Worker
 * @param taskList - Map of task names to handler functions
 */
export async function initializeWorker(taskList: TaskList): Promise<Runner> {
  if (workerInstance) {
    console.log('Worker already initialized');
    return workerInstance;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required for Graphile Worker');
  }

  console.log('Initializing Graphile Worker...');
  
  workerInstance = await run({
    connectionString,
    concurrency: WORKER_CONFIG.CONCURRENCY,
    pollInterval: WORKER_CONFIG.POLL_INTERVAL_MS,
    taskList,
    noHandleSignals: false, // Handle SIGTERM/SIGINT for graceful shutdown
    noPreparedStatements: true, // Prevent "prepared statement does not exist" errors with Supabase PgBouncer pooled connections
    crontab: '* * * * * auto-submit-expired', // Every minute: auto-submit expired drafts
  });

  console.log('Graphile Worker initialized successfully');
  
  return workerInstance;
}

/**
 * Add a job to the queue
 * @param taskName - Name of the task (must be in taskList)
 * @param payload - Job payload
 */
export async function addJob(
  taskName: string,
  payload: Record<string, unknown>
): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  await quickAddJob(
    { connectionString },
    taskName,
    payload,
    {
      maxAttempts: WORKER_CONFIG.MAX_ATTEMPTS,
      priority: 0,
    }
  );
}

/**
 * Gracefully shutdown the worker
 */
export async function shutdownWorker(): Promise<void> {
  if (workerInstance) {
    console.log('Shutting down Graphile Worker...');
    await workerInstance.stop();
    workerInstance = null;
    console.log('Graphile Worker stopped');
  }
}

/**
 * Get worker instance (for monitoring/debugging)
 */
export function getWorkerInstance(): Runner | null {
  return workerInstance;
}
