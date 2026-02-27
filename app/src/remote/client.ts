import { loadPayload, syncDevPanel, state } from '../state';
import { render } from '../renderer';
import { appendEventLog } from '../events';
import type { ServerMessage, ClientMessage, DecisionResult } from './protocol';

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 5;
const RECONNECT_DELAY = 3000;

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
let status: ConnectionStatus = 'disconnected';
let onStatusChange: ((s: ConnectionStatus) => void) | null = null;

export function getConnectionStatus(): ConnectionStatus {
  return status;
}

export function onConnectionStatusChange(cb: (s: ConnectionStatus) => void) {
  onStatusChange = cb;
}

function setStatus(s: ConnectionStatus) {
  status = s;
  onStatusChange?.(s);
}

export function connectRemote(url: string): void {
  setStatus('connecting');
  ws = new WebSocket(url);

  ws.onopen = () => {
    setStatus('connected');
    reconnectAttempts = 0;
    appendEventLog('[ws] connected');
  };

  ws.onmessage = (ev) => {
    try {
      const msg: ServerMessage = JSON.parse(ev.data as string);
      handleServerMessage(msg);
    } catch (e) {
      appendEventLog(`[ws] bad message: ${e}`);
    }
  };

  ws.onclose = () => {
    setStatus('disconnected');
    appendEventLog('[ws] disconnected');
    maybeReconnect(url);
  };

  ws.onerror = () => {
    appendEventLog('[ws] error');
    // onclose will fire after this
  };
}

function handleServerMessage(msg: ServerMessage): void {
  switch (msg.type) {
    case 'payload':
      appendEventLog(`[ws] payload received: L${msg.data.level} "${msg.data.title}"`);
      loadPayload(msg.data);
      syncDevPanel();
      void render();
      break;
    case 'ping':
      sendMessage({ type: 'pong' });
      break;
  }
}

function maybeReconnect(url: string): void {
  if (reconnectAttempts < MAX_RECONNECT) {
    reconnectAttempts++;
    appendEventLog(`[ws] reconnect ${reconnectAttempts}/${MAX_RECONNECT} in ${RECONNECT_DELAY}ms`);
    setTimeout(() => connectRemote(url), RECONNECT_DELAY);
  }
}

/** Send a single decision result (L2/L3) */
export function sendDecision(question: string, selectedIndex: number, selectedLabel: string): void {
  sendMessage({
    type: 'decision',
    source: state.payload?.source,
    correlationId: state.payload?.correlationId,
    question,
    selectedIndex,
    selectedLabel,
  });
}

/** Send a full approval result (L4) */
export function sendApproval(approved: boolean, decisions: DecisionResult[]): void {
  sendMessage({
    type: 'approval',
    source: state.payload?.source,
    correlationId: state.payload?.correlationId,
    approved,
    decisions,
  });
}

function sendMessage(msg: ClientMessage): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function disconnect(): void {
  reconnectAttempts = MAX_RECONNECT; // prevent reconnect
  ws?.close();
}
