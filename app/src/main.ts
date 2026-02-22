import { initBridge, onEvent } from './bridge';
import { toUserAction, getListSelection, appendEventLog } from './events';
import { state, syncDevPanel } from './state';
import { dispatch } from './levels';
import { loadInitialDemo, nextScenario } from './demo';

function setStatus(text: string) {
  console.log(`[status] ${text}`);
  const el = document.getElementById('status');
  if (el) el.textContent = text;
}

async function boot(): Promise<void> {
  setStatus('Connecting to Even bridge...');
  appendEventLog('boot: starting');

  const bridge = await initBridge();

  if (bridge) {
    setStatus('Connected to Even Hub');
    appendEventLog('boot: bridge connected');
  } else {
    setStatus('Mock mode (no bridge)');
    appendEventLog('boot: running in mock mode');
  }

  // Load the initial demo scenario
  await loadInitialDemo();

  // Subscribe to ring / HUD events
  onEvent((event) => {
    const action = toUserAction(event);
    if (!action) return;

    const selectedIndex = getListSelection(event);
    appendEventLog(`event: ${action.type} sel=${selectedIndex}`);

    // Double-click at top level → next demo scenario
    if (action.type === 'double_click' && state.payload?.level !== 4) {
      void nextScenario();
      return;
    }

    // Dispatch to current level handler
    void dispatch(action, selectedIndex).then(syncDevPanel);
  });

  syncDevPanel();
  setStatus(bridge ? 'Jarvis Triage ready' : 'Jarvis Triage (mock mode)');
  appendEventLog('boot: complete');
}

void boot().catch((err) => {
  console.error('[boot] failed', err);
  setStatus('Boot failed');
});
