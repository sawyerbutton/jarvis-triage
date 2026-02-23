import { state } from '../state';
import { render } from '../renderer';
import { appendEventLog } from '../events';
import { sendDecision } from '../remote/client';
import type { UserAction } from '../types';

/** Level 2 — Quick Decision: click selects the highlighted option */
export async function handleLevel2(
  action: UserAction,
  selectedIndex?: number,
): Promise<void> {
  if (action.type === 'click' && selectedIndex !== undefined) {
    const decision = state.payload?.decisions?.[0];
    if (decision) {
      const chosen = decision.options[selectedIndex];
      appendEventLog(`L2: selected "${chosen.label}" (index=${selectedIndex})`);

      if (state.mode === 'remote') {
        sendDecision(decision.question, selectedIndex, chosen.label);
      }

      // Show confirmation as notification
      if (state.payload) {
        state.payload = {
          ...state.payload,
          level: 1,
          hudLines: [`[OK] ${decision.question}: ${chosen.label}`],
        };
        await render();
      }
    }
  } else {
    appendEventLog(`L2: action=${action.type} (scroll handled by SDK)`);
  }
}
