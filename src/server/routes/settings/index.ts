import { Hono } from 'hono';
import type { AuthContext } from '../../middleware/auth.js';
import getLlmSettingsRoute from './get-llm-settings.js';
import updateLlmSettingsRoute from './update-llm-settings.js';
import listLlmProvidersRoute from './list-llm-providers.js';

const settings = new Hono<AuthContext>();

settings.route('/', getLlmSettingsRoute);
settings.route('/', updateLlmSettingsRoute);
settings.route('/', listLlmProvidersRoute);

export default settings;
