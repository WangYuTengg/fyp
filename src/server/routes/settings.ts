import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { systemSettings } from '../../db/schema.js';
import { authMiddleware, type AuthContext } from '../middleware/auth.js';
import { HTTPException } from 'hono/http-exception';
import { pricing } from '../config/pricing.js';
import { clearLLMSettingsCache } from '../lib/ai.js';

const settingsRouter = new Hono<AuthContext>();

// All routes require auth and staff/admin role
settingsRouter.use('*', authMiddleware);

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
 * GET /api/settings/llm
 * Get current LLM provider/model settings
 */
settingsRouter.get('/llm', async (c) => {
  const user = c.get('user');
  
  // Only staff/admin can view settings
  if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
    throw new HTTPException(403, { message: 'Unauthorized' });
  }

  // Get settings from database
  const providerSetting = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, LLM_PROVIDER_KEY))
    .limit(1);

  const modelSetting = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, LLM_MODEL_KEY))
    .limit(1);

  // Fall back to env vars if not set in DB
  const currentProvider = providerSetting[0]?.value || process.env.LLM_PROVIDER || 'openai';
  const currentModel = modelSetting[0]?.value || process.env.LLM_MODEL || 'gpt-4o';

  return c.json({
    current: {
      provider: currentProvider,
      model: currentModel,
    },
    available: availableProviders,
  });
});

/**
 * PUT /api/settings/llm
 * Update LLM provider/model settings
 */
settingsRouter.put('/llm', async (c) => {
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

/**
 * GET /api/settings/llm/providers
 * Get available providers and models
 */
settingsRouter.get('/llm/providers', async (c) => {
  const user = c.get('user');
  
  if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
    throw new HTTPException(403, { message: 'Unauthorized' });
  }

  return c.json(availableProviders);
});

export default settingsRouter;
