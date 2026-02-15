import { Hono } from 'hono';
import { authMiddleware, type AuthContext } from '../../middleware/auth.js';
import { HTTPException } from 'hono/http-exception';
import { pricing } from '../../config/pricing.js';

const listLlmProvidersRoute = new Hono<AuthContext>();

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
 * GET /api/settings/llm/providers
 * Get available providers and models
 */
listLlmProvidersRoute.get('/llm/providers', authMiddleware, async (c) => {
  const user = c.get('user');

  if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
    throw new HTTPException(403, { message: 'Unauthorized' });
  }

  return c.json(availableProviders);
});

export default listLlmProvidersRoute;
