import { initBridge, onEvent } from './bridge';
import { toUserAction, getListSelection, appendEventLog } from './events';
import { state, loadPayload, syncDevPanel } from './state';
import { dispatch } from './levels';
import { loadInitialDemo, nextScenario } from './demo';
import { render } from './renderer';
import { connectRemote, onConnectionStatusChange } from './remote/client';

function setStatus(text: string) {
  console.log(`[status] ${text}`);
  const el = document.getElementById('status');
  if (el) el.textContent = text;
}

function updateWsStatusUI(s: string) {
  const el = document.getElementById('ws-status');
  if (el) el.textContent = s;
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

  // Track WS connection status in dev panel
  onConnectionStatusChange((s) => updateWsStatusUI(s));

  // Try WebSocket connection from URL query param
  const wsUrl = new URLSearchParams(location.search).get('ws');
  if (wsUrl) {
    state.mode = 'remote';
    connectRemote(wsUrl);
    appendEventLog(`boot: remote mode → ${wsUrl}`);
  } else {
    state.mode = 'demo';
    await loadInitialDemo();
  }

  // Wire up manual-send button for dev testing
  setupDevSendButton();

  // Subscribe to ring / HUD events
  onEvent((event) => {
    const action = toUserAction(event);
    if (!action) return;

    const selectedIndex = getListSelection(event);
    appendEventLog(`event: ${action.type} sel=${selectedIndex}`);

    // Double-click → next demo scenario (only in demo mode),
    // except when inside L4 flow
    if (action.type === 'double_click' && state.mode === 'demo') {
      const insideL4Flow =
        state.payload?.level === 4 &&
        state.l4?.page !== 'overview' &&
        state.l4?.page !== 'done';
      if (!insideL4Flow) {
        void nextScenario();
        return;
      }
    }

    // Dispatch to current level handler
    void dispatch(action, selectedIndex).then(syncDevPanel);
  });

  syncDevPanel();
  setStatus(bridge ? 'Jarvis Triage ready' : 'Jarvis Triage (mock mode)');
  appendEventLog('boot: complete');
}

/** Dev panel: manual payload send button */
function setupDevSendButton(): void {
  const btn = document.getElementById('ws-send');
  const input = document.getElementById('ws-input') as HTMLTextAreaElement | null;
  if (!btn || !input) return;

  btn.addEventListener('click', () => {
    try {
      const payload = JSON.parse(input.value);
      loadPayload(payload);
      syncDevPanel();
      void render();
      appendEventLog('[dev] manual payload sent');
    } catch (e) {
      appendEventLog(`[dev] invalid JSON: ${e}`);
    }
  });

  // Simulate ring input buttons (for browser testing without simulator/glasses)
  setupSimButtons();
}

/** Wire up simulated ring input buttons */
function setupSimButtons(): void {
  // Track which list item is highlighted (for L2/L3 option selection)
  let simIndex = 0;

  const click = document.getElementById('sim-click');
  const up = document.getElementById('sim-up');
  const down = document.getElementById('sim-down');

  const optionCount = () => state.payload?.decisions?.[0]?.options?.length ?? 2;

  up?.addEventListener('click', () => {
    simIndex = Math.max(0, simIndex - 1);
    appendEventLog(`[sim] scroll up → index=${simIndex}`);
    void dispatch({ type: 'scroll_up' }, simIndex).then(syncDevPanel);
  });

  down?.addEventListener('click', () => {
    simIndex = Math.min(optionCount() - 1, simIndex + 1);
    appendEventLog(`[sim] scroll down → index=${simIndex}`);
    void dispatch({ type: 'scroll_down' }, simIndex).then(syncDevPanel);
  });

  click?.addEventListener('click', () => {
    appendEventLog(`[sim] click → index=${simIndex}`);
    void dispatch({ type: 'click' }, simIndex).then(() => {
      simIndex = 0; // reset after selection
      syncDevPanel();
    });
  });
}

void boot().catch((err) => {
  console.error('[boot] failed', err);
  setStatus('Boot failed');
});
