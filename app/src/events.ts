import { OsEventTypeList, type EvenHubEvent } from '@evenrealities/even_hub_sdk';
import type { UserAction } from './types';

/**
 * Normalise an EvenHubEvent into our UserAction type.
 *
 * Compatible with simulator, real ring, and various SDK event shapes.
 * Pattern adapted from the even-dev reference apps' getRawEventType approach.
 */
export function resolveEventType(event: EvenHubEvent): OsEventTypeList | undefined {
  const raw =
    event.listEvent?.eventType ??
    event.textEvent?.eventType ??
    event.sysEvent?.eventType ??
    ((event.jsonData ?? {}) as Record<string, unknown>).eventType ??
    ((event.jsonData ?? {}) as Record<string, unknown>).event_type ??
    ((event.jsonData ?? {}) as Record<string, unknown>).Event_Type ??
    ((event.jsonData ?? {}) as Record<string, unknown>).type;

  if (typeof raw === 'number') {
    switch (raw) {
      case 0: return OsEventTypeList.CLICK_EVENT;
      case 1: return OsEventTypeList.SCROLL_TOP_EVENT;
      case 2: return OsEventTypeList.SCROLL_BOTTOM_EVENT;
      case 3: return OsEventTypeList.DOUBLE_CLICK_EVENT;
      case 4: return OsEventTypeList.FOREGROUND_ENTER_EVENT;
      case 5: return OsEventTypeList.FOREGROUND_EXIT_EVENT;
      default: return undefined;
    }
  }

  if (typeof raw === 'string') {
    const v = raw.toUpperCase();
    if (v.includes('DOUBLE')) return OsEventTypeList.DOUBLE_CLICK_EVENT;
    if (v.includes('CLICK')) return OsEventTypeList.CLICK_EVENT;
    if (v.includes('SCROLL_TOP') || v.includes('UP')) return OsEventTypeList.SCROLL_TOP_EVENT;
    if (v.includes('SCROLL_BOTTOM') || v.includes('DOWN')) return OsEventTypeList.SCROLL_BOTTOM_EVENT;
    if (v.includes('FOREGROUND_ENTER')) return OsEventTypeList.FOREGROUND_ENTER_EVENT;
    if (v.includes('FOREGROUND_EXIT')) return OsEventTypeList.FOREGROUND_EXIT_EVENT;
  }

  if (event.listEvent || event.textEvent || event.sysEvent) {
    return OsEventTypeList.CLICK_EVENT;
  }

  return undefined;
}

/** Convert SDK event to our UserAction */
export function toUserAction(event: EvenHubEvent): UserAction | null {
  const et = resolveEventType(event);
  switch (et) {
    case OsEventTypeList.CLICK_EVENT: return { type: 'click' };
    case OsEventTypeList.DOUBLE_CLICK_EVENT: return { type: 'double_click' };
    case OsEventTypeList.SCROLL_TOP_EVENT: return { type: 'scroll_up' };
    case OsEventTypeList.SCROLL_BOTTOM_EVENT: return { type: 'scroll_down' };
    case OsEventTypeList.FOREGROUND_ENTER_EVENT: return { type: 'foreground_enter' };
    case OsEventTypeList.FOREGROUND_EXIT_EVENT: return { type: 'foreground_exit' };
    default: return null;
  }
}

/** Get the selected list item index from a list event, if available */
export function getListSelection(event: EvenHubEvent): number | undefined {
  return event.listEvent?.currentSelectItemIndex ?? undefined;
}

/** Append to the browser-side event log */
export function appendEventLog(text: string): void {
  const el = document.getElementById('event-log');
  if (!el) return;
  const time = new Date().toLocaleTimeString();
  el.textContent = `[${time}] ${text}\n` + (el.textContent ?? '');
  const lines = el.textContent.split('\n');
  if (lines.length > 200) {
    el.textContent = lines.slice(0, 200).join('\n');
  }
}
