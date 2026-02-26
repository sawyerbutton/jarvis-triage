const httpUrl = process.env.JARVIS_RELAY_URL || 'http://localhost:8080';

// Derive WebSocket URL from HTTP URL (http→ws, https→wss)
function deriveWsUrl(url: string): string {
  if (process.env.JARVIS_RELAY_WS_URL) return process.env.JARVIS_RELAY_WS_URL;
  return url.replace(/^http/, 'ws');
}

export const config = {
  relayHttpUrl: httpUrl,
  relayWsUrl: deriveWsUrl(httpUrl),
  defaultSource: process.env.JARVIS_SOURCE || 'claude-code',
} as const;
