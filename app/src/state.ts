import type { TriagePayload, L4State } from './types';

export interface AppState {
  /** Current triage payload being displayed */
  payload: TriagePayload | null;
  /** Whether the startup page has been created */
  startupRendered: boolean;
  /** Level 4 sub-state (only used when payload.level === 4) */
  l4: L4State | null;
  /** Index of the current demo scenario */
  demoIndex: number;
  /** Data source mode */
  mode: 'demo' | 'remote';
}

export const state: AppState = {
  payload: null,
  startupRendered: false,
  l4: null,
  demoIndex: 0,
  mode: 'demo',
};

/** Reset state for a new payload */
export function loadPayload(payload: TriagePayload): void {
  state.payload = payload;
  state.l4 = null;
  if (payload.level === 4 && payload.decisions) {
    state.l4 = {
      page: 'overview',
      decisionIndex: 0,
      choices: payload.decisions.map(() => null),
      totalDecisions: payload.decisions.length,
    };
  }
}

/** Update dev panel in browser */
export function syncDevPanel(): void {
  const el = document.getElementById('state-display');
  if (!el) return;
  const p = state.payload;
  if (!p) { el.textContent = '—'; return; }
  const lines = [
    `Mode: ${state.mode}  Level: ${p.level}  Title: ${p.title}`,
    `Demo: ${state.demoIndex}`,
  ];
  if (state.l4) {
    lines.push(`L4 page: ${state.l4.page}  decision: ${state.l4.decisionIndex}/${state.l4.totalDecisions}`);
    lines.push(`Choices: [${state.l4.choices.map(c => c ?? '?').join(', ')}]`);
  }
  el.textContent = lines.join('\n');
}
