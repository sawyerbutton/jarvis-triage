import type { UserAction } from '../types';
import { appendEventLog } from '../events';

/** Level 0 — Silent: no display, no-op for actions */
export async function handleLevel0(_action: UserAction): Promise<void> {
  appendEventLog('L0: silent, no-op');
}
