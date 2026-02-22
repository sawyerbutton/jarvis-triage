import { state } from '../state';
import { render } from '../renderer';
import { appendEventLog } from '../events';
import type { UserAction } from '../types';

/** Level 3 — Info Decision: same interaction as Level 2 but with more context */
export async function handleLevel3(
  action: UserAction,
  selectedIndex?: number,
): Promise<void> {
  if (action.type === 'click' && selectedIndex !== undefined) {
    const decision = state.payload?.decisions?.[0];
    if (decision) {
      const chosen = decision.options[selectedIndex];
      appendEventLog(`L3: selected "${chosen.label}" (index=${selectedIndex})`);
      if (state.payload) {
        state.payload = {
          ...state.payload,
          level: 1,
          hudLines: [`✅ ${decision.question}: ${chosen.label}`],
        };
        await render();
      }
    }
  } else {
    appendEventLog(`L3: action=${action.type}`);
  }
}
