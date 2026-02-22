import { state } from '../../state';
import { render } from '../../renderer';
import { transition } from './state-machine';
import { appendEventLog } from '../../events';
import type { UserAction } from '../../types';

/**
 * Level 4 coordinator: takes a user action and advances the L4 state machine,
 * then re-renders.
 */
export async function handleLevel4Action(
  action: UserAction,
  selectedIndex?: number,
): Promise<void> {
  if (!state.l4) return;

  const prev = state.l4.page;
  state.l4 = transition(state.l4, action, selectedIndex);

  appendEventLog(`L4: ${prev} → ${state.l4.page} (action=${action.type}, sel=${selectedIndex})`);
  await render();
}
