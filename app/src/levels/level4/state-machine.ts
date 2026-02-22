import type { L4State, UserAction } from '../../types';

/**
 * Pure-function state machine for Level 4 Plan Approval.
 *
 * ```
 * Overview ──click──→ Decision[0] ──select──→ Decision[1] ──select──→ ... ──select──→ Confirmation ──approve──→ Done
 *     ↑                                                                                   │
 *     └───────────────────── double_click (reset) ────────────────────────────────────────┘
 * ```
 */
export function transition(
  current: L4State,
  action: UserAction,
  /** For list-click events: which item index was selected */
  selectedIndex?: number,
): L4State {
  switch (current.page) {
    // ── Overview ──────────────────────────────────────────────
    case 'overview': {
      if (action.type === 'click' && selectedIndex !== undefined) {
        if (selectedIndex === 0) {
          // "开始审批" → go to first decision
          return { ...current, page: 'decision', decisionIndex: 0 };
        }
        // "查看详情" → stay (or could expand summary in future)
      }
      return current;
    }

    // ── Decision[i] ──────────────────────────────────────────
    case 'decision': {
      if (action.type === 'click' && selectedIndex !== undefined) {
        const newChoices = [...current.choices];
        newChoices[current.decisionIndex] = selectedIndex;

        const nextIndex = current.decisionIndex + 1;
        if (nextIndex >= current.totalDecisions) {
          // All decisions made → confirmation
          return { ...current, choices: newChoices, page: 'confirmation', decisionIndex: nextIndex };
        }
        // Next decision
        return { ...current, choices: newChoices, page: 'decision', decisionIndex: nextIndex };
      }
      if (action.type === 'double_click') {
        // Reset to overview
        return {
          ...current,
          page: 'overview',
          decisionIndex: 0,
          choices: current.choices.map(() => null),
        };
      }
      return current;
    }

    // ── Confirmation ─────────────────────────────────────────
    case 'confirmation': {
      if (action.type === 'click' && selectedIndex !== undefined) {
        switch (selectedIndex) {
          case 0: // "确认执行"
            return { ...current, page: 'done' };
          case 1: // "暂缓"
            return { ...current, page: 'overview', decisionIndex: 0 };
          case 2: // "重新选择"
            return {
              ...current,
              page: 'decision',
              decisionIndex: 0,
              choices: current.choices.map(() => null),
            };
        }
      }
      if (action.type === 'double_click') {
        return {
          ...current,
          page: 'overview',
          decisionIndex: 0,
          choices: current.choices.map(() => null),
        };
      }
      return current;
    }

    // ── Done ─────────────────────────────────────────────────
    case 'done': {
      // Double-click returns to overview (for demo cycling)
      if (action.type === 'double_click') {
        return {
          ...current,
          page: 'overview',
          decisionIndex: 0,
          choices: current.choices.map(() => null),
        };
      }
      return current;
    }
  }
}
