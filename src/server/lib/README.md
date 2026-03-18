# Server Library

Core utilities — LLM provider factory, notification system, file storage, worker initialization, and validation helpers.

## Design Decisions

### LLM Provider Factory with Caching

**Trade-off:** Cached settings may be stale for up to 1 minute, but avoids database lookups on every LLM call.

`getModel()` reads LLM settings (provider, model, API key) from the `systemSettings` table and caches them with a 1-minute TTL. This means changing the LLM provider takes up to 60 seconds to take effect. The cache exists because grading jobs call `getModel()` for every question — hitting the database each time would add unnecessary latency.

`clearLLMSettingsCache()` is called when settings are updated via the admin UI, providing immediate cache invalidation for manual changes.

### Unified LLM Interface (generateAIText, generateAIObject, generateAIVision)

**Trade-off:** Abstraction layer over Vercel AI SDK, but consistent error handling and config.

Three functions cover all LLM use cases:
- `generateAIText()` — free-form text completion
- `generateAIObject()` — structured JSON output with Zod validation
- `generateAIVision()` — image analysis (UML diagrams)

Each function applies consistent timeout (60s), error handling, and token tracking. The alternative — calling the AI SDK directly from each job — would duplicate timeout/error logic.

### Notification Helpers (Not a Full Event System)

**Trade-off:** Direct database inserts instead of a pub/sub system, but simpler.

`notifyGradingFailed()` and `checkBatchCompletion()` insert rows directly into the `staffNotifications` table. A pub/sub or event system would be more flexible but is overkill for 3 notification types. If notification types grow significantly, this should be refactored.

### File Storage Abstraction

**Trade-off:** Currently tied to a specific storage provider, but the abstraction layer allows swapping.

File upload/download is routed through a storage abstraction that can target S3-compatible services. The abstraction exists because on-premise deployments may use MinIO or local storage instead of AWS S3.

## How This Helps the Platform

These utilities centralize cross-cutting concerns (LLM access, notifications, storage) so that route handlers and jobs stay focused on business logic. The LLM factory in particular ensures that switching providers is a configuration change, not a code change.
