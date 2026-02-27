/**
 * Integration tests — real relay server, real WebSocket, real fetch.
 *
 * Only mock: config (to inject the dynamic port).
 * Everything else (ws, fetch, TCP) is exercised for real.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { AddressInfo } from 'net';
import type { RelayResponse } from '../types.js';

// ── Mini relay server (mirrors server/index.ts core logic) ──────────────

const clients = new Set<WebSocket>();
let httpServer: ReturnType<typeof createServer>;
let wss: WebSocketServer;
let relayPort: number;

function broadcast(data: string): void {
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

function startRelay(): Promise<number> {
  return new Promise((resolve) => {
    httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method === 'GET' && req.url === '/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ clients: clients.size }));
        return;
      }
      if (req.method === 'POST' && req.url === '/push') {
        try {
          const body = await readBody(req);
          const payload = JSON.parse(body);
          broadcast(JSON.stringify({ type: 'payload', data: payload }));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, clients: clients.size }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
        return;
      }
      res.writeHead(404);
      res.end('Not found');
    });

    wss = new WebSocketServer({ server: httpServer });

    wss.on('connection', (ws) => {
      clients.add(ws);
      ws.on('close', () => clients.delete(ws));
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          // Forward decision/approval to other clients
          if (msg.type === 'decision' || msg.type === 'approval') {
            const fwd = JSON.stringify(msg);
            for (const c of clients) {
              if (c !== ws && c.readyState === WebSocket.OPEN) c.send(fwd);
            }
          }
        } catch { /* ignore non-JSON */ }
      });
    });

    httpServer.listen(0, () => {
      relayPort = (httpServer.address() as AddressInfo).port;
      resolve(relayPort);
    });
  });
}

function stopRelay(): Promise<void> {
  return new Promise((resolve) => {
    for (const ws of clients) ws.terminate();
    clients.clear();
    wss.close(() => {
      httpServer.close(() => resolve());
    });
  });
}

// ── Setup ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  await startRelay();
});

// Mock config to point at the dynamic port — the only mock in this file
vi.mock('../config.js', async () => {
  return {
    get config() {
      return {
        relayHttpUrl: `http://localhost:${relayPort}`,
        relayWsUrl: `ws://localhost:${relayPort}`,
        defaultSource: 'integration-test',
      };
    },
  };
});

let RelayClient: typeof import('../relay-client.js').RelayClient;
let client: InstanceType<typeof RelayClient>;

// Track app-side WS connections for cleanup
const appSockets: WebSocket[] = [];

beforeAll(async () => {
  const mod = await import('../relay-client.js');
  RelayClient = mod.RelayClient;
});

// Ensure clean relay state before each test
beforeEach(async () => {
  for (const ws of clients) ws.terminate();
  clients.clear();
  await new Promise((r) => setTimeout(r, 20));
});

afterEach(async () => {
  client?.disconnect();

  const closePromises = appSockets.map(
    (ws) =>
      new Promise<void>((resolve) => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.once('close', () => resolve());
          ws.close();
        } else {
          resolve();
        }
      }),
  );
  await Promise.all(closePromises);
  appSockets.length = 0;
  await new Promise((r) => setTimeout(r, 20));
});

afterAll(async () => {
  await stopRelay();
});

// ── Helpers ─────────────────────────────────────────────────────────────

/** Create a fresh RelayClient (uses real ws + real fetch) */
function createClient(): InstanceType<typeof RelayClient> {
  client = new RelayClient();
  return client;
}

