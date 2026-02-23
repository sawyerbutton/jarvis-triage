import { state } from '../../state';
import { render } from '../../renderer';
import { transition } from './state-machine';
import { appendEventLog } from '../../events';
import { sendApproval } from '../../remote/client';
import type { UserAction } from '../../types';
import type { DecisionResult } from '../../remote/protocol';

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

  // When L4 reaches 'done', send structured approval via WebSocket
  if (state.mode === 'remote' && state.l4.page === 'done' && prev !== 'done') {
    const decisions: DecisionResult[] = state.l4.choices.map((c, i) => {
      const d = state.payload?.decisions?.[i];
      return {
        question: d?.question ?? `Q${i}`,
        selectedIndex: c ?? -1,
        selectedLabel: c !== null ? (d?.options[c]?.label ?? String(c)) : '?',
      };
    });
    sendApproval(true, decisions);
  }

  // When L4 confirmation → overview (暂缓), send rejected approval
  if (state.mode === 'remote' && prev === 'confirmation' && state.l4.page === 'overview' && action.type === 'click' && selectedIndex === 1) {
    sendApproval(false, []);
  }

  await render();
}
