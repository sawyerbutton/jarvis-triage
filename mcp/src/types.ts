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
  source?: string;
  summary?: string;
  hudLines?: string[];
  decisions?: Decision[];
  risks?: string[];
  /** Unique ID to correlate responses with requests (multi-user safe) */
  correlationId?: string;
}

/** WebSocket message: user selected an option (L2/L3) */
export interface DecisionMessage {
  type: 'decision';
  source?: string;
  correlationId?: string;
  question: string;
  selectedLabel: string;
  selectedIndex: number;
}

/** WebSocket message: user approved/rejected a plan (L4) */
export interface ApprovalMessage {
  type: 'approval';
  source?: string;
  correlationId?: string;
  approved: boolean;
  decisions: { question: string; selectedLabel: string; selectedIndex: number }[];
}

/** Union of relay response message types */
export type RelayResponse = DecisionMessage | ApprovalMessage;