/** Connect a simulated app via real WebSocket to the relay */
function connectApp(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${relayPort}`);
    appSockets.push(ws);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

/** Wait for next JSON message on a WebSocket (must be called BEFORE the message is sent) */
function nextMessage(ws: WebSocket, timeoutMs = 2000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('nextMessage timed out')), timeoutMs);
    ws.once('message', (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString()));
    });
  });
}

/** Collect N messages from a WebSocket (must be called BEFORE messages are sent) */
function collectMessages(ws: WebSocket, count: number, timeoutMs = 2000): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const messages: any[] = [];
    const timer = setTimeout(
      () => reject(new Error(`collectMessages: got ${messages.length}/${count}`)),
      timeoutMs,
    );
    const handler = (data: Buffer) => {
      messages.push(JSON.parse(data.toString()));
      if (messages.length >= count) {
        clearTimeout(timer);
        ws.off('message', handler);
        resolve(messages);
      }
    };
    ws.on('message', handler);
  });
}

/** Wait until relay has N clients registered */
async function waitForClients(n: number, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (clients.size !== n && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 10));
  }
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('HTTP — relay server', () => {
  it('getStatus returns 0 clients initially', async () => {
    const c = createClient();
    const status = await c.getStatus();
    expect(status).toEqual({ clients: 0 });
  }, 5000);

  it('getStatus returns 1 after an app connects', async () => {
    const c = createClient();
    await connectApp();
    await waitForClients(1);
    const status = await c.getStatus();
    expect(status.clients).toBe(1);
  }, 5000);

  it('pushPayload returns { ok: true, clients: N }', async () => {
    createClient();
    await connectApp();
    await waitForClients(1);
    const result = await client.pushPayload({ level: 1, title: 'Integration Test' });
    expect(result.ok).toBe(true);
    expect(result.clients).toBe(1);
  }, 5000);

  it('pushPayload with invalid JSON returns 400', async () => {
    const res = await fetch(`http://localhost:${relayPort}/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not valid json',
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid JSON');
  }, 5000);
});

describe('WebSocket — connection + heartbeat', () => {
  it('ensureConnected establishes a real WS connection', async () => {
    const c = createClient();
    await c.ensureConnected();
    await waitForClients(1);
    const status = await c.getStatus();
    expect(status.clients).toBe(1);
  }, 5000);

  it('relay server ping → client auto-replies pong', async () => {
    const c = createClient();
    await c.ensureConnected();
    await waitForClients(1);

    const serverSockets = [...clients];
    expect(serverSockets).toHaveLength(1);
    const serverSocket = serverSockets[0];

    const pongPromise = new Promise<boolean>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('pong timeout')), 2000);
      serverSocket.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'pong') {
          clearTimeout(timer);
          resolve(true);
        }
      });
    });

    serverSocket.send(JSON.stringify({ type: 'ping' }));

    const gotPong = await pongPromise;
    expect(gotPong).toBe(true);
  }, 5000);
});

describe('end-to-end — decision (L2/L3)', () => {
  it('push L2 payload → app receives → app sends decision → waiter resolves', async () => {
    const c = createClient();
    await c.ensureConnected();
    const app = await connectApp();
    await waitForClients(2);

    const correlationId = `test-decision-${Date.now()}`;
    const payload = {
      level: 2 as const,
      title: 'Pick color',
      decisions: [{ question: 'Color?', options: [{ label: 'Red' }, { label: 'Blue' }] }],
      correlationId,
    };

    // Register listener BEFORE pushing so we don't miss the broadcast
    const appReceived = nextMessage(app);
    const waiter = c.waitForDecision(correlationId, 3000, payload);
    await c.pushPayload(payload);

    const received = await appReceived;
    expect(received.type).toBe('payload');
    expect(received.data.correlationId).toBe(correlationId);

    // App sends decision back
    app.send(JSON.stringify({
      type: 'decision',
      correlationId,
      question: 'Color?',
      selectedLabel: 'Red',
      selectedIndex: 0,
    } satisfies RelayResponse));

    const result = await waiter;
    expect(result.type).toBe('decision');
    expect(result.correlationId).toBe(correlationId);
    expect((result as any).selectedLabel).toBe('Red');
  }, 5000);

  it('2 concurrent decisions with different correlationIds resolve independently', async () => {
    const c = createClient();
    await c.ensureConnected();
    const app = await connectApp();
    await waitForClients(2);

    const id1 = `concurrent-1-${Date.now()}`;
    const id2 = `concurrent-2-${Date.now()}`;

    const waiter1 = c.waitForDecision(id1, 3000);
    const waiter2 = c.waitForDecision(id2, 3000);

    // Collect both payload messages BEFORE pushing
    const appMessages = collectMessages(app, 2);

    await c.pushPayload({ level: 2, title: 'Q1', correlationId: id1 });
    await c.pushPayload({ level: 2, title: 'Q2', correlationId: id2 });

    await appMessages; // both payloads received

    // Reply to id2 first
    app.send(JSON.stringify({
      type: 'decision', correlationId: id2,
      question: 'Q2', selectedLabel: 'B', selectedIndex: 1,
    }));

    const result2 = await waiter2;
    expect((result2 as any).selectedLabel).toBe('B');

    // Then reply to id1
    app.send(JSON.stringify({
      type: 'decision', correlationId: id1,
      question: 'Q1', selectedLabel: 'A', selectedIndex: 0,
    }));

    const result1 = await waiter1;
    expect((result1 as any).selectedLabel).toBe('A');
  }, 5000);

  it('mismatched correlationId does not resolve waiter (times out)', async () => {
    const c = createClient();
    await c.ensureConnected();
    const app = await connectApp();
    await waitForClients(2);

    const waiter = c.waitForDecision('expected-id', 500);
    waiter.catch(() => {}); // prevent unhandled rejection on cleanup

    // App sends decision with wrong correlationId
    app.send(JSON.stringify({
      type: 'decision', correlationId: 'wrong-id',
      question: 'Q', selectedLabel: 'X', selectedIndex: 0,
    }));

    await expect(waiter).rejects.toThrow('Timed out');
  }, 5000);
});

