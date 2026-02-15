import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { systemSettings } from '../../../db/schema.js';
import { authMiddleware, type AuthContext } from '../../middleware/auth.js';
import { HTTPException } from 'hono/http-exception';
import { pricing } from '../../config/pricing.js';
import { eq } from 'drizzle-orm';

const getLlmSettingsRoute = new Hono<AuthContext>();

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

/**
 * GET /api/settings/llm
 * Get current LLM provider/model settings
 */
getLlmSettingsRoute.get('/llm', authMiddleware, async (c) => {
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

export default getLlmSettingsRoute;
