import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { relay } from '../relay-client.js';

export function registerStatus(server: McpServer): void {
  server.tool(
    'jarvis_status',
    'Check if the Jarvis Triage relay server is reachable and how many clients are connected',
    {},
    async () => {
      try {
        const { clients } = await relay.getStatus();
        return {
          content: [
            {
              type: 'text' as const,
              text: `Relay server reachable. Connected clients: ${clients}`,
            },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Relay server unreachable: ${msg}` }],
          isError: true,
        };
      }
    },
  );
}
