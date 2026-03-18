# Server Configuration

Prompt templates, pricing tables, and application constants.

## Design Decisions

### Function-Based Prompt Templates

**Trade-off:** Prompts are code, not data — harder to edit without developer access.

LLM prompts are TypeScript functions that take parameters (student answer, model answer, rubric, max points) and return formatted strings. This was chosen over storing prompts in the database because:

- Prompts are version-controlled alongside the code that uses them
- TypeScript ensures all required parameters are provided
- Prompt changes can be reviewed in PRs alongside related code changes

The downside is that non-technical staff can't edit prompts without code access. If prompt customization becomes a requirement, they can be moved to the `systemSettings` table.

### Hardcoded Pricing Tables

**Trade-off:** Requires code updates when providers change pricing, but avoids API lookups.

Token costs are hardcoded per provider and model (e.g. OpenAI GPT-4o: $0.015/$0.06 per 1M input/output tokens). This was chosen over fetching pricing from provider APIs because:

- Provider pricing APIs don't exist or are unreliable
- Cost calculation must work offline (on-premise deployments)
- Pricing changes are infrequent and well-publicized

### Rate Limiting as Constants

**Trade-off:** Not configurable at runtime, but consistent across all deployments.

Rate limit values (1000 req/15min per IP) are constants rather than database settings. Rate limiting should be consistent and predictable — making it configurable introduces the risk of misconfiguration that could either lock out legitimate users or remove protection entirely.

## How This Helps the Platform

Configuration centralization ensures that LLM behavior (prompts, pricing, limits) is consistent and reviewable. Function-based prompts in particular prevent prompt drift — when the grading logic changes, the prompt must change in the same commit.
