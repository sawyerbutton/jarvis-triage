import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock renderer (DOM-dependent)
vi.mock('../renderer', () => ({
  render: vi.fn().mockResolvedValue(undefined),
}));

// Mock appendEventLog (DOM-dependent)
vi.mock('../events', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../events')>();
  return {
    ...actual,
    appendEventLog: vi.fn(),
  };
});

import { state } from '../state';
import { handleLevel2 } from '../levels/level2';
import { handleLevel3 } from '../levels/level3';
import { render } from '../renderer';
import { appendEventLog } from '../events';

const mockRender = render as ReturnType<typeof vi.fn>;
const mockLog = appendEventLog as ReturnType<typeof vi.fn>;

function resetState() {
  state.payload = {
    level: 2,
    title: 'Test',
    decisions: [{
      question: 'Pick one?',
      options: [{ label: 'Alpha' }, { label: 'Beta' }, { label: 'Gamma' }],
    }],
  };
  state.l4 = null;
  state.startupRendered = false;
  state.demoIndex = 0;
}

describe('handleLevel2()', () => {
  beforeEach(() => {
    resetState();
    mockRender.mockClear();
    mockLog.mockClear();
  });

  it('click + selectedIndex=0 → downgrades to level 1 with result', async () => {
    await handleLevel2({ type: 'click' }, 0);
    expect(state.payload!.level).toBe(1);
    expect(state.payload!.hudLines![0]).toContain('Alpha');
    expect(mockRender).toHaveBeenCalledOnce();
  });

  it('click + selectedIndex=undefined → no state change', async () => {
    const before = { ...state.payload! };
    await handleLevel2({ type: 'click' }, undefined);
    expect(state.payload!.level).toBe(before.level);
    expect(mockRender).not.toHaveBeenCalled();
  });

  it('scroll_up → logs but does not change state', async () => {
    const before = { ...state.payload! };
    await handleLevel2({ type: 'scroll_up' });
    expect(state.payload!.level).toBe(before.level);
    expect(mockLog).toHaveBeenCalled();
    expect(mockRender).not.toHaveBeenCalled();
  });
});

describe('handleLevel3()', () => {
  beforeEach(() => {
    resetState();
    state.payload!.level = 3;
    mockRender.mockClear();
    mockLog.mockClear();
  });

  it('click + selectedIndex=2 → downgrades to level 1 with result', async () => {
    await handleLevel3({ type: 'click' }, 2);
    expect(state.payload!.level).toBe(1);
    expect(state.payload!.hudLines![0]).toContain('Gamma');
    expect(mockRender).toHaveBeenCalledOnce();
  });

  it('non-click action → logs but does not change state', async () => {
    await handleLevel3({ type: 'double_click' });
    expect(state.payload!.level).toBe(3);
    expect(mockLog).toHaveBeenCalled();
    expect(mockRender).not.toHaveBeenCalled();
  });
});
