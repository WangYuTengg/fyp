import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../../db/index.js';
import { systemSettings } from '../../../db/schema.js';
import { authMiddleware, type AuthContext } from '../../middleware/auth.js';
import { HTTPException } from 'hono/http-exception';
import { pricing } from '../../config/pricing.js';
import { clearLLMSettingsCache } from '../../lib/ai.js';

const updateLlmSettingsRoute = new Hono<AuthContext>();

// Setting keys for LLM configuration
const LLM_PROVIDER_KEY = 'llm_provider';
const LLM_MODEL_KEY = 'llm_model';

// Available providers and their models
const availableProviders = {
  openai: {
    name: 'OpenAI',
    models: Object.keys(pricing.openai).map(model => ({
      id: model,
      name: model,
      inputPrice: pricing.openai[model as keyof typeof pricing.openai].input,
      outputPrice: pricing.openai[model as keyof typeof pricing.openai].output,
    })),
  },
  anthropic: {
    name: 'Anthropic',
    models: Object.keys(pricing.anthropic).map(model => ({
      id: model,
      name: model,
      inputPrice: pricing.anthropic[model as keyof typeof pricing.anthropic].input,
      outputPrice: pricing.anthropic[model as keyof typeof pricing.anthropic].output,
    })),
  },
};

// Schema for updating LLM settings
const updateLLMSettingsSchema = z.object({
  provider: z.enum(['openai', 'anthropic']),
  model: z.string().min(1),
});

/**
 * PUT /api/settings/llm
 * Update LLM provider/model settings
 */
updateLlmSettingsRoute.put('/llm', authMiddleware, async (c) => {
  const user = c.get('user');

  // Only admin can update settings
  if (!user || user.role !== 'admin') {
    throw new HTTPException(403, { message: 'Only administrators can update LLM settings' });
  }

  const body = await c.req.json();
  const parsed = updateLLMSettingsSchema.safeParse(body);

  if (!parsed.success) {
    throw new HTTPException(400, { message: 'Invalid request', cause: parsed.error });
  }

  const { provider, model } = parsed.data;

  // Validate model exists for provider
  const providerConfig = availableProviders[provider];
  if (!providerConfig.models.find(m => m.id === model)) {
    throw new HTTPException(400, { message: `Model ${model} not available for provider ${provider}` });
  }

  // Upsert provider setting
  await db
    .insert(systemSettings)
    .values({
      key: LLM_PROVIDER_KEY,
      value: provider,
      description: 'LLM provider for AI grading',
      updatedBy: user.id,
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: {
        value: provider,
        updatedAt: new Date(),
        updatedBy: user.id,
      },
    });

  // Upsert model setting
  await db
    .insert(systemSettings)
    .values({
      key: LLM_MODEL_KEY,
      value: model,
      description: 'LLM model for AI grading',
      updatedBy: user.id,
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: {
        value: model,
        updatedAt: new Date(),
        updatedBy: user.id,
      },
    });

  // Clear the AI settings cache
  clearLLMSettingsCache();

  return c.json({
    success: true,
    current: { provider, model },
  });
});

export default updateLlmSettingsRoute;
