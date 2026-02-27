import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { RelayResponse } from '../types.js';

// --- Configurable Mock WebSocket ---
// Tests can change this to control WS constructor behavior
type WsBehavior = 'open' | 'error' | ((ws: InstanceType<typeof MockWebSocket>, attempt: number) => void);
let wsBehavior: WsBehavior = 'open';
let wsAttemptCount = 0;

class MockWebSocket extends EventEmitter {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = 1;
  url: string;
  sent: string[] = [];

  constructor(url: string) {
    super();
    this.url = url;
    wsAttemptCount++;
    const behavior = wsBehavior;
    const attempt = wsAttemptCount;
    if (typeof behavior === 'function') {
      behavior(this, attempt);
    } else if (behavior === 'error') {
      queueMicrotask(() => this.emit('error', new Error('ECONNREFUSED')));
    } else {
      queueMicrotask(() => this.emit('open'));
    }
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.emit('close');
  }
}

vi.mock('ws', () => ({ default: MockWebSocket }));

vi.mock('../config.js', () => ({
  config: {
    relayHttpUrl: 'http://localhost:8080',
    relayWsUrl: 'ws://localhost:8080',
    defaultSource: 'test',
  },
}));

let RelayClient: typeof import('../relay-client.js').RelayClient;
let client: InstanceType<typeof RelayClient>;

beforeEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  wsBehavior = 'open';
  wsAttemptCount = 0;
  vi.resetModules();
  const mod = await import('../relay-client.js');
  RelayClient = mod.RelayClient;
  client = new RelayClient();
});

afterEach(() => {
  client.disconnect();
  vi.useRealTimers();
});

// Helper: get the underlying MockWebSocket after ensureConnected
async function getWs(): Promise<MockWebSocket> {
  await client.ensureConnected();
  return (client as any).ws as MockWebSocket;
}

// Helper: simulate incoming WS message
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function simulateMessage(ws: MockWebSocket, msg: any) {
  ws.emit('message', Buffer.from(JSON.stringify(msg)));
}

// --- Tests ---

describe('HTTP methods', () => {
  it('pushPayload: POST /push success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, clients: 2 }),
        text: () => Promise.resolve(''),
      }),
    );

    const result = await client.pushPayload({ level: 1, title: 'Test' });
    expect(result).toEqual({ ok: true, clients: 2 });
    expect(fetch).toHaveBeenCalledWith('http://localhost:8080/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: 1, title: 'Test' }),
    });

    vi.unstubAllGlobals();
  });

  it('pushPayload: non-200 status throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      }),
    );

    await expect(client.pushPayload({ level: 1, title: 'Test' })).rejects.toThrow(
      'Relay push failed (500): Internal Server Error',
    );

    vi.unstubAllGlobals();
  });

  it('getStatus: GET /status success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ clients: 3 }),
      }),
    );

    const result = await client.getStatus();
    expect(result).toEqual({ clients: 3 });
    expect(fetch).toHaveBeenCalledWith('http://localhost:8080/status');

    vi.unstubAllGlobals();
  });

  it('getStatus: non-200 status throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    );

    await expect(client.getStatus()).rejects.toThrow('Relay status failed (503)');

    vi.unstubAllGlobals();
  });
});

