# Staff Settings

System-wide LLM configuration — provider selection, model selection, and API key management.

## Design Decisions

### System-Level Settings (Not Per-Course)

**Trade-off:** Less granularity, but simpler administration.

LLM settings (provider, model, API key) are configured at the system level, not per-course. This was chosen because:

- Most school deployments have a single institutional API key
- Per-course settings would require every lecturer to manage their own keys
- Billing is centralized, so a single configuration point makes cost tracking straightforward

The limitation is that all courses use the same model — a future enhancement could allow per-course model overrides while keeping the API key centralized.

### Key-Value Store for Settings

**Trade-off:** Less structured than a typed settings table, but more flexible for adding new settings.

Settings are stored as key-value pairs in the `systemSettings` table (key: string, value: string) rather than a typed table with one column per setting. This allows adding new settings without a migration — important for a platform that may add new LLM providers or configuration options over time.

## How This Helps the Platform

Centralized LLM settings mean administrators configure the AI grading system once, and all courses benefit. This reduces the operational burden of deploying LLM-assisted grading across an institution.
