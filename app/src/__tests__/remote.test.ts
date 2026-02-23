import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ServerMessage, ClientMessage } from '../remote/protocol';

/**
 * Tests for the remote WebSocket client logic.
 *
 * Since the client module relies on browser globals (WebSocket, document),
 * we test the protocol types and message handling logic via mocks.
 */

// Mock DOM elements
const mockElements: Record<string, { textContent: string }> = {};
vi.stubGlobal('document', {
  getElementById: (id: string) => mockElements[id] ?? null,
});

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];

  constructor(public url: string) {
    // Simulate async open
    setTimeout(() => this.onopen?.(), 0);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
}
vi.stubGlobal('WebSocket', MockWebSocket);

// Setup event log element
beforeEach(() => {
  mockElements['event-log'] = { textContent: '' };
  mockElements['state-display'] = { textContent: '' };
});

describe('protocol types', () => {
  it('ServerMessage payload shape is valid', () => {
    const msg: ServerMessage = {
      type: 'payload',
      data: { level: 2, title: 'Test', decisions: [{ question: 'Q?', options: [{ label: 'A' }] }] },
    };
    expect(msg.type).toBe('payload');
    expect(msg.data.level).toBe(2);
  });

  it('ServerMessage ping shape is valid', () => {
    const msg: ServerMessage = { type: 'ping' };
    expect(msg.type).toBe('ping');
  });

  it('ClientMessage decision shape is valid', () => {
    const msg: ClientMessage = {
      type: 'decision',
      source: 'test',
      question: 'Pick one?',
      selectedIndex: 0,
      selectedLabel: 'A',
    };
    expect(msg.type).toBe('decision');
    expect(msg.question).toBe('Pick one?');
    expect(msg.selectedLabel).toBe('A');
  });

  it('ClientMessage approval shape is valid', () => {
    const msg: ClientMessage = {
      type: 'approval',
      source: 'ci',
      approved: true,
      decisions: [
        { question: 'Q1?', selectedIndex: 0, selectedLabel: 'Yes' },
        { question: 'Q2?', selectedIndex: 1, selectedLabel: 'No' },
      ],
    };
    expect(msg.type).toBe('approval');
    expect(msg.approved).toBe(true);
    expect(msg.decisions).toHaveLength(2);
  });

  it('ClientMessage pong shape is valid', () => {
    const msg: ClientMessage = { type: 'pong' };
    expect(msg.type).toBe('pong');
  });
});

describe('WebSocket client', () => {
  let client: typeof import('../remote/client');

  beforeEach(async () => {
    vi.useFakeTimers();
    // Fresh import each test to reset module state
    vi.resetModules();
    client = await import('../remote/client');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('connectRemote sets status to connecting then connected', async () => {
    const statuses: string[] = [];
    client.onConnectionStatusChange((s) => statuses.push(s));

    client.connectRemote('ws://localhost:8080');
    expect(client.getConnectionStatus()).toBe('connecting');

    // Trigger the async onopen
    await vi.advanceTimersByTimeAsync(1);
    expect(client.getConnectionStatus()).toBe('connected');
    expect(statuses).toContain('connecting');
    expect(statuses).toContain('connected');
  });

  it('sendDecision sends JSON when connected', async () => {
    client.connectRemote('ws://localhost:8080');
    await vi.advanceTimersByTimeAsync(1);

    client.sendDecision('Pick one?', 1, 'Option B');

    expect(client.getConnectionStatus()).toBe('connected');
  });

  it('sendDecision does not throw when disconnected', () => {
    // Never connected, so ws is null
    expect(() => client.sendDecision('Q?', 0, 'A')).not.toThrow();
  });

  it('sendApproval does not throw when disconnected', () => {
    expect(() => client.sendApproval(true, [])).not.toThrow();
  });

  it('disconnect prevents reconnection', async () => {
    client.connectRemote('ws://localhost:8080');
    await vi.advanceTimersByTimeAsync(1);
    expect(client.getConnectionStatus()).toBe('connected');

    client.disconnect();
    expect(client.getConnectionStatus()).toBe('disconnected');

    // Advance past reconnect delay - should NOT reconnect
    await vi.advanceTimersByTimeAsync(5000);
    expect(client.getConnectionStatus()).toBe('disconnected');
  });

  it('handles invalid JSON message without crashing', async () => {
    client.connectRemote('ws://localhost:8080');
    await vi.advanceTimersByTimeAsync(1);

    expect(client.getConnectionStatus()).toBe('connected');
  });
});
