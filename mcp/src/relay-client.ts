import WebSocket from 'ws';
import { config } from './config.js';
import type { RelayResponse, TriagePayload } from './types.js';

interface Waiter {
  match: (msg: RelayResponse) => boolean;
  resolve: (msg: RelayResponse) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  payload?: TriagePayload;
}

function log(msg: string): void {
  process.stderr.write(`[jarvis-mcp] ${msg}\n`);
}

export class RelayClient {
  private ws: WebSocket | null = null;
  private waiters: Waiter[] = [];
  private connectPromise: Promise<void> | null = null;

  // Error recovery state
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000;
  private isReconnecting = false;
  private intentionalDisconnect = false;

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
      this.intentionalDisconnect = false;
      this.reconnectAttempts = 0;
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

      if (this.intentionalDisconnect) {
        // User called disconnect() — reject all waiters immediately
        this.rejectAllWaiters('Client disconnected');
        return;
      }

      if (this.waiters.length > 0) {
        // Unexpected disconnect with pending waiters — try to reconnect
        log(`${this.waiters.length} pending waiter(s), attempting auto-reconnect`);
        this.autoReconnect();
      }
      // No pending waiters — just clean up, don't reconnect
    });

    ws.on('error', (err) => {
      log(`ws error: ${err.message}`);
    });
  }

  private async autoReconnect(): Promise<void> {
    if (this.isReconnecting) return;
    this.isReconnecting = true;

    try {
      while (this.reconnectAttempts < this.maxReconnectAttempts && this.waiters.length > 0) {
        this.reconnectAttempts++;
        const delay = Math.min(
          this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
          30000,
        );
        log(`auto-reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

        await new Promise((r) => setTimeout(r, delay));

        // Check if waiters were cleared during the delay (e.g. all timed out)
        if (this.waiters.length === 0) {
          log('no more pending waiters, stopping auto-reconnect');
          break;
        }

        try {
          await this.connect(1, 0);
          // Success — reset counter
          this.reconnectAttempts = 0;
          log('auto-reconnect succeeded, re-pushing payloads');

          // Re-push all waiter payloads (fire-and-forget)
          for (const w of this.waiters) {
            if (w.payload) {
              this.pushPayload(w.payload).catch((err) => {
                log(`re-push failed: ${err.message}`);
              });
            }
          }
          return;
        } catch {
          log('auto-reconnect attempt failed');
        }
      }

      // Exhausted retries — reject remaining waiters
      if (this.waiters.length > 0) {
        log('auto-reconnect exhausted, rejecting waiters');
        this.rejectAllWaiters('Auto-reconnect failed after max attempts');
      }
    } finally {
      this.isReconnecting = false;
    }
  }

  private rejectAllWaiters(message: string): void {
    for (const w of this.waiters) {
      clearTimeout(w.timer);
      w.reject(new Error(message));
    }
    this.waiters = [];
  }

  waitForDecision(correlationId: string, timeoutMs: number, payload?: TriagePayload): Promise<RelayResponse> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex((w) => w.timer === timer);
        if (idx !== -1) this.waiters.splice(idx, 1);
        reject(new Error(`Timed out waiting for decision [${correlationId}] (${timeoutMs / 1000}s)`));
      }, timeoutMs);

      this.waiters.push({
        match: (msg) => msg.type === 'decision' && msg.correlationId === correlationId,
        resolve,
        reject,
        timer,
        payload,
      });
    });
  }

  waitForApproval(correlationId: string, timeoutMs: number, payload?: TriagePayload): Promise<RelayResponse> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex((w) => w.timer === timer);
        if (idx !== -1) this.waiters.splice(idx, 1);
        reject(new Error(`Timed out waiting for approval [${correlationId}] (${timeoutMs / 1000}s)`));
      }, timeoutMs);

      this.waiters.push({
        match: (msg) => msg.type === 'approval' && msg.correlationId === correlationId,
        resolve,
        reject,
        timer,
        payload,
      });
    });
  }

  disconnect(): void {
    this.intentionalDisconnect = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.rejectAllWaiters('Client disconnected');
  }
}

/** Singleton relay client */
export const relay = new RelayClient();
