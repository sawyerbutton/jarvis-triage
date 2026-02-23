import { describe, it, expect, beforeEach } from 'vitest';
import { state, loadPayload } from '../state';
import type { TriagePayload } from '../types';

describe('loadPayload()', () => {
  beforeEach(() => {
    // Reset state before each test
    state.payload = null;
    state.l4 = null;
    state.startupRendered = false;
    state.demoIndex = 0;
  });

  it('Level 1 payload: l4 remains null', () => {
    const p: TriagePayload = { level: 1, title: 'Notify' };
    loadPayload(p);
    expect(state.payload).toBe(p);
    expect(state.l4).toBeNull();
  });

  it('Level 4 payload with 2 decisions: initialises l4 state', () => {
    const p: TriagePayload = {
      level: 4,
      title: 'Plan',
      decisions: [
        { question: 'A?', options: [{ label: 'Yes' }, { label: 'No' }] },
        { question: 'B?', options: [{ label: 'X' }, { label: 'Y' }] },
      ],
    };
    loadPayload(p);
    expect(state.l4).not.toBeNull();
    expect(state.l4!.page).toBe('overview');
    expect(state.l4!.choices).toEqual([null, null]);
    expect(state.l4!.totalDecisions).toBe(2);
  });

  it('Level 4 payload without decisions: l4 remains null', () => {
    const p: TriagePayload = { level: 4, title: 'Plan (no decisions)' };
    loadPayload(p);
    expect(state.l4).toBeNull();
  });

  it('reloading payload clears old l4 state', () => {
    // First load a Level 4 payload
    loadPayload({
      level: 4,
      title: 'Plan',
      decisions: [{ question: 'Q?', options: [{ label: 'A' }] }],
    });
    expect(state.l4).not.toBeNull();

    // Then load a Level 1 payload → l4 should be cleared
    loadPayload({ level: 1, title: 'Notify' });
    expect(state.l4).toBeNull();
  });
});
