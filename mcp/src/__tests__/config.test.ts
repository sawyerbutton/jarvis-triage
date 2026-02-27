import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    // Clean relevant env vars
    delete process.env.JARVIS_RELAY_URL;
    delete process.env.JARVIS_RELAY_WS_URL;
    delete process.env.JARVIS_SOURCE;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('has correct defaults', async () => {
    const { config } = await import('../config.js');
    expect(config.relayHttpUrl).toBe('http://localhost:8080');
    expect(config.relayWsUrl).toBe('ws://localhost:8080');
    expect(config.defaultSource).toBe('claude-code');
  });

  it('derives ws:// from http://', async () => {
    process.env.JARVIS_RELAY_URL = 'http://example.com:3000';
    const { config } = await import('../config.js');
    expect(config.relayWsUrl).toBe('ws://example.com:3000');
  });

  it('derives wss:// from https://', async () => {
    process.env.JARVIS_RELAY_URL = 'https://secure.example.com';
    const { config } = await import('../config.js');
    expect(config.relayWsUrl).toBe('wss://secure.example.com');
  });

  it('respects JARVIS_RELAY_WS_URL override', async () => {
    process.env.JARVIS_RELAY_URL = 'http://example.com';
    process.env.JARVIS_RELAY_WS_URL = 'ws://custom:9999';
    const { config } = await import('../config.js');
    expect(config.relayWsUrl).toBe('ws://custom:9999');
  });

  it('respects JARVIS_SOURCE override', async () => {
    process.env.JARVIS_SOURCE = 'my-app';
    const { config } = await import('../config.js');
    expect(config.defaultSource).toBe('my-app');
  });

  it('respects JARVIS_RELAY_URL override for httpUrl', async () => {
    process.env.JARVIS_RELAY_URL = 'http://production:8081';
    const { config } = await import('../config.js');
    expect(config.relayHttpUrl).toBe('http://production:8081');
  });
});
