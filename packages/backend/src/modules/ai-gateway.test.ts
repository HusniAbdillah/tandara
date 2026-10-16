import { afterEach, expect, it, vi } from 'vitest';
import { generateAssistance } from './ai-gateway.js';
import { deterministicAssistance } from './ai-policy.js';
import { chatThinkingOptions } from '../config/ai.js';

it('keeps unsupported thinking parameters out of other model requests', () => {
  expect(chatThinkingOptions('vikey', 'openai/gpt-4.1')).toEqual({});
  expect(chatThinkingOptions('vikey', 'deepseek/deepseek-r1')).toEqual({});
  expect(chatThinkingOptions('custom', 'local-model')).toEqual({});
  expect(chatThinkingOptions('deepseek', 'deepseek-flash')).toEqual({
    thinking: { type: 'disabled' },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it.each([
  'briefing',
  'training_draft',
  'plan_draft',
  'answer',
  'clarification',
  'public_summary',
  'translation',
  'coverage',
])('%s disables DeepSeek thinking through Vikey within the existing token cap', async (task) => {
  vi.stubEnv('AI_MODE', 'compatible');
  vi.stubEnv('AI_PROVIDER', 'vikey');
  vi.stubEnv('AI_BASE_URL', '');
  vi.stubEnv('AI_MODEL', 'deepseek/deepseek-v4-flash');
  vi.stubEnv('AI_API_KEY', 'test-key');
  vi.stubEnv('AI_MAX_OUTPUT_TOKENS', '1024');
  const output = deterministicAssistance([], task);
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(output) }, finish_reason: 'stop' }],
      }),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
  await generateAssistance(task, '', 'id', [], 'deepseek/deepseek-v4-flash');
  const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
  expect(body.thinking).toEqual({ type: 'disabled' });
  expect(body.max_tokens).toBe(1024);
});
