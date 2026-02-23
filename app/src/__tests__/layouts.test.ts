import { describe, it, expect, vi } from 'vitest';

vi.mock('@evenrealities/even_hub_sdk', () => ({
  TextContainerProperty: class {
    config: any;
    constructor(config: any) { Object.assign(this, config); }
  },
  ListContainerProperty: class {
    config: any;
    constructor(config: any) { Object.assign(this, config); }
  },
  ListItemContainerProperty: class {
    config: any;
    constructor(config: any) { Object.assign(this, config); }
  },
}));

import {
  level1Layout,
  level2Layout,
  level3Layout,
  level4OverviewLayout,
  level4DecisionLayout,
  level4ConfirmationLayout,
  level4DoneLayout,
} from '../renderer/layouts';
import type { TriagePayload, L4State } from '../types';

// Helper: count containers with isEventCapture=1
function countEventCaptures(layout: any): number {
  let count = 0;
  for (const t of layout.textObject ?? []) {
    if (t.isEventCapture === 1) count++;
  }
  for (const l of layout.listObject ?? []) {
    if (l.isEventCapture === 1) count++;
  }
  return count;
}

// ── Level 1 ─────────────────────────────────────────────────

describe('level1Layout', () => {
  const payload: TriagePayload = {
    level: 1,
    title: 'Test Notification',
    hudLines: ['Line 1'],
  };

  it('containerTotalNum = 1', () => {
    expect(level1Layout(payload).containerTotalNum).toBe(1);
  });

  it('has 1 textObject and no listObject', () => {
    const l = level1Layout(payload);
    expect(l.textObject).toHaveLength(1);
    expect(l.listObject).toBeUndefined();
  });

  it('exactly 1 container with isEventCapture=1', () => {
    expect(countEventCaptures(level1Layout(payload))).toBe(1);
  });
});

// ── Level 2 ─────────────────────────────────────────────────

describe('level2Layout', () => {
  const payload: TriagePayload = {
    level: 2,
    title: 'Quick Decision',
    hudLines: ['Choose one'],
    decisions: [{
      question: 'Pick?',
      options: [{ label: 'Yes' }, { label: 'No' }, { label: 'Maybe' }],
    }],
  };

  it('containerTotalNum = 2', () => {
    expect(level2Layout(payload).containerTotalNum).toBe(2);
  });

  it('has 1 text + 1 list', () => {
    const l = level2Layout(payload);
    expect(l.textObject).toHaveLength(1);
    expect(l.listObject).toHaveLength(1);
  });

  it('list itemCount matches options length', () => {
    const l = level2Layout(payload);
    expect((l.listObject![0] as any).itemContainer.itemCount).toBe(3);
  });

  it('defaults to ["A","B"] when no decisions', () => {
    const l = level2Layout({ level: 2, title: 'X' });
    expect((l.listObject![0] as any).itemContainer.itemName).toEqual(['A', 'B']);
  });

  it('exactly 1 container with isEventCapture=1', () => {
    expect(countEventCaptures(level2Layout(payload))).toBe(1);
  });
});

// ── Level 3 ─────────────────────────────────────────────────

describe('level3Layout', () => {
  const payload: TriagePayload = {
    level: 3,
    title: 'Info Decision',
    hudLines: ['Context info here'],
    decisions: [{
      question: 'Choose?',
      options: [{ label: 'A' }, { label: 'B' }],
    }],
  };

  it('containerTotalNum = 2', () => {
    expect(level3Layout(payload).containerTotalNum).toBe(2);
  });

  it('text height = 108 (taller than L2)', () => {
    const l = level3Layout(payload);
    expect((l.textObject![0] as any).height).toBe(108);
  });

  it('exactly 1 container with isEventCapture=1', () => {
    expect(countEventCaptures(level3Layout(payload))).toBe(1);
  });
});

// ── Level 4: Overview ───────────────────────────────────────