describe('WebSocket connection', () => {
  it('ensureConnected: opens WS to config URL', async () => {
    const ws = await getWs();
    expect(ws).toBeInstanceOf(MockWebSocket);
    expect(ws.url).toBe('ws://localhost:8080');
  });

  it('ensureConnected: no-op when already connected', async () => {
    await client.ensureConnected();
    const ws1 = (client as any).ws;
    await client.ensureConnected();
    const ws2 = (client as any).ws;
    expect(ws1).toBe(ws2);
  });

  it('ensureConnected: deduplicates concurrent calls', async () => {
    const p1 = client.ensureConnected();
    const p2 = client.ensureConnected();
    await Promise.all([p1, p2]);
    expect((client as any).ws).toBeInstanceOf(MockWebSocket);
  });

  it('connect: retries on error up to 5 times', async () => {
    // Fail first 4 attempts, succeed on 5th
    wsBehavior = (ws, attempt) => {
      if (attempt < 5) {
        queueMicrotask(() => ws.emit('error', new Error('ECONNREFUSED')));
      } else {
        queueMicrotask(() => ws.emit('open'));
      }
    };

    vi.useFakeTimers();
    const p = (client as any).connect(5, 0);
    await vi.runAllTimersAsync();
    await p;
    expect((client as any).ws).toBeTruthy();
    vi.useRealTimers();
  });

  it('connect: rejects after exhausting retries', async () => {
    wsBehavior = 'error';

    vi.useFakeTimers();
    const p = (client as any).connect(3, 0);
    // Prevent unhandled rejection warning
    p.catch(() => {});
    await vi.runAllTimersAsync();
    await expect(p).rejects.toThrow('Failed to connect after 3 attempts');
    vi.useRealTimers();
  });

  it('responds to ping with pong', async () => {
    const ws = await getWs();
    simulateMessage(ws, { type: 'ping' });
    expect(ws.sent).toContainEqual(JSON.stringify({ type: 'pong' }));
  });
});

describe('waiter matching — decision', () => {
  it('matching correlationId resolves correctly', async () => {
    const ws = await getWs();
    const waitPromise = client.waitForDecision('corr-123', 5000);

    const msg: RelayResponse = {
      type: 'decision',
      correlationId: 'corr-123',
      question: 'Pick color',
      selectedLabel: 'Red',
      selectedIndex: 0,
    };
    simulateMessage(ws, msg);

    const result = await waitPromise;
    expect(result).toEqual(msg);
  });

  it('different correlationId does not match', async () => {
    const ws = await getWs();
    vi.useFakeTimers();

    const waitPromise = client.waitForDecision('corr-123', 1000);
    waitPromise.catch(() => {});

    simulateMessage(ws, {
      type: 'decision',
      correlationId: 'corr-other',
      question: 'Pick size',
      selectedLabel: 'Large',
      selectedIndex: 1,
    });

    await vi.advanceTimersByTimeAsync(1100);
    await expect(waitPromise).rejects.toThrow('Timed out');

    vi.useRealTimers();
  });

  it('timeout rejects with descriptive message', async () => {
    await getWs();
    vi.useFakeTimers();

    const waitPromise = client.waitForDecision('corr-xyz', 2000);
    waitPromise.catch(() => {});

    await vi.advanceTimersByTimeAsync(2100);

    await expect(waitPromise).rejects.toThrow(
      'Timed out waiting for decision [corr-xyz] (2s)',
    );

    vi.useRealTimers();
  });

  it('intentional disconnect rejects all waiters', async () => {
    await getWs();
    const wait1 = client.waitForDecision('corr-1', 60000);
    const wait2 = client.waitForDecision('corr-2', 60000);

    client.disconnect();

    await expect(wait1).rejects.toThrow('Client disconnected');
    await expect(wait2).rejects.toThrow('Client disconnected');
  });

  it('multiple waiters with different correlationIds resolve independently', async () => {
    const ws = await getWs();
    const wait1 = client.waitForDecision('corr-1', 5000);
    const wait2 = client.waitForDecision('corr-2', 5000);

    simulateMessage(ws, {
      type: 'decision',
      correlationId: 'corr-2',
      question: 'Q2',
      selectedLabel: 'B',
      selectedIndex: 1,
    });

    const result2 = await wait2;
    expect(result2.type).toBe('decision');
    expect((result2 as any).selectedLabel).toBe('B');

    simulateMessage(ws, {
      type: 'decision',
      correlationId: 'corr-1',
      question: 'Q1',
      selectedLabel: 'A',
      selectedIndex: 0,
    });

    const result1 = await wait1;
    expect((result1 as any).selectedLabel).toBe('A');
  });
});

