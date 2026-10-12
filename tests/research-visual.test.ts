import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mock = vi.hoisted(() => ({ reply: vi.fn(), visual: vi.fn() }));
vi.mock('@/domains/intelligence/model', () => ({ generateReply: mock.reply }));
vi.mock('@/platform/openai/visual', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/platform/openai/visual')>()),
  renderVisual: mock.visual,
}));
import { renderResearchVisual } from '@/domains/artifacts/research-visual';
import { VisualProviderError } from '@/platform/openai/visual';
import { chart, packet } from './fixtures/evidence-board';
beforeEach(() => {
  vi.clearAllMocks();
  mock.reply.mockImplementation((_model, _messages, _signal, _founder, onSource) => {
    onSource({ url: 'javascript:alert(1)', title: 'Bad' });
    onSource(packet.sources[0]);
    onSource(packet.sources[0]);
    return (async function* () {
      yield { type: 'text', text: packet.text };
      yield { type: 'finish', reason: 'stop', input: 30, output: 40 };
    })();
  });
  mock.visual.mockResolvedValue({
    board: chart,
    text: 'Synthetic chart',
    input: 5,
    output: 10,
    stages: 1,
    usageComplete: true,
  });
});
it('reuses bounded public research, passes only provider-returned links, and aggregates both stages', async () => {
  const result = await renderResearchVisual(
    'Compare public revenue in USD for 2025',
    'chart',
    'existing-model',
  );
  expect(result.input).toBe(35);
  expect(result.output).toBe(50);
  expect(result.stages).toBe(2);
  expect(result.usageComplete).toBe(true);
  expect(mock.reply.mock.calls[0]![1]).toHaveLength(1);
  expect(mock.reply.mock.calls[0]![1][0].content).toContain('No profile');
  expect(mock.visual.mock.calls[0]![3].sources).toEqual(packet.sources);
});
it('does not make a formatting call without complete cited research', async () => {
  mock.reply.mockReturnValue(
    (async function* () {
      yield { type: 'text', text: 'An uncited result' };
      yield { type: 'finish', reason: 'stop', input: 30, output: 40 };
    })(),
  );
  await expect(renderResearchVisual('Public task', 'chart', 'model')).rejects.toMatchObject({
    stages: 1,
    input: 30,
    output: 40,
  });
  expect(mock.visual).not.toHaveBeenCalled();
});
it('retains known token counts when extraction fails and never automatically replays a stage', async () => {
  mock.visual.mockRejectedValue(new VisualProviderError('Refused', 5, 10));
  await expect(renderResearchVisual('Public task', 'chart', 'model')).rejects.toMatchObject({
    input: 35,
    output: 50,
    stages: 2,
    usageComplete: true,
  });
  expect(mock.reply).toHaveBeenCalledTimes(1);
  expect(mock.visual).toHaveBeenCalledTimes(1);
});
it('marks partial metering when a second-stage connection fails without returned usage', async () => {
  mock.visual.mockRejectedValue(new Error('Connection lost'));
  await expect(renderResearchVisual('Public task', 'chart', 'model')).rejects.toMatchObject({
    input: 30,
    output: 40,
    stages: 2,
    usageComplete: false,
  });
});
