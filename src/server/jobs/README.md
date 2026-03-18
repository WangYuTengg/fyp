# Background Jobs

Graphile Worker tasks for LLM-assisted grading — written answer grading and UML diagram assessment.

## Design Decisions

### Graphile Worker (PostgreSQL-Based Queue)

**Trade-off:** Tied to PostgreSQL, but eliminates Redis dependency.

Graphile Worker uses PostgreSQL as its job queue rather than a dedicated message broker (Redis/RabbitMQ). For a school deployment that already runs PostgreSQL, this means:

- Zero additional infrastructure
- Jobs are transactional with the database (no split-brain between queue and data)
- Job state is queryable with standard SQL (useful for the queue monitor UI)

The downside is that PostgreSQL is not optimized for high-throughput job processing — but with concurrency=1 and jobs that take 5-60 seconds each, throughput is not the bottleneck.

### Concurrency = 1

**Trade-off:** Sequential grading (slower throughput), but predictable cost and rate limiting.

Only one grading job runs at a time. This was chosen because:

- LLM API rate limits are per-key, not per-request — parallel calls risk hitting limits
- Token cost tracking is simpler when jobs don't interleave
- Error handling is clearer — a failed job doesn't affect concurrent jobs

For a class of 200 students with 5 questions each, sequential processing takes ~2-3 hours at 30 seconds per question. This is acceptable because batch grading runs overnight or during off-hours.

### Batch Tracking with Completion Notifications

**Trade-off:** Extra bookkeeping per job, but staff know when grading finishes.

Each job carries a `batchId` that groups it with other jobs triggered together. When the last job in a batch completes, a notification is sent to the triggering staff member. This avoids polling the queue status — staff trigger grading and get notified when it's done.

### Structured LLM Output via Zod Schemas

**Trade-off:** Occasional LLM output parsing failures, but guarantees grade data integrity.

LLM responses are parsed against Zod schemas (points, reasoning, confidence, criteria scores). If the LLM returns malformed JSON, the job fails explicitly rather than inserting garbage data into marks. The retry mechanism handles transient LLM formatting issues.

### Token Usage and Cost Tracking Per Job

**Trade-off:** More database writes per job, but enables cost analytics.

Every job records input tokens, output tokens, total tokens, and computed cost. This granular tracking enables:

- Per-assignment cost reporting
- Provider comparison (OpenAI vs. Anthropic cost for the same workload)
- Budget alerting before costs exceed limits

## How This Helps the Platform

Background grading is the platform's key differentiator — it transforms a manual 10-hour grading session into a 2-3 hour automated process with human review. The single-concurrency, notification-based design keeps it simple and cost-controlled for institutional deployments.
