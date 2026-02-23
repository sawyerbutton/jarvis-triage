import { describe, it, expect } from 'vitest';
import { transition } from '../levels/level4/state-machine';
import type { L4State, UserAction } from '../types';

function mkState(overrides: Partial<L4State> = {}): L4State {
  return {
    page: 'overview',
    decisionIndex: 0,
    choices: [null, null],
    totalDecisions: 2,
    ...overrides,
  };
}

describe('L4 state machine — transition()', () => {
  // ── Overview ──────────────────────────────────────────────

  it('Overview → Decision[0] on click + selectedIndex=0', () => {
    const next = transition(mkState(), { type: 'click' }, 0);
    expect(next.page).toBe('decision');
    expect(next.decisionIndex).toBe(0);
  });

  it('Overview stays on click + selectedIndex=1 ("查看详情")', () => {
    const state = mkState();
    const next = transition(state, { type: 'click' }, 1);
    expect(next).toBe(state); // same reference = no change
  });

  it('Overview ignores scroll_up', () => {
    const state = mkState();
    expect(transition(state, { type: 'scroll_up' })).toBe(state);
  });

  it('Overview ignores scroll_down', () => {
    const state = mkState();
    expect(transition(state, { type: 'scroll_down' })).toBe(state);
  });

  // ── Decision ──────────────────────────────────────────────

  it('Decision select → next Decision when more decisions remain', () => {
    const state = mkState({ page: 'decision', decisionIndex: 0 });
    const next = transition(state, { type: 'click' }, 1);
    expect(next.page).toBe('decision');
    expect(next.decisionIndex).toBe(1);
    expect(next.choices[0]).toBe(1);
  });

  it('Last Decision select → Confirmation', () => {
    const state = mkState({ page: 'decision', decisionIndex: 1, choices: [0, null] });
    const next = transition(state, { type: 'click' }, 0);
    expect(next.page).toBe('confirmation');
    expect(next.choices).toEqual([0, 0]);
  });

  it('Decision double_click → reset to Overview', () => {
    const state = mkState({ page: 'decision', decisionIndex: 1, choices: [0, null] });
    const next = transition(state, { type: 'double_click' });
    expect(next.page).toBe('overview');
    expect(next.decisionIndex).toBe(0);
    expect(next.choices).toEqual([null, null]);
  });

  // ── Confirmation ──────────────────────────────────────────

  it('Confirmation "确认执行" (index=0) → Done', () => {
    const state = mkState({ page: 'confirmation', choices: [0, 1] });
    const next = transition(state, { type: 'click' }, 0);
    expect(next.page).toBe('done');
  });

  it('Confirmation "暂缓" (index=1) → Overview', () => {
    const state = mkState({ page: 'confirmation', choices: [0, 1] });
    const next = transition(state, { type: 'click' }, 1);
    expect(next.page).toBe('overview');
    expect(next.decisionIndex).toBe(0);
  });

  it('Confirmation "重新选择" (index=2) → Decision[0] with cleared choices', () => {
    const state = mkState({ page: 'confirmation', choices: [0, 1] });
    const next = transition(state, { type: 'click' }, 2);
    expect(next.page).toBe('decision');
    expect(next.decisionIndex).toBe(0);
    expect(next.choices).toEqual([null, null]);
  });

  it('Confirmation double_click → reset to Overview', () => {
    const state = mkState({ page: 'confirmation', choices: [0, 1] });
    const next = transition(state, { type: 'double_click' });
    expect(next.page).toBe('overview');
    expect(next.choices).toEqual([null, null]);
  });

  // ── Done ──────────────────────────────────────────────────

  it('Done double_click → reset to Overview', () => {
    const state = mkState({ page: 'done', choices: [0, 1] });
    const next = transition(state, { type: 'double_click' });
    expect(next.page).toBe('overview');
    expect(next.decisionIndex).toBe(0);
    expect(next.choices).toEqual([null, null]);
  });

  it('Done click → no change', () => {
    const state = mkState({ page: 'done', choices: [0, 1] });
    const next = transition(state, { type: 'click' }, 0);
    expect(next).toBe(state);
  });

  // ── Regression: selectedIndex=undefined ────────────────────

  it('Overview click + selectedIndex=undefined → no change', () => {
    const state = mkState();
    const next = transition(state, { type: 'click' }, undefined);
    expect(next).toBe(state);
  });

  it('Decision click + selectedIndex=undefined → no change', () => {
    const state = mkState({ page: 'decision', decisionIndex: 0 });
    const next = transition(state, { type: 'click' }, undefined);
    expect(next).toBe(state);
  });

  it('Confirmation click + selectedIndex=undefined → no change', () => {
    const state = mkState({ page: 'confirmation', choices: [0, 1] });
    const next = transition(state, { type: 'click' }, undefined);
    expect(next).toBe(state);
  });
});
