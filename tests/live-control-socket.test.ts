import { createServer } from 'node:http';
import { expect, it, vi } from 'vitest';
import { liveControlSocketUrl, openLiveControlSocket } from '@/domains/live/control-socket';

it('builds the official Realtime sideband URL without embedding the key', () => {
  const url = liveControlSocketUrl('rtc_synthetic');
  expect(url).toBe('wss://api.openai.com/v1/realtime?call_id=rtc_synthetic');
  expect(url).not.toMatch(/Bearer|sk-|key/i);
});

it('authenticates the Node sideband with an Authorization header', () => {
  const opened: unknown[] = [];
  class Socket {
    constructor(url: string, init: { headers?: Record<string, string> }) {
      opened.push({ url, init });
    }
  }
  const previous = globalThis.WebSocket;
  vi.stubGlobal('WebSocket', Socket);
  try {
    openLiveControlSocket('rtc_synthetic', 'synthetic-provider');
    expect(opened).toEqual([
      {
        url: 'wss://api.openai.com/v1/realtime?call_id=rtc_synthetic',
        init: { headers: { Authorization: 'Bearer synthetic-provider' } },
      },
    ]);
  } finally {
    vi.stubGlobal('WebSocket', previous);
  }
});

it('sends Authorization as a handshake header on this Node WebSocket runtime', async () => {
  const received: { authorization: string | null; protocol: string | null }[] = [];
  const server = createServer();
  server.on('upgrade', (request, socket) => {
    received.push({
      authorization: request.headers.authorization ?? null,
      protocol: request.headers['sec-websocket-protocol'] ?? null,
    });
    socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    socket.destroy();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  const previous = globalThis.WebSocket;
  try {
    const socket = new previous(`ws://127.0.0.1:${port}/v1/realtime?call_id=rtc_synthetic`, {
      headers: { Authorization: 'Bearer synthetic-provider' },
    } as unknown as string[]);
    await new Promise<void>((resolve) => {
      socket.addEventListener('close', () => resolve());
      socket.addEventListener('error', () => resolve());
      setTimeout(resolve, 1000);
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
  expect(received).toEqual([{ authorization: 'Bearer synthetic-provider', protocol: null }]);
});
