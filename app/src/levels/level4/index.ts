import { state } from '../../state';
import { render } from '../../renderer';
import { transition } from './state-machine';
import { appendEventLog } from '../../events';
import { sendDecision } from '../../remote/client';
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

  // When L4 reaches 'done', send all choices back via WebSocket
  if (state.mode === 'remote' && state.l4.page === 'done' && prev !== 'done') {
    const context = state.l4.choices.map((c, i) => {
      const q = state.payload?.decisions?.[i]?.question ?? `Q${i}`;
      const label = c !== null ? (state.payload?.decisions?.[i]?.options[c]?.label ?? String(c)) : '?';
      return `${q}: ${label}`;
    }).join('; ');
    sendDecision(4, -1, context);
  }

  await render();
}
