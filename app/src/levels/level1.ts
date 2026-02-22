import type { UserAction } from '../types';
import { appendEventLog } from '../events';

/** Level 1 — Notify: display only, actions are no-op (double_click handled at top level for demo) */
export async function handleLevel1(action: UserAction): Promise<void> {
  appendEventLog(`L1: action=${action.type} (no-op)`);
}
