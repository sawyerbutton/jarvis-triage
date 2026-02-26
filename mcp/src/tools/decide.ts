import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { relay } from '../relay-client.js';
import { config } from '../config.js';
import type { DecisionMessage, TriagePayload } from '../types.js';

const DEFAULT_TIMEOUT_S = 120;

export function registerDecide(server: McpServer): void {
  server.tool(
    'jarvis_decide',
    'Push a decision to the Even G2 HUD and wait for the user to select an option via ring/touch. Use Level 2 (quick) or Level 3 (with context).',
    {
      title: z.string().describe('Decision title shown on HUD'),
      question: z.string().describe('The question to ask'),
      options: z
        .array(
          z.object({
            label: z.string().describe('Option label'),
            description: z.string().optional().describe('Optional description'),
          }),
        )
        .min(2)
        .max(3)
        .describe('2-3 options for the user to choose from'),
      context: z.string().optional().describe('If provided, shows as summary text (upgrades to Level 3)'),
      source: z.string().optional().describe('Source identifier (default: claude-code)'),
      timeout_seconds: z.number().optional().describe(`Seconds to wait for response (default: ${DEFAULT_TIMEOUT_S})`),
    },
    async ({ title, question, options, context, source, timeout_seconds }) => {
      const src = source ?? config.defaultSource;
      const timeoutMs = (timeout_seconds ?? DEFAULT_TIMEOUT_S) * 1000;

      const payload: TriagePayload = {
        level: context ? 3 : 2,
        title,
        source: src,
        decisions: [{ question, options }],
        ...(context ? { summary: context } : {}),
      };

      try {
        await relay.ensureConnected();
        const waitPromise = relay.waitForDecision(question, timeoutMs);
        await relay.pushPayload(payload);
        const response = (await waitPromise) as DecisionMessage;

        return {
          content: [
            {
              type: 'text' as const,
              text: `User selected: "${response.selectedLabel}" (option ${response.selectedIndex + 1})`,
            },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Decision failed: ${msg}` }],
          isError: true,
        };
      }
    },
  );
}
