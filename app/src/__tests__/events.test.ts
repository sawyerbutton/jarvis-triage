import { describe, it, expect, vi } from 'vitest';

vi.mock('@evenrealities/even_hub_sdk', () => ({
  OsEventTypeList: {
    CLICK_EVENT: 0,
    SCROLL_TOP_EVENT: 1,
    SCROLL_BOTTOM_EVENT: 2,
    DOUBLE_CLICK_EVENT: 3,
    FOREGROUND_ENTER_EVENT: 4,
    FOREGROUND_EXIT_EVENT: 5,
  },
}));

import { resolveEventType, toUserAction, getListSelection } from '../events';

// The mock maps numeric values; resolveEventType returns OsEventTypeList enum values.
// With our mock: CLICK_EVENT=0, DOUBLE_CLICK_EVENT=3, etc.

describe('resolveEventType()', () => {
  it('listEvent.eventType=0 → CLICK_EVENT (0)', () => {
    expect(resolveEventType({ listEvent: { eventType: 0 } } as any)).toBe(0);
  });

  it('listEvent.eventType=3 → DOUBLE_CLICK_EVENT (3)', () => {
    expect(resolveEventType({ listEvent: { eventType: 3 } } as any)).toBe(3);
  });

  it('textEvent.eventType=0 → CLICK_EVENT (0)', () => {
    expect(resolveEventType({ textEvent: { eventType: 0 } } as any)).toBe(0);
  });

  it('sysEvent.eventType=4 → FOREGROUND_ENTER_EVENT (4)', () => {
    expect(resolveEventType({ sysEvent: { eventType: 4 } } as any)).toBe(4);
  });

  it('jsonData.eventType numeric → maps correctly', () => {
    expect(resolveEventType({ jsonData: { eventType: 2 } } as any)).toBe(2); // SCROLL_BOTTOM
  });

  it('jsonData.event_type string "CLICK" → CLICK_EVENT', () => {
    expect(resolveEventType({ jsonData: { event_type: 'CLICK' } } as any)).toBe(0);
  });

  it('jsonData.Event_Type string "DOUBLE_CLICK" → DOUBLE_CLICK_EVENT', () => {
    expect(resolveEventType({ jsonData: { Event_Type: 'DOUBLE_CLICK' } } as any)).toBe(3);
  });

  it('empty event → undefined', () => {
    expect(resolveEventType({} as any)).toBeUndefined();
  });

  it('fallback: listEvent present but no eventType → CLICK_EVENT', () => {
    expect(resolveEventType({ listEvent: {} } as any)).toBe(0);
  });
});

describe('toUserAction()', () => {
  it('listEvent click → { type: "click" }', () => {
    expect(toUserAction({ listEvent: { eventType: 0 } } as any)).toEqual({ type: 'click' });
  });

  it('double click → { type: "double_click" }', () => {
    expect(toUserAction({ listEvent: { eventType: 3 } } as any)).toEqual({ type: 'double_click' });
  });

  it('scroll top → { type: "scroll_up" }', () => {
    expect(toUserAction({ listEvent: { eventType: 1 } } as any)).toEqual({ type: 'scroll_up' });
  });

  it('scroll bottom → { type: "scroll_down" }', () => {
    expect(toUserAction({ listEvent: { eventType: 2 } } as any)).toEqual({ type: 'scroll_down' });
  });

  it('foreground enter → { type: "foreground_enter" }', () => {
    expect(toUserAction({ sysEvent: { eventType: 4 } } as any)).toEqual({ type: 'foreground_enter' });
  });

  it('foreground exit → { type: "foreground_exit" }', () => {
    expect(toUserAction({ sysEvent: { eventType: 5 } } as any)).toEqual({ type: 'foreground_exit' });
  });

  it('unknown event → null', () => {
    expect(toUserAction({} as any)).toBeNull();
  });
});

describe('getListSelection()', () => {
  it('listEvent with index=2 → returns 2', () => {
    expect(getListSelection({ listEvent: { currentSelectItemIndex: 2 } } as any)).toBe(2);
  });

  it('listEvent with index=undefined → defaults to 0 (SDK 0→undefined bug guard)', () => {
    expect(getListSelection({ listEvent: {} } as any)).toBe(0);
  });

  it('no listEvent → returns undefined', () => {
    expect(getListSelection({} as any)).toBeUndefined();
  });

  it('jsonData.currentSelectItemIndex=1 → returns 1', () => {
    expect(getListSelection({ jsonData: { currentSelectItemIndex: 1 } } as any)).toBe(1);
  });
});
