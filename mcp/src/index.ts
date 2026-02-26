import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { relay } from './relay-client.js';
import { registerStatus } from './tools/status.js';
import { registerNotify } from './tools/notify.js';
import { registerDecide } from './tools/decide.js';
import { registerApprove } from './tools/approve.js';

const server = new McpServer({
  name: 'jarvis-triage',
  version: '0.1.0',
});

registerStatus(server);
registerNotify(server);
registerDecide(server);
registerApprove(server);

const transport = new StdioServerTransport();
await server.connect(transport);

process.stderr.write('[jarvis-mcp] server started on stdio\n');

function shutdown() {
  process.stderr.write('[jarvis-mcp] shutting down\n');
  relay.disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
