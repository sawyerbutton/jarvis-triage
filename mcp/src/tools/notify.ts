import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { relay } from '../relay-client.js';
import { config } from '../config.js';
import type { TriagePayload } from '../types.js';

export function registerNotify(server: McpServer): void {
  server.tool(
    'jarvis_notify',
    'Send a notification to the Even G2 HUD (Level 1 — view only, no interaction needed)',
    {
      title: z.string().describe('Notification title'),
      message: z.string().describe('One-line message to display on HUD'),
      source: z.string().optional().describe('Source identifier (default: claude-code)'),
    },
    async ({ title, message, source }) => {
      const payload: TriagePayload = {
        level: 1,
        title,
        source: source ?? config.defaultSource,
        hudLines: [message],
      };

      try {
        const { clients } = await relay.pushPayload(payload);
        if (clients === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'Notification sent but 0 clients connected — no one will see it.',
              },
            ],
          };
        }
        return {
          content: [
            { type: 'text' as const, text: `Notification sent to ${clients} client(s).` },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Failed to send notification: ${msg}` }],
          isError: true,
        };
      }
    },
  );
}
