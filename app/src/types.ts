/** Triage level: 0=silent, 1=notify, 2=quick decision, 3=info decision, 4=plan approval */
export type TriageLevel = 0 | 1 | 2 | 3 | 4;

/** A single decision option */
export interface DecisionOption {
  label: string;
  description?: string;
}

/** A decision point extracted from content */
export interface Decision {
  question: string;
  options: DecisionOption[];
}

/** The payload that drives the entire triage display */
export interface TriagePayload {
  level: TriageLevel;
  title: string;
  summary?: string;
  hudLines?: string[];
  decisions?: Decision[];
  risks?: string[];
}

/** User action types from ring/touch events */
export type UserAction =
  | { type: 'click' }
  | { type: 'double_click' }
  | { type: 'scroll_up' }
  | { type: 'scroll_down' }
  | { type: 'foreground_enter' }
  | { type: 'foreground_exit' };

/** Level 4 page identifiers */
export type L4Page = 'overview' | 'decision' | 'confirmation' | 'done';

/** Level 4 state machine state */
export interface L4State {
  page: L4Page;
  /** Index of current decision (0-based) */
  decisionIndex: number;
  /** User's choices so far (parallel to payload.decisions) */
  choices: (number | null)[];
  /** Total number of decisions */
  totalDecisions: number;
}
