import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { OpenAILiveProtocol, liveStartup } from '@/domains/live/gpt-live/protocol';
import { createGPTLive, hangupGPTLive, liveSidebandURL } from '@/domains/live/gpt-live/provider';
describe('GPT-Live evaluation contract', () => {
  it('retains overlapping captions and correlates delegation with provisional task context', () => {
    const live = new OpenAILiveProtocol();
    live.accept({
      type: 'session.input_transcript.delta',
      event_id: 'u',
      delta: 'Create a city',
      start_ms: 100,
      end_ms: 600,
    });
    live.accept({
      type: 'session.output_transcript.delta',
      event_id: 'a',
      delta: 'What style?',
      start_ms: 200,
      end_ms: 800,
    });
    const event = {
      type: 'session.delegation.created',
      event_id: 'd',
      offset_ms: 900,
      delegation: { id: 'opaque_delegation', target: 'client' },
    };
    expect(live.accept(event)).toMatchObject({
      id: 'opaque_delegation',
      provisional: true,
      fragments: [{ role: 'user' }, { role: 'assistant' }],
    });
    expect(live.accept({ ...event, event_id: 'd2' })).toBeNull();
  });
  it('uses cumulative duration and requires an explicit finalization event', () => {
    const live = new OpenAILiveProtocol();
    live.accept({ type: 'session.usage.updated', event_id: '1', usage: { seconds: 12 } });
    live.accept({ type: 'session.usage.updated', event_id: '2', usage: { seconds: 15 } });
    expect(live.seconds).toBe(15);
    expect(live.finalized).toBe(false);
    live.closeCommand();
    expect(live.finalized).toBe(false);
    live.accept({
      type: 'session.closed',
      event_id: '3',
      session: { id: 'live_opaque' },
      usage: { seconds: 16 },
      reason: 'close_requested',
    });
    expect(live.finalized).toBe(true);
    expect(live.seconds).toBe(16);
  });
  it('drains captions and usage while closing without accepting new work', () => {
    const live = new OpenAILiveProtocol('owned');
    live.accept({ type: 'session.started', event_id: 'start', session: { id: 'owned' } });
    live.closeCommand();
    expect(() => live.update(null, 'New task')).toThrow('not ready');
    expect(() => live.closeCommand()).toThrow('already closing');
    expect(
      live.accept({
        type: 'session.delegation.created',
        event_id: 'work',
        offset_ms: 10,
        delegation: { id: 'late-work', target: 'client' },
      }),
    ).toBeNull();
    live.accept({
      type: 'session.output_transcript.delta',
      event_id: 'caption',
      delta: 'Goodbye',
      start_ms: 0,
      end_ms: 10,
    });
    expect(live.fragments).toHaveLength(1);
    expect(live.finalized).toBe(false);
    live.accept({
      type: 'session.closed',
      event_id: 'closed',
      session: { id: 'owned' },
      usage: { seconds: 16 },
    });
    expect(live.finalized).toBe(true);
    live.accept({ type: 'session.usage.updated', event_id: 'late', usage: { seconds: 1000 } });
    expect(live.seconds).toBe(16);
  });
  it('rejects foreign finalization and usage while accepting sessionless cumulative updates', () => {
    const live = new OpenAILiveProtocol('owned');
    live.accept({ type: 'session.usage.updated', event_id: 'running', usage: { seconds: 12 } });
    live.accept({
      type: 'session.closed',
      event_id: 'foreign',
      session: { id: 'other' },
      usage: { seconds: 999 },
    });
    live.accept({
      type: 'session.usage.updated',
      event_id: 'foreign-update',
      session: { id: 'other' },
      usage: { seconds: 999 },
    });
    expect(live.seconds).toBe(12);
    expect(live.finalized).toBe(false);
    live.accept({
      type: 'session.closed',
      event_id: 'invalid',
      session: { id: 'owned' },
      usage: { seconds: -1 },
    });
    expect(live.finalized).toBe(false);
  });
  it('does not expose privileged frontend commands or persist provider recordings', () => {
    const config = liveStartup({
      voice: 'cedar',
      history: [{ role: 'user', text: 'Untrusted context' }],
    });
    expect(config.store).toBe(false);
    expect(config.delegation).toEqual({ type: 'client' });
    expect(config.client.data_channel.allowed_client_events).not.toContain(
      'session.instructions.append',
    );
    expect(config.client.data_channel.allowed_client_events).not.toContain('response.create');
    expect(config.input[0]?.role).toBe('user');
    expect(config.instructions).toContain('Aethelios — The Human Ascendance');
    expect(config.instructions).toContain('without a real receipt');
  });
  it('uses JSON Live session creation and preserves the provider session ID unchanged', async () => {
    const request = vi.fn().mockResolvedValue(
      Response.json({
        session: { id: 'live_opaque/prefix' },
        transport: { type: 'webrtc', sdp: 'v=0\r\na=synthetic-answer' },
      }),
    );
    const result = await createGPTLive(
      'synthetic-key',
      'v=0\r\na=synthetic-offer',
      { voice: 'marin', history: [] },
      request,
    );
    expect(result.session.id).toBe('live_opaque/prefix');
    const body = JSON.parse(request.mock.calls[0]![1].body);
    expect(request.mock.calls[0]![1].redirect).toBe('error');
    expect(body.transport.type).toBe('webrtc');
    expect(body.session.model).toBe('gpt-live-1');
    expect(liveSidebandURL(result.session.id)).toContain('live_opaque%2Fprefix');
    request.mockResolvedValue(new Response(null, { status: 200 }));
    await hangupGPTLive('synthetic-key', result.session.id, request);
    expect(request.mock.calls[1]![1].redirect).toBe('error');
    expect(request.mock.calls[1]![0]).toContain('/live/sessions/live_opaque%2Fprefix/hangup');
  });
});