describe('level4OverviewLayout', () => {
  const payload: TriagePayload = {
    level: 4,
    title: 'Deploy Plan',
    summary: 'Deploy v2.0',
    risks: ['Downtime risk'],
    decisions: [
      { question: 'Env?', options: [{ label: 'Prod' }, { label: 'Staging' }] },
    ],
  };

  it('containerTotalNum = 3 (2 text + 1 list)', () => {
    const l = level4OverviewLayout(payload);
    expect(l.containerTotalNum).toBe(3);
    expect(l.textObject).toHaveLength(2);
    expect(l.listObject).toHaveLength(1);
  });

  it('list has items ["开始审批","查看详情"]', () => {
    const l = level4OverviewLayout(payload);
    expect((l.listObject![0] as any).itemContainer.itemName).toEqual(['开始审批', '查看详情']);
  });

  it('exactly 1 container with isEventCapture=1', () => {
    expect(countEventCaptures(level4OverviewLayout(payload))).toBe(1);
  });
});

// ── Level 4: Decision ───────────────────────────────────────

describe('level4DecisionLayout', () => {
  const payload: TriagePayload = {
    level: 4,
    title: 'Plan',
    decisions: [
      { question: 'Env?', options: [{ label: 'Prod' }, { label: 'Staging' }] },
      { question: 'Notify?', options: [{ label: 'Yes' }, { label: 'No' }] },
    ],
  };

  it('list items = decision options', () => {
    const l4: L4State = { page: 'decision', decisionIndex: 0, choices: [null, null], totalDecisions: 2 };
    const l = level4DecisionLayout(payload, l4);
    expect((l.listObject![0] as any).itemContainer.itemName).toEqual(['Prod', 'Staging']);
  });

  it('progress text includes index', () => {
    const l4: L4State = { page: 'decision', decisionIndex: 1, choices: [0, null], totalDecisions: 2 };
    const l = level4DecisionLayout(payload, l4);
    expect((l.textObject![0] as any).content).toContain('2/2');
  });

  it('shows previous selection when decisionIndex > 0', () => {
    const l4: L4State = { page: 'decision', decisionIndex: 1, choices: [0, null], totalDecisions: 2 };
    const l = level4DecisionLayout(payload, l4);
    expect((l.textObject![1] as any).content).toContain('Prod');
  });

  it('exactly 1 container with isEventCapture=1', () => {
    const l4: L4State = { page: 'decision', decisionIndex: 0, choices: [null, null], totalDecisions: 2 };
    expect(countEventCaptures(level4DecisionLayout(payload, l4))).toBe(1);
  });
});

// ── Level 4: Confirmation ───────────────────────────────────

describe('level4ConfirmationLayout', () => {
  const payload: TriagePayload = {
    level: 4,
    title: 'Plan',
    risks: ['Outage risk'],
    decisions: [
      { question: 'Env?', options: [{ label: 'Prod' }, { label: 'Staging' }] },
      { question: 'Notify?', options: [{ label: 'Yes' }, { label: 'No' }] },
    ],
  };
  const l4: L4State = { page: 'confirmation', decisionIndex: 2, choices: [0, 1], totalDecisions: 2 };

  it('summary text includes choice labels', () => {
    const l = level4ConfirmationLayout(payload, l4);
    const text = (l.textObject![0] as any).content;
    expect(text).toContain('Prod');
    expect(text).toContain('No');
  });

  it('risk text present', () => {
    const l = level4ConfirmationLayout(payload, l4);
    expect((l.textObject![1] as any).content).toContain('Outage risk');
  });

  it('3 confirmation options', () => {
    const l = level4ConfirmationLayout(payload, l4);
    expect((l.listObject![0] as any).itemContainer.itemName).toEqual(['确认执行', '暂缓', '重新选择']);
  });

  it('exactly 1 container with isEventCapture=1', () => {
    expect(countEventCaptures(level4ConfirmationLayout(payload, l4))).toBe(1);
  });
});

// ── Level 4: Done ───────────────────────────────────────────

describe('level4DoneLayout', () => {
  it('containerTotalNum = 1', () => {
    expect(level4DoneLayout().containerTotalNum).toBe(1);
  });

  it('content includes "Plan approved"', () => {
    const l = level4DoneLayout();
    expect((l.textObject![0] as any).content).toContain('Plan approved');
  });

  it('exactly 1 container with isEventCapture=1', () => {
    expect(countEventCaptures(level4DoneLayout())).toBe(1);
  });
});