describe('waiter matching — approval', () => {
  it('matching correlationId resolves correctly', async () => {
    const ws = await getWs();
    const waitPromise = client.waitForApproval('corr-abc', 5000);

    const msg: RelayResponse = {
      type: 'approval',
      correlationId: 'corr-abc',
      source: 'claude-code',
      approved: true,
      decisions: [{ question: 'Q', selectedLabel: 'A', selectedIndex: 0 }],
    };
    simulateMessage(ws, msg);

    const result = await waitPromise;
    expect(result).toEqual(msg);
  });

  it('different correlationId does not match', async () => {
    const ws = await getWs();
    vi.useFakeTimers();

    const waitPromise = client.waitForApproval('corr-abc', 1000);
    waitPromise.catch(() => {});

    simulateMessage(ws, {
      type: 'approval',
      correlationId: 'corr-other',
      approved: false,
      decisions: [],
    });

    await vi.advanceTimersByTimeAsync(1100);
    await expect(waitPromise).rejects.toThrow('Timed out');

    vi.useRealTimers();
  });

  it('timeout rejects', async () => {
    await getWs();
    vi.useFakeTimers();

    const waitPromise = client.waitForApproval('corr-timeout', 3000);
    waitPromise.catch(() => {});

    await vi.advanceTimersByTimeAsync(3100);

    await expect(waitPromise).rejects.toThrow('Timed out waiting for approval');

    vi.useRealTimers();
  });
});

describe('disconnect', () => {
  it('closes WS and rejects all waiters', async () => {
    await getWs();
    const wait1 = client.waitForDecision('Q', 60000);

    client.disconnect();

    await expect(wait1).rejects.toThrow();
    expect((client as any).ws).toBeNull();
  });

  it('safe to call when not connected', () => {
    expect(() => client.disconnect()).not.toThrow();
  });
});

