import { state } from '../state';
import { handleLevel0 } from './level0';
import { handleLevel1 } from './level1';
import { handleLevel2 } from './level2';
import { handleLevel3 } from './level3';
import { handleLevel4Action } from './level4';
import { appendEventLog } from '../events';
import type { UserAction } from '../types';

/**
 * Dispatch a user action to the appropriate level handler
 * based on the current payload's triage level.
 */
export async function dispatch(
  action: UserAction,
  selectedIndex?: number,
): Promise<void> {
  const level = state.payload?.level;
  if (level === undefined || level === null) {
    appendEventLog('dispatch: no payload loaded');
    return;
  }

  switch (level) {
    case 0: return handleLevel0(action);
    case 1: return handleLevel1(action);
    case 2: return handleLevel2(action, selectedIndex);
    case 3: return handleLevel3(action, selectedIndex);
    case 4: return handleLevel4Action(action, selectedIndex);
  }
}
