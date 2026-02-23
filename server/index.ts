import { WebSocketServer, WebSocket } from 'ws';
import { createServer, type IncomingMessage, type ServerResponse } from 'http';

const PORT = parseInt(process.env.PORT || '8080');

const clients = new Set<WebSocket>();

function broadcast(data: string): void {
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // CORS headers for dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ clients: clients.size }));
    return;
  }

  if (req.method === 'POST' && req.url === '/push') {
    try {
      const body = await readBody(req);
      const payload = JSON.parse(body);
      const msg = JSON.stringify({ type: 'payload', data: payload });
      broadcast(msg);
      console.log(`[push] broadcast to ${clients.size} client(s): L${payload.level} "${payload.title}"`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, clients: clients.size }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[ws] client connected (total: ${clients.size})`);

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[ws] client disconnected (total: ${clients.size})`);
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'decision') {
        console.log(`[decision] source=${msg.source ?? '-'} "${msg.question}" → "${msg.selectedLabel}" (index=${msg.selectedIndex})`);
      } else if (msg.type === 'approval') {
        const status = msg.approved ? 'APPROVED' : 'REJECTED';
        const choices = (msg.decisions ?? []).map((d: { question: string; selectedLabel: string }) => `${d.question}: ${d.selectedLabel}`).join(', ');
        console.log(`[approval] source=${msg.source ?? '-'} ${status} [${choices}]`);
      } else if (msg.type === 'pong') {
        // heartbeat response, ignore
      } else {
        console.log(`[ws] unknown message type: ${msg.type}`);
      }
    } catch {
      console.log(`[ws] non-JSON message: ${data}`);
    }
  });
});

// Heartbeat every 30 seconds
setInterval(() => {
  const ping = JSON.stringify({ type: 'ping' });
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(ping);
    }
  }
}, 30000);

httpServer.listen(PORT, () => {
  console.log(`Relay server listening on :${PORT}`);
  console.log(`  WS:   ws://localhost:${PORT}`);
  console.log(`  Push: POST http://localhost:${PORT}/push`);
  console.log(`  Info: GET  http://localhost:${PORT}/status`);
});
