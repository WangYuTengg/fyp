import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock external dependencies BEFORE importing the module under test
// ---------------------------------------------------------------------------
const mockDbLimit = vi.fn();

vi.mock('../../db/index.js', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: (condition: unknown) => ({
          limit: (n: number) => mockDbLimit(),
        }),
      }),
    }),
  },
}));

vi.mock('../../db/schema.js', () => ({
  systemSettings: { key: 'key', value: 'value' },
}));

const mockOpenai = vi.fn((model: string) => ({ provider: 'openai', model }));
const mockAnthropic = vi.fn((model: string) => ({ provider: 'anthropic', model }));

vi.mock('@ai-sdk/openai', () => ({
  openai: (model: string) => mockOpenai(model),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: (model: string) => mockAnthropic(model),
}));

const mockGenerateText = vi.fn();
vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  Output: { object: ({ schema }: { schema: unknown }) => ({ schema }) },
}));

// Import module AFTER mocks are set up
import { clearLLMSettingsCache, getAIConfig, generateAIText, generateAIVision } from './ai';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  clearLLMSettingsCache();
  vi.clearAllMocks();
  delete process.env.LLM_PROVIDER;
  delete process.env.LLM_MODEL;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// getAIConfig / getLLMSettings
// ---------------------------------------------------------------------------
describe('getAIConfig — provider selection', () => {
  it('returns OpenAI config from DB settings', async () => {
    mockDbLimit
      .mockResolvedValueOnce([{ value: 'openai' }])   // provider query
      .mockResolvedValueOnce([{ value: 'gpt-4o' }]);  // model query

    const config = await getAIConfig();
    expect(config).toEqual({ provider: 'openai', model: 'gpt-4o' });
  });

  it('returns Anthropic config from DB settings', async () => {
    mockDbLimit
      .mockResolvedValueOnce([{ value: 'anthropic' }])
      .mockResolvedValueOnce([{ value: 'claude-3-5-sonnet-latest' }]);

    const config = await getAIConfig();
    expect(config).toEqual({ provider: 'anthropic', model: 'claude-3-5-sonnet-latest' });
  });

  it('falls back to env vars when DB returns empty', async () => {
    process.env.LLM_PROVIDER = 'anthropic';
    process.env.LLM_MODEL = 'claude-3-opus-latest';

    mockDbLimit
      .mockResolvedValueOnce([])   // no provider in DB
      .mockResolvedValueOnce([]);  // no model in DB

    const config = await getAIConfig();
    expect(config).toEqual({ provider: 'anthropic', model: 'claude-3-opus-latest' });
  });

  it('falls back to openai/gpt-4o when DB empty and no env vars', async () => {
    mockDbLimit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const config = await getAIConfig();
    expect(config).toEqual({ provider: 'openai', model: 'gpt-4o' });
  });

  it('falls back to env vars when DB query throws', async () => {
    process.env.LLM_PROVIDER = 'anthropic';
    process.env.LLM_MODEL = 'claude-3-5-sonnet-latest';

    mockDbLimit.mockRejectedValueOnce(new Error('DB connection failed'));

    const config = await getAIConfig();
    expect(config).toEqual({ provider: 'anthropic', model: 'claude-3-5-sonnet-latest' });
  });

  it('falls back to defaults when DB throws and no env vars', async () => {
    mockDbLimit.mockRejectedValueOnce(new Error('DB connection failed'));

    const config = await getAIConfig();
    expect(config).toEqual({ provider: 'openai', model: 'gpt-4o' });
  });
});

// ---------------------------------------------------------------------------
// Cache behavior
// ---------------------------------------------------------------------------
describe('getAIConfig — cache', () => {
  it('returns cached settings on second call within TTL', async () => {
    mockDbLimit
      .mockResolvedValueOnce([{ value: 'openai' }])
      .mockResolvedValueOnce([{ value: 'gpt-4o' }]);

    const first = await getAIConfig();
    const second = await getAIConfig();

    expect(first).toEqual(second);
    // DB should only be called for the first request (2 queries)
    expect(mockDbLimit).toHaveBeenCalledTimes(2);
  });

  it('refreshes cache after clearLLMSettingsCache()', async () => {
    mockDbLimit
      .mockResolvedValueOnce([{ value: 'openai' }])
      .mockResolvedValueOnce([{ value: 'gpt-4o' }])
      .mockResolvedValueOnce([{ value: 'anthropic' }])
      .mockResolvedValueOnce([{ value: 'claude-3-5-sonnet-latest' }]);

    const first = await getAIConfig();
    expect(first.provider).toBe('openai');

    clearLLMSettingsCache();

    const second = await getAIConfig();
    expect(second.provider).toBe('anthropic');
    expect(mockDbLimit).toHaveBeenCalledTimes(4);
  });
});

