import { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiRequestError } from '../../lib/api';

interface ModelInfo {
  id: string;
  name: string;
  inputPrice: number;
  outputPrice: number;
}

interface ProviderInfo {
  name: string;
  models: ModelInfo[];
}

interface LLMSettingsResponse {
  current: {
    provider: string;
    model: string;
  };
  available: Record<string, ProviderInfo>;
}

interface SaveResponse {
  success: boolean;
  current: { provider: string; model: string };
}

export function StaffSettings() {
  const [settings, setSettings] = useState<LLMSettingsResponse | null>(null);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient<LLMSettingsResponse>('/api/settings/llm');
      setSettings(data);
      setSelectedProvider(data.current.provider);
      setSelectedModel(data.current.model);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    // Auto-select first model of new provider
    if (settings?.available[provider]) {
      setSelectedModel(settings.available[provider].models[0]?.id || '');
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await apiClient<SaveResponse>('/api/settings/llm', {
        method: 'PUT',
        body: JSON.stringify({
          provider: selectedProvider,
          model: selectedModel,
        }),
      });

      setSuccess('Settings saved successfully!');
      // Refresh settings to show updated current value
      await fetchSettings();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to save settings');
      }
    } finally {
      setSaving(false);
    }
  };

  const currentProviderModels = settings?.available[selectedProvider]?.models || [];
  const selectedModelInfo = currentProviderModels.find(m => m.id === selectedModel);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="h-40 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      {/* LLM Configuration Section */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          AI Grading Configuration
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Configure the LLM provider and model used for auto-grading assignments.
          Changes take effect immediately for new grading jobs.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
            {success}
          </div>
        )}

        <div className="space-y-6">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Provider
            </label>
            <div className="grid grid-cols-2 gap-3">
              {settings && Object.entries(settings.available).map(([key, provider]) => (
                <button
                  key={key}
                  onClick={() => handleProviderChange(key)}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    selectedProvider === key
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="font-medium text-gray-900">{provider.name}</span>
                  <span className="block text-xs text-gray-500 mt-1">
                    {provider.models.length} models available
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Model
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="form-select-block"
            >
              {currentProviderModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>

          {/* Pricing Info */}
          {selectedModelInfo && (
            <div className="bg-gray-50 rounded-md p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Pricing (per 1M tokens)
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Input:</span>{' '}
                  <span className="font-medium">${selectedModelInfo.inputPrice.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Output:</span>{' '}
                  <span className="font-medium">${selectedModelInfo.outputPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Current Setting */}
          {settings && (
            <div className="text-sm text-gray-500">
              Current: <span className="font-medium">{settings.current.provider}</span> /{' '}
              <span className="font-medium">{settings.current.model}</span>
            </div>
          )}

          {/* Save Button */}
          <div className="pt-4 border-t">
            <button
              onClick={handleSave}
              disabled={saving || (selectedProvider === settings?.current.provider && selectedModel === settings?.current.model)}
              className={`px-4 py-2 rounded-md text-white font-medium transition-colors ${
                saving || (selectedProvider === settings?.current.provider && selectedModel === settings?.current.model)
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Environment Variables Info */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          API Keys Configuration
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          API keys must be configured via environment variables on the server.
          Contact your system administrator to update these values.
        </p>
        <div className="text-sm font-mono bg-white rounded p-3 border">
          <div className="text-gray-500"># OpenAI</div>
          <div>OPENAI_API_KEY=sk-...</div>
          <div className="text-gray-500 mt-2"># Anthropic</div>
          <div>ANTHROPIC_API_KEY=sk-ant-...</div>
        </div>
      </div>
    </div>
  );
}

export default StaffSettings;
