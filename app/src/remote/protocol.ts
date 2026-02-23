import type { TriagePayload } from '../types';

/** Server → Client messages */
export type ServerMessage =
  | { type: 'payload'; data: TriagePayload }
  | { type: 'ping' };

/** Client → Server messages */
export type ClientMessage =
  | { type: 'decision'; level: number; selectedIndex: number; context?: string }
  | { type: 'pong' };
