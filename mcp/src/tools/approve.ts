import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { relay } from '../relay-client.js';
import { config } from '../config.js';
import type { ApprovalMessage, TriagePayload } from '../types.js';

const DEFAULT_TIMEOUT_S = 300;

export function registerApprove(server: McpServer): void {
  server.tool(
    'jarvis_approve',
    'Push a multi-step plan approval flow to the Even G2 HUD (Level 4). The user reviews a summary, makes sequential decisions, then confirms or rejects.',
    {
      title: z.string().describe('Plan title shown on HUD'),
      summary: z.string().optional().describe('Plan summary text'),
      decisions: z
        .array(
          z.object({
            question: z.string().describe('Decision question'),
            options: z
              .array(
                z.object({
                  label: z.string().describe('Option label'),
                  description: z.string().optional().describe('Optional description'),
                }),
              )
              .min(2)
              .max(3),
          }),
        )
        .min(1)
        .describe('One or more sequential decisions for the user'),
      risks: z.array(z.string()).optional().describe('Risk items to display'),
      source: z.string().optional().describe('Source identifier (default: claude-code)'),
      timeout_seconds: z.number().optional().describe(`Seconds to wait for response (default: ${DEFAULT_TIMEOUT_S})`),
    },
    async ({ title, summary, decisions, risks, source, timeout_seconds }) => {
      const src = source ?? config.defaultSource;
      const timeoutMs = (timeout_seconds ?? DEFAULT_TIMEOUT_S) * 1000;
      const correlationId = randomUUID();

      const payload: TriagePayload = {
        level: 4,
        title,
        source: src,
        correlationId,
        decisions,
        ...(summary ? { summary } : {}),
        ...(risks?.length ? { risks } : {}),
      };

      try {
        await relay.ensureConnected();
        const waitPromise = relay.waitForApproval(correlationId, timeoutMs, payload);
        await relay.pushPayload(payload);
        const response = (await waitPromise) as ApprovalMessage;

        if (response.approved) {
          const choices = response.decisions
            .map((d, i) => `${i + 1}. ${d.question}: "${d.selectedLabel}"`)
            .join('\n');
          return {
            content: [
              {
                type: 'text' as const,
                text: `Plan APPROVED.\nDecisions:\n${choices}`,
              },
            ],
          };
        } else {
          return {
            content: [{ type: 'text' as const, text: 'Plan REJECTED by user.' }],
          };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Approval failed: ${msg}` }],
          isError: true,
        };
      }
    },
  );
}
