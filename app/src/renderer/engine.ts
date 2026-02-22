import { createStartUp, rebuild } from '../bridge';
import { state } from '../state';
import {
  level1Layout,
  level2Layout,
  level3Layout,
  level4OverviewLayout,
  level4DecisionLayout,
  level4ConfirmationLayout,
  level4DoneLayout,
} from './layouts';
import type { TriagePayload, L4State } from '../types';

/** Get the page config for the current state */
function getPageConfig(payload: TriagePayload, l4: L4State | null) {
  switch (payload.level) {
    case 0:
      return null; // silent — nothing to render
    case 1:
      return level1Layout(payload);
    case 2:
      return level2Layout(payload);
    case 3:
      return level3Layout(payload);
    case 4: {
      if (!l4) return level4OverviewLayout(payload);
      switch (l4.page) {
        case 'overview': return level4OverviewLayout(payload);
        case 'decision': return level4DecisionLayout(payload, l4);
        case 'confirmation': return level4ConfirmationLayout(payload, l4);
        case 'done': return level4DoneLayout();
      }
    }
  }
}

/**
 * Render the current state to the HUD.
 *
 * First call uses createStartUpPageContainer; subsequent calls use rebuildPageContainer.
 */
export async function render(): Promise<void> {
  const { payload, l4 } = state;
  if (!payload) return;

  const config = getPageConfig(payload, l4);
  if (!config) return; // Level 0 — no display

  if (!state.startupRendered) {
    await createStartUp(config);
    state.startupRendered = true;
  } else {
    await rebuild(config);
  }
}
