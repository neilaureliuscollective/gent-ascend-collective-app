import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { chart, packet } from './fixtures/evidence-board';
import { renderVisual } from '@/platform/openai/visual';
const board = {
  kind: 'diagram',
  basis: 'conceptual',
  title: 'Test map',
  summary: 'Conceptual.',
  nodes: [
    { id: 'one', label: 'One', detail: 'First.' },
    { id: 'two', label: 'Two', detail: 'Second.' },
  ],
  edges: [],
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it('uses the existing direct key/model with strict schema, no tools or provider storage', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'synthetic-key');
  const fetch = vi.fn().mockResolvedValue(
    Response.json({
      status: 'completed',
      output: [
        { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(board) }] },
      ],
      usage: { input_tokens: 80, output_tokens: 110 },
    }),
  );
  vi.stubGlobal('fetch', fetch);
  const result = await renderVisual('Map public architecture', 'diagram', 'existing-model');
  const body = JSON.parse(fetch.mock.calls[0]![1].body);
  expect(body.model).toBe('existing-model');
  expect(body.store).toBe(false);
  expect(body.tools).toBeUndefined();
  expect(body.text.format.strict).toBe(true);
  expect(body.text.format.schema.additionalProperties).toBe(false);
  expect(result.board).toEqual(board);
  expect(result.input).toBe(80);
  expect(result.text).toContain('no external sources retrieved');
});
it('rejects incomplete, refused and semantically invalid results instead of claiming a saved board', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'synthetic-key');
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  fetch.mockResolvedValueOnce(
    Response.json({
      status: 'incomplete',
      output: [],
      usage: { input_tokens: 8, output_tokens: 12 },
    }),
  );
  await expect(renderVisual('Map system', 'diagram', 'model')).rejects.toMatchObject({
    message: expect.stringContaining('unconfirmed'),
    input: 8,
    output: 12,
  });
  fetch.mockResolvedValueOnce(
    Response.json({
      status: 'completed',
      output: [{ type: 'message', content: [{ type: 'refusal' }] }],
    }),
  );
  await expect(renderVisual('Map system', 'diagram', 'model')).rejects.toThrow(/invalid/);
  fetch.mockResolvedValueOnce(
    Response.json({
      status: 'completed',
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: JSON.stringify({
                ...board,
                edges: [{ from: 'one', to: 'absent', label: 'Invalid' }],
              }),
            },
          ],
        },
      ],
    }),
  );
  await expect(renderVisual('Map system', 'diagram', 'model')).rejects.toThrow(/invalid/);
});

it('formats only captured research evidence and never asks the extraction step to search', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'synthetic-key');
  const { sources, retrievedAt, ...draft } = chart;
  void sources;
  void retrievedAt;
  const fetch = vi
    .fn()
    .mockResolvedValue(
      Response.json({
        status: 'completed',
        output: [
          { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(draft) }] },
        ],
        usage: { input_tokens: 20, output_tokens: 30 },
      }),
    );
  vi.stubGlobal('fetch', fetch);
  const result = await renderVisual('Public revenue chart', 'chart', 'existing-model', packet);
  expect(result.board).toEqual(chart);
  const body = JSON.parse(fetch.mock.calls[0]![1].body);
  expect(body.tools).toBeUndefined();
  expect(body.store).toBe(false);
  expect(body.text.format.schema.properties.sources).toBeUndefined();
  const forged = {
    ...draft,
    points: draft.points.map((point, index) => (index === 0 ? { ...point, value: 99 } : point)),
  };
  fetch.mockResolvedValueOnce(
    Response.json({
      status: 'completed',
      output: [
        { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(forged) }] },
      ],
      usage: { input_tokens: 20, output_tokens: 30 },
    }),
  );
  await expect(
    renderVisual('Public revenue chart', 'chart', 'existing-model', packet),
  ).rejects.toMatchObject({ input: 20, output: 30 });
});