// ---------------------------------------------------------------------------
// generateAIText
// ---------------------------------------------------------------------------
describe('generateAIText', () => {
  it('calls generateText with OpenAI model and returns usage', async () => {
    mockDbLimit
      .mockResolvedValueOnce([{ value: 'openai' }])
      .mockResolvedValueOnce([{ value: 'gpt-4o' }]);

    mockGenerateText.mockResolvedValueOnce({
      text: 'Hello world',
      usage: { totalTokens: 100, inputTokens: 60, outputTokens: 40 },
    });

    const result = await generateAIText('Say hello', 'You are helpful');
    expect(result.text).toBe('Hello world');
    expect(result.tokensUsed).toBe(100);
    expect(result.inputTokens).toBe(60);
    expect(result.outputTokens).toBe(40);
    expect(mockOpenai).toHaveBeenCalledWith('gpt-4o');
  });

  it('calls generateText with Anthropic model', async () => {
    mockDbLimit
      .mockResolvedValueOnce([{ value: 'anthropic' }])
      .mockResolvedValueOnce([{ value: 'claude-3-5-sonnet-latest' }]);

    mockGenerateText.mockResolvedValueOnce({
      text: 'Hi',
      usage: { totalTokens: 50, inputTokens: 30, outputTokens: 20 },
    });

    const result = await generateAIText('Hello');
    expect(result.text).toBe('Hi');
    expect(mockAnthropic).toHaveBeenCalledWith('claude-3-5-sonnet-latest');
  });

  it('defaults token counts to 0 when usage is undefined', async () => {
    mockDbLimit
      .mockResolvedValueOnce([{ value: 'openai' }])
      .mockResolvedValueOnce([{ value: 'gpt-4o' }]);

    mockGenerateText.mockResolvedValueOnce({
      text: 'No usage',
      usage: undefined,
    });

    const result = await generateAIText('Test');
    expect(result.tokensUsed).toBe(0);
    expect(result.inputTokens).toBe(0);
    expect(result.outputTokens).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// generateAIVision
// ---------------------------------------------------------------------------
describe('generateAIVision', () => {
  it('sends image URL in multimodal message format', async () => {
    mockDbLimit
      .mockResolvedValueOnce([{ value: 'openai' }])
      .mockResolvedValueOnce([{ value: 'gpt-4o' }]);

    mockGenerateText.mockResolvedValueOnce({
      text: 'I see a UML diagram',
      usage: { totalTokens: 200, inputTokens: 150, outputTokens: 50 },
    });

    const result = await generateAIVision(
      'https://example.com/diagram.png',
      'Describe this diagram',
      'You are a UML expert',
    );

    expect(result.text).toBe('I see a UML diagram');
    expect(result.tokensUsed).toBe(200);

    // Verify the message structure includes image content and system prompt
    const call = mockGenerateText.mock.calls[0][0];
    expect(call.messages).toBeDefined();
    expect(call.messages[0].content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'text', text: 'You are a UML expert' }),
        expect.objectContaining({ type: 'image', image: 'https://example.com/diagram.png' }),
        expect.objectContaining({ type: 'text', text: 'Describe this diagram' }),
      ]),
    );
  });

  it('uses default system prompt when none provided', async () => {
    mockDbLimit
      .mockResolvedValueOnce([{ value: 'openai' }])
      .mockResolvedValueOnce([{ value: 'gpt-4o' }]);

    mockGenerateText.mockResolvedValueOnce({
      text: 'Result',
      usage: { totalTokens: 10, inputTokens: 5, outputTokens: 5 },
    });

    await generateAIVision('https://example.com/img.png', 'Describe');

    const call = mockGenerateText.mock.calls[0][0];
    expect(call.messages[0].content[0].text).toBe('You are a helpful assistant.');
  });
});