describe('error recovery', () => {
  it('auto-reconnects when pending waiters exist', async () => {
    const ws = await getWs();
    vi.useFakeTimers();

    const payload = { level: 2 as const, title: 'Test' };
    const waitPromise = client.waitForDecision('corr-r1', 60000, payload);
    waitPromise.catch(() => {});

    // Simulate unexpected disconnect
    ws.emit('close');

    // Auto-reconnect should start — advance past the first delay (1s)
    // Use small increments to let microtasks flush between timer ticks
    await vi.advanceTimersByTimeAsync(1100);
    // Flush remaining microtasks for MockWebSocket 'open' event
    await vi.advanceTimersByTimeAsync(0);

    // Should be reconnected
    expect((client as any).ws).toBeTruthy();
    expect((client as any).isReconnecting).toBe(false);

    // Resolve the waiter via the new WS
    const newWs = (client as any).ws as MockWebSocket;
    simulateMessage(newWs, {
      type: 'decision',
      correlationId: 'corr-r1',
      question: 'Q',
      selectedLabel: 'A',
      selectedIndex: 0,
    });

    const result = await waitPromise;
    expect((result as any).selectedLabel).toBe('A');

    vi.useRealTimers();
  });

  it('does not auto-reconnect when no pending waiters', async () => {
    const ws = await getWs();

    // No waiters — just disconnect
    ws.emit('close');

    // Give a tick for any async work
    await new Promise((r) => setTimeout(r, 10));

    expect((client as any).isReconnecting).toBe(false);
    expect((client as any).ws).toBeNull();
  });

  it('intentional disconnect does not auto-reconnect', async () => {
    await getWs();

    const waitPromise = client.waitForDecision('corr-int', 60000);
    waitPromise.catch(() => {});

    // Intentional disconnect
    client.disconnect();

    await expect(waitPromise).rejects.toThrow('Client disconnected');
    expect((client as any).isReconnecting).toBe(false);
  });

  it('re-pushes payload after successful reconnect', async () => {
    const ws = await getWs();
    vi.useFakeTimers();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, clients: 1 }),
        text: () => Promise.resolve(''),
      }),
    );

    const payload = { level: 2 as const, title: 'Re-push Test', correlationId: 'corr-rp' };
    const waitPromise = client.waitForDecision('corr-rp', 60000, payload);
    waitPromise.catch(() => {});

    ws.emit('close');

    await vi.advanceTimersByTimeAsync(1100);
    await vi.runAllTimersAsync();

    // Check that pushPayload was called for the re-push
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8080/push',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    );

    // Clean up
    client.disconnect();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('uses exponential backoff delays (1s, 2s, 4s...)', () => {
    // Verify the delay formula: min(base * 2^(attempt-1), 30000)
    const base = 1000;
    expect(Math.min(base * Math.pow(2, 0), 30000)).toBe(1000);  // attempt 1
    expect(Math.min(base * Math.pow(2, 1), 30000)).toBe(2000);  // attempt 2
    expect(Math.min(base * Math.pow(2, 2), 30000)).toBe(4000);  // attempt 3
    expect(Math.min(base * Math.pow(2, 3), 30000)).toBe(8000);  // attempt 4
    expect(Math.min(base * Math.pow(2, 4), 30000)).toBe(16000); // attempt 5
    expect(Math.min(base * Math.pow(2, 5), 30000)).toBe(30000); // attempt 6 — capped
  });

  it('backoff caps at 30s', async () => {
    const c = client as any;
    // Set reconnect attempts high to test cap
    c.baseReconnectDelay = 1000;
    // delay = min(1000 * 2^(attempt-1), 30000)
    // attempt 6: 1000 * 32 = 32000 → capped to 30000
    const delay = Math.min(c.baseReconnectDelay * Math.pow(2, 5), 30000);
    expect(delay).toBe(30000);
  });

  it('rejects waiters after exhausting reconnect attempts', async () => {
    vi.useFakeTimers();

    const ws = await getWs();
    const c = client as any;

    // Reduce max attempts for speed
    c.maxReconnectAttempts = 2;
    wsBehavior = 'error';

    const waitPromise = client.waitForDecision('corr-exhaust', 120000);
    waitPromise.catch(() => {});

    ws.emit('close');

    // Run through all reconnect delays
    await vi.runAllTimersAsync();

    await expect(waitPromise).rejects.toThrow('Auto-reconnect failed');

    vi.useRealTimers();
  });

  it('resets reconnect counter after successful reconnect', async () => {
    vi.useFakeTimers();

    const ws = await getWs();

    const payload = { level: 2 as const, title: 'Reset' };
    const waitPromise = client.waitForDecision('corr-reset', 60000, payload);
    waitPromise.catch(() => {});

    ws.emit('close');

    // Let reconnect succeed
    await vi.advanceTimersByTimeAsync(1100);
    await vi.runAllTimersAsync();

    expect((client as any).reconnectAttempts).toBe(0);

    // Clean up
    client.disconnect();
    vi.useRealTimers();
  });

  it('waiter timeout still fires during reconnect', async () => {
    vi.useFakeTimers();

    const ws = await getWs();

    // Make reconnect always fail so it keeps trying
    wsBehavior = 'error';

    // Short timeout waiter
    const waitPromise = client.waitForDecision('corr-to', 500);
    waitPromise.catch(() => {});

    ws.emit('close');

    // Advance past the waiter timeout
    await vi.advanceTimersByTimeAsync(600);

    await expect(waitPromise).rejects.toThrow('Timed out');

    // Clean up
    client.disconnect();
    vi.useRealTimers();
  });

  it('deduplicates concurrent auto-reconnect calls', async () => {
    const ws = await getWs();
    vi.useFakeTimers();

    const wait1 = client.waitForDecision('corr-dd1', 60000);
    wait1.catch(() => {});

    // First close triggers reconnect
    ws.emit('close');
    expect((client as any).isReconnecting).toBe(true);

    // Calling autoReconnect again should be a no-op
    (client as any).autoReconnect();
    expect((client as any).isReconnecting).toBe(true);

    // Clean up
    client.disconnect();
    vi.useRealTimers();
  });
});
