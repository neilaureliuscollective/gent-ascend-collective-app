// Official server-side Realtime sideband: Authorization header, not the browser insecure protocol.
export function liveControlSocketUrl(callId: string) {
  return `wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(callId)}`;
}

type NodeWebSocket = {
  new (address: string, options: { headers: Record<string, string> }): WebSocket;
};

export function openLiveControlSocket(callId: string, key: string) {
  return new (WebSocket as unknown as NodeWebSocket)(liveControlSocketUrl(callId), {
    headers: { Authorization: `Bearer ${key}` },
  });
}