describe('end-to-end — approval (L4)', () => {
  it('push L4 payload → app approves → waiter resolves with approved=true', async () => {
    const c = createClient();
    await c.ensureConnected();
    const app = await connectApp();
    await waitForClients(2);

    const correlationId = `approval-yes-${Date.now()}`;
    const payload = {
      level: 4 as const,
      title: 'Deploy plan',
      correlationId,
      decisions: [{ question: 'Region?', options: [{ label: 'US' }, { label: 'EU' }] }],
    };

    // Register listener BEFORE pushing
    const appReceived = nextMessage(app);
    const waiter = c.waitForApproval(correlationId, 3000, payload);
    await c.pushPayload(payload);

    const received = await appReceived;
    expect(received.data.level).toBe(4);

    // App approves
    app.send(JSON.stringify({
      type: 'approval', correlationId,
      approved: true,
      decisions: [{ question: 'Region?', selectedLabel: 'US', selectedIndex: 0 }],
    }));

    const result = await waiter;
    expect(result.type).toBe('approval');
    expect((result as any).approved).toBe(true);
  }, 5000);

  it('push L4 payload → app rejects → waiter resolves with approved=false', async () => {
    const c = createClient();
    await c.ensureConnected();
    const app = await connectApp();
    await waitForClients(2);

    const correlationId = `approval-no-${Date.now()}`;

    // Register listener BEFORE pushing
    const appReceived = nextMessage(app);
    const waiter = c.waitForApproval(correlationId, 3000);
    await c.pushPayload({ level: 4, title: 'Risky plan', correlationId });

    await appReceived; // drain payload

    app.send(JSON.stringify({
      type: 'approval', correlationId,
      approved: false,
      decisions: [],
    }));

    const result = await waiter;
    expect(result.type).toBe('approval');
    expect((result as any).approved).toBe(false);
  }, 5000);
});

describe('multi-client', () => {
  it('2 app clients → pushPayload reports clients=2', async () => {
    createClient();
    await connectApp();
    await connectApp();
    await waitForClients(2);

    const result = await client.pushPayload({ level: 1, title: 'Broadcast' });
    expect(result.clients).toBe(2);
  }, 5000);

  it('app1 sends decision → correlationId-matched waiter resolves', async () => {
    const c = createClient();
    await c.ensureConnected();
    const app1 = await connectApp();
    const app2 = await connectApp();
    await waitForClients(3);

    const correlationId = `multi-${Date.now()}`;

    // Register listeners BEFORE pushing
    const app1Received = nextMessage(app1);
    const app2Received = nextMessage(app2);
    const waiter = c.waitForDecision(correlationId, 3000);
    await c.pushPayload({ level: 2, title: 'Multi Q', correlationId });

    await app1Received;
    await app2Received;

    // Only app1 responds
    app1.send(JSON.stringify({
      type: 'decision', correlationId,
      question: 'Q', selectedLabel: 'Yes', selectedIndex: 0,
    }));

    const result = await waiter;
    expect((result as any).selectedLabel).toBe('Yes');
  }, 5000);
});

describe('connection lifecycle', () => {
  it('app disconnect → getStatus clients decreases', async () => {
    const c = createClient();
    const app = await connectApp();
    await waitForClients(1);

    const before = await c.getStatus();
    expect(before.clients).toBe(1);

    // Close app and wait for server to process
    await new Promise<void>((resolve) => {
      app.once('close', () => resolve());
      app.close();
    });
    await waitForClients(0);

    const after = await c.getStatus();
    expect(after.clients).toBe(0);
  }, 5000);

  it('disconnect() closes WS but HTTP still works', async () => {
    const c = createClient();
    await c.ensureConnected();
    c.disconnect();

    // HTTP should still work (stateless)
    const status = await c.getStatus();
    expect(status).toHaveProperty('clients');
  }, 5000);
});
