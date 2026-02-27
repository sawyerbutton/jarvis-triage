import type { TriagePayload } from '../types';

/** Server → Client messages */
export type ServerMessage =
  | { type: 'payload'; data: TriagePayload }
  | { type: 'ping' };

/** Single decision result (used in both L2/L3 response and L4 approval) */
export interface DecisionResult {
  question: string;
  selectedIndex: number;
  selectedLabel: string;
}

/** Client → Server messages */
export type ClientMessage =
  | {
      type: 'decision';
      source?: string;
      correlationId?: string;
      question: string;
      selectedIndex: number;
      selectedLabel: string;
    }
  | {
      type: 'approval';
      source?: string;
      correlationId?: string;
      approved: boolean;
      decisions: DecisionResult[];
    }
  | { type: 'pong' };
