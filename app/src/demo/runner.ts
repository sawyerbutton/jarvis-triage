import { state, loadPayload, syncDevPanel } from '../state';
import { render } from '../renderer';
import { appendEventLog } from '../events';
import { scenarios } from './scenarios';

/**
 * Advance to the next demo scenario (wraps around).
 * Triggered by double-click.
 */
export async function nextScenario(): Promise<void> {
  state.demoIndex = (state.demoIndex + 1) % scenarios.length;
  const scenario = scenarios[state.demoIndex];
  loadPayload(scenario);
  appendEventLog(`Demo: → scenario ${state.demoIndex} (Level ${scenario.level}: ${scenario.title})`);
  syncDevPanel();

  // Level 0 is silent — skip directly to next
  if (scenario.level === 0) {
    appendEventLog('Demo: Level 0 is silent, auto-advancing...');
    await render(); // still call render (it's a no-op) for consistency
    // Small delay then advance
    setTimeout(() => { void nextScenario(); }, 800);
    return;
  }

  await render();
}

/** Load the initial demo scenario (Level 1 by default) */
export async function loadInitialDemo(): Promise<void> {
  // Start at the Level 1 scenario (index 1)
  state.demoIndex = 1;
  const scenario = scenarios[state.demoIndex];
  loadPayload(scenario);
  appendEventLog(`Demo: initial → Level ${scenario.level}: ${scenario.title}`);
  syncDevPanel();
  await render();
}
