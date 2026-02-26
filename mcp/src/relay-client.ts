import WebSocket from 'ws';
import { config } from './config.js';
import type { RelayResponse, TriagePayload } from './types.js';

interface Waiter {
  match: (msg: RelayResponse) => boolean;
  resolve: (msg: RelayResponse) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

function log(msg: string): void {
  process.stderr.write(`[jarvis-mcp] ${msg}\n`);
}

export class RelayClient {
  private ws: WebSocket | null = null;
  private waiters: Waiter[] = [];
  private connectPromise: Promise<void> | null = null;

  // --- HTTP methods ---

  async pushPayload(payload: TriagePayload): Promise<{ ok: boolean; clients: number }> {
    const res = await fetch(`${config.relayHttpUrl}/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Relay push failed (${res.status}): ${text}`);
    }
    return res.json() as Promise<{ ok: boolean; clients: number }>;
  }

  async getStatus(): Promise<{ clients: number }> {
    const res = await fetch(`${config.relayHttpUrl}/status`);
    if (!res.ok) throw new Error(`Relay status failed (${res.status})`);
    return res.json() as Promise<{ clients: number }>;
  }

  // --- WebSocket methods (lazy init) ---

  async ensureConnected(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = this.connect();
    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  private connect(retries = 5, delayMs = 3000): Promise<void> {
    return new Promise((resolve, reject) => {
      let attempt = 0;

      const tryConnect = () => {
        attempt++;
        log(`connecting to ${config.relayWsUrl} (attempt ${attempt}/${retries})`);
        const ws = new WebSocket(config.relayWsUrl);

        ws.on('open', () => {
          log('connected');
          this.ws = ws;
          this.setupListeners(ws);
          resolve();
        });

        ws.on('error', (err) => {
          if (attempt < retries) {
            log(`connection error, retrying in ${delayMs}ms...`);
            setTimeout(tryConnect, delayMs);
          } else {
            reject(new Error(`Failed to connect after ${retries} attempts: ${err.message}`));
          }
        });
      };

      tryConnect();
    });
  }

  private setupListeners(ws: WebSocket): void {
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // Respond to heartbeat
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        // Match against pending waiters
        if (msg.type === 'decision' || msg.type === 'approval') {
          const idx = this.waiters.findIndex((w) => w.match(msg));
          if (idx !== -1) {
            const waiter = this.waiters[idx];
            this.waiters.splice(idx, 1);
            clearTimeout(waiter.timer);
            waiter.resolve(msg);
          }
        }
      } catch {
        log(`non-JSON message received`);
      }
    });

    ws.on('close', () => {
      log('disconnected');
      this.ws = null;
      // Reject all pending waiters
      for (const w of this.waiters) {
        clearTimeout(w.timer);
        w.reject(new Error('WebSocket disconnected'));
      }
      this.waiters = [];
    });

    ws.on('error', (err) => {
      log(`ws error: ${err.message}`);
    });
  }

  waitForDecision(question: string, timeoutMs: number): Promise<RelayResponse> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex((w) => w.timer === timer);
        if (idx !== -1) this.waiters.splice(idx, 1);
        reject(new Error(`Timed out waiting for decision on "${question}" (${timeoutMs / 1000}s)`));
      }, timeoutMs);

      this.waiters.push({
        match: (msg) => msg.type === 'decision' && (msg as any).question === question,
        resolve,
        reject,
        timer,
      });
    });
  }

  waitForApproval(source: string, timeoutMs: number): Promise<RelayResponse> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex((w) => w.timer === timer);
        if (idx !== -1) this.waiters.splice(idx, 1);
        reject(new Error(`Timed out waiting for approval from source "${source}" (${timeoutMs / 1000}s)`));
      }, timeoutMs);

      this.waiters.push({
        match: (msg) => msg.type === 'approval' && (msg.source ?? '') === source,
        resolve,
        reject,
        timer,
      });
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    for (const w of this.waiters) {
      clearTimeout(w.timer);
      w.reject(new Error('Client disconnected'));
    }
    this.waiters = [];
  }
}

/** Singleton relay client */
export const relay = new RelayClient();
