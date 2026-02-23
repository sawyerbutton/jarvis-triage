import {
  TextContainerProperty,
  ListContainerProperty,
  ListItemContainerProperty,
} from '@evenrealities/even_hub_sdk';
import { DISPLAY_WIDTH, DISPLAY_HEIGHT } from './constants';
import type { TriagePayload, L4State } from '../types';

type PageConfig = {
  containerTotalNum: number;
  textObject?: TextContainerProperty[];
  listObject?: ListContainerProperty[];
};

// ---------------------------------------------------------------------------
// Level 1 — Notification (1 TextContainer)
// ---------------------------------------------------------------------------

export function level1Layout(payload: TriagePayload): PageConfig {
  const content = payload.hudLines?.[0] ?? payload.title;
  return {
    containerTotalNum: 1,
    textObject: [
      new TextContainerProperty({
        containerID: 1,
        containerName: 'notify',
        content,
        xPosition: 8,
        yPosition: 100,
        width: 560,
        height: 88,
        isEventCapture: 1,
        paddingLength: 0,
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// Level 2 — Quick Decision (Text + List)
// ---------------------------------------------------------------------------

export function level2Layout(payload: TriagePayload): PageConfig {
  const question = payload.hudLines?.join('\n') ?? payload.title;
  const options = payload.decisions?.[0]?.options.map(o => o.label) ?? ['A', 'B'];

  return {
    containerTotalNum: 2,
    textObject: [
      new TextContainerProperty({
        containerID: 1,
        containerName: 'question',
        content: question,
        xPosition: 8,
        yPosition: 4,
        width: 560,
        height: 64,
        isEventCapture: 0,
        paddingLength: 0,
      }),
    ],
    listObject: [
      new ListContainerProperty({
        containerID: 2,
        containerName: 'options',
        xPosition: 4,
        yPosition: 72,
        width: 568,
        height: 212,
        isEventCapture: 1,
        itemContainer: new ListItemContainerProperty({
          itemCount: options.length,
          itemWidth: 568,
          isItemSelectBorderEn: 1,
          itemName: options,
        }),
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// Level 3 — Info Decision (Text + List, more text height)
// ---------------------------------------------------------------------------

export function level3Layout(payload: TriagePayload): PageConfig {
  const context = payload.hudLines?.join('\n') ?? `${payload.title}\n${payload.summary ?? ''}`;
  const options = payload.decisions?.[0]?.options.map(o => o.label) ?? ['A', 'B', 'C'];

  return {
    containerTotalNum: 2,
    textObject: [
      new TextContainerProperty({
        containerID: 1,
        containerName: 'context',
        content: context,
        xPosition: 8,
        yPosition: 4,
        width: 560,
        height: 108,
        isEventCapture: 0,
        paddingLength: 0,
      }),
    ],
    listObject: [
      new ListContainerProperty({
        containerID: 2,
        containerName: 'options',
        xPosition: 4,
        yPosition: 116,
        width: 568,
        height: 168,
        isEventCapture: 1,
        itemContainer: new ListItemContainerProperty({
          itemCount: options.length,
          itemWidth: 568,
          isItemSelectBorderEn: 1,
          itemName: options,
        }),
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// Level 4 — Plan Approval (3 pages, each with 2 Text + 1 List)
// ---------------------------------------------------------------------------

export function level4OverviewLayout(payload: TriagePayload): PageConfig {
  const title = `[Plan] ${payload.title}`;
  const summaryLines: string[] = [];
  if (payload.summary) summaryLines.push(payload.summary);
  if (payload.risks?.length) summaryLines.push(`[!] ${payload.risks.join('; ')}`);
  const summaryText = summaryLines.join('\n') || '查看详情';

  return {
    containerTotalNum: 3,
    textObject: [
      new TextContainerProperty({
        containerID: 1,
        containerName: 'title',
        content: title,
        xPosition: 8,
        yPosition: 4,
        width: 560,
        height: 48,
        isEventCapture: 0,
        paddingLength: 0,
      }),
      new TextContainerProperty({
        containerID: 2,
        containerName: 'summary',
        content: summaryText,
        xPosition: 8,
        yPosition: 56,
        width: 560,
        height: 100,
        isEventCapture: 0,
        paddingLength: 0,
      }),
    ],
    listObject: [
      new ListContainerProperty({
        containerID: 3,
        containerName: 'nav',
        xPosition: 4,
        yPosition: 160,
        width: 568,
        height: 124,
        isEventCapture: 1,
        itemContainer: new ListItemContainerProperty({
          itemCount: 2,
          itemWidth: 568,
          isItemSelectBorderEn: 1,
          itemName: ['开始审批', '查看详情'],
        }),
      }),
    ],
  };
}

export function level4DecisionLayout(payload: TriagePayload, l4: L4State): PageConfig {
  const decision = payload.decisions![l4.decisionIndex];
  const progress = `[?] 决策 ${l4.decisionIndex + 1}/${l4.totalDecisions}`;
  const prevText = l4.decisionIndex > 0 && l4.choices[l4.decisionIndex - 1] !== null
    ? `[OK] 上一步: ${payload.decisions![l4.decisionIndex - 1].options[l4.choices[l4.decisionIndex - 1]!].label}`
    : '';

  const options = decision.options.map(o => o.label);

  return {
    containerTotalNum: 3,
    textObject: [
      new TextContainerProperty({
        containerID: 1,
        containerName: 'progress',
        content: `${progress}\n${decision.question}`,
        xPosition: 8,
        yPosition: 4,
        width: 560,
        height: 72,
        isEventCapture: 0,
        paddingLength: 0,
      }),
      new TextContainerProperty({
        containerID: 2,
        containerName: 'prev',
        content: prevText,
        xPosition: 8,
        yPosition: 80,
        width: 560,
        height: 36,
        isEventCapture: 0,
        paddingLength: 0,
      }),
    ],
    listObject: [
      new ListContainerProperty({
        containerID: 3,
        containerName: 'choices',
        xPosition: 4,
        yPosition: 120,
        width: 568,
        height: 164,
        isEventCapture: 1,
        itemContainer: new ListItemContainerProperty({
          itemCount: options.length,
          itemWidth: 568,
          isItemSelectBorderEn: 1,
          itemName: options,
        }),
      }),
    ],
  };
}

export function level4ConfirmationLayout(payload: TriagePayload, l4: L4State): PageConfig {
  const choiceLines = payload.decisions!.map((d, i) => {
    const idx = l4.choices[i];
    const chosen = idx !== null ? d.options[idx].label : '?';
    return `[OK] ${d.question}: ${chosen}`;
  });
  const summaryText = choiceLines.join('\n');
  const riskText = payload.risks?.length ? `[!] ${payload.risks.join('; ')}` : '';

  return {
    containerTotalNum: 3,
    textObject: [
      new TextContainerProperty({
        containerID: 1,
        containerName: 'choices',
        content: summaryText,
        xPosition: 8,
        yPosition: 4,
        width: 560,
        height: 108,
        isEventCapture: 0,
        paddingLength: 0,
      }),
      new TextContainerProperty({
        containerID: 2,
        containerName: 'risk',
        content: riskText,
        xPosition: 8,
        yPosition: 116,
        width: 560,
        height: 40,
        isEventCapture: 0,
        paddingLength: 0,
      }),
    ],
    listObject: [
      new ListContainerProperty({
        containerID: 3,
        containerName: 'confirm',
        xPosition: 4,
        yPosition: 160,
        width: 568,
        height: 124,
        isEventCapture: 1,
        itemContainer: new ListItemContainerProperty({
          itemCount: 3,
          itemWidth: 568,
          isItemSelectBorderEn: 1,
          itemName: ['确认执行', '暂缓', '重新选择'],
        }),
      }),
    ],
  };
}

export function level4DoneLayout(): PageConfig {
  return {
    containerTotalNum: 1,
    textObject: [
      new TextContainerProperty({
        containerID: 1,
        containerName: 'done',
        content: '[OK] Plan approved\n双击返回',
        xPosition: 8,
        yPosition: 100,
        width: 560,
        height: 88,
        isEventCapture: 1,
        paddingLength: 0,
      }),
    ],
  };
}
