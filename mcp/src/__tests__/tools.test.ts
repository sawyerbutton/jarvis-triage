import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mockRelay is available when vi.mock factories run (hoisted to top)
const mockRelay = vi.hoisted(() => ({
  getStatus: vi.fn(),
  pushPayload: vi.fn(),
  ensureConnected: vi.fn(),
  waitForDecision: vi.fn(),
  waitForApproval: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock('../relay-client.js', () => ({
  relay: mockRelay,
  RelayClient: vi.fn(),
}));

vi.mock('../config.js', () => ({
  config: {
    relayHttpUrl: 'http://localhost:8080',
    relayWsUrl: 'ws://localhost:8080',
    defaultSource: 'claude-code',
  },
}));

vi.mock('node:crypto', () => ({
  randomUUID: () => 'test-uuid-1234',
}));

// Capture tool handlers registered via McpServer
type ToolHandler = (args: Record<string, any>) => Promise<any>;
const registeredTools = new Map<string, ToolHandler>();

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn().mockImplementation(() => ({
    tool: (name: string, _desc: string, _schema: any, handler: ToolHandler) => {
      registeredTools.set(name, handler);
    },
  })),
}));

// Import tool registration functions
import { registerStatus } from '../tools/status.js';
import { registerNotify } from '../tools/notify.js';
import { registerDecide } from '../tools/decide.js';
import { registerApprove } from '../tools/approve.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

beforeEach(() => {
  vi.clearAllMocks();
  registeredTools.clear();

  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerStatus(server);
  registerNotify(server);
  registerDecide(server);
  registerApprove(server);
});

function callTool(name: string, args: Record<string, any> = {}) {
  const handler = registeredTools.get(name);
  if (!handler) throw new Error(`Tool "${name}" not registered`);
  return handler(args);
}

// --- Tests ---

describe('jarvis_status', () => {
  it('returns client count on success', async () => {
    mockRelay.getStatus.mockResolvedValue({ clients: 5 });
    const result = await callTool('jarvis_status');
    expect(result.content[0].text).toContain('5');
    expect(result.isError).toBeUndefined();
  });

  it('returns isError on fetch failure', async () => {
    mockRelay.getStatus.mockRejectedValue(new Error('Connection refused'));
    const result = await callTool('jarvis_status');
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Connection refused');
  });
});

describe('jarvis_notify', () => {
  it('constructs L1 payload with title, hudLines, default source', async () => {
    mockRelay.pushPayload.mockResolvedValue({ ok: true, clients: 1 });
    const result = await callTool('jarvis_notify', {
      title: 'Build Done',
      message: 'All tests passed',
    });

    expect(mockRelay.pushPayload).toHaveBeenCalledWith({
      level: 1,
      title: 'Build Done',
      source: 'claude-code',
      hudLines: ['All tests passed'],
    });
    expect(result.content[0].text).toContain('1 client');
  });

  it('uses custom source', async () => {
    mockRelay.pushPayload.mockResolvedValue({ ok: true, clients: 1 });
    await callTool('jarvis_notify', {
      title: 'Test',
      message: 'msg',
      source: 'ci',
    });

    expect(mockRelay.pushPayload).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'ci' }),
    );
  });

  it('returns warning when 0 clients', async () => {
    mockRelay.pushPayload.mockResolvedValue({ ok: true, clients: 0 });
    const result = await callTool('jarvis_notify', {
      title: 'Test',
      message: 'msg',
    });
    expect(result.content[0].text).toContain('0 clients');
  });

  it('returns isError on push failure', async () => {
    mockRelay.pushPayload.mockRejectedValue(new Error('Network error'));
    const result = await callTool('jarvis_notify', {
      title: 'Test',
      message: 'msg',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Network error');
  });
});

describe('jarvis_decide', () => {
  const baseArgs = {
    title: 'Pick Color',
    question: 'Which color?',
    options: [{ label: 'Red' }, { label: 'Blue' }],
  };

  it('constructs L2 payload without context, includes correlationId', async () => {
    mockRelay.ensureConnected.mockResolvedValue(undefined);
    mockRelay.waitForDecision.mockResolvedValue({
      type: 'decision',
      correlationId: 'test-uuid-1234',
      question: 'Which color?',
      selectedLabel: 'Red',
      selectedIndex: 0,
    });
    mockRelay.pushPayload.mockResolvedValue({ ok: true, clients: 1 });

    await callTool('jarvis_decide', baseArgs);

    expect(mockRelay.pushPayload).toHaveBeenCalledWith(
      expect.objectContaining({ level: 2, correlationId: 'test-uuid-1234' }),
    );
  });

  it('constructs L3 payload with context', async () => {
    mockRelay.ensureConnected.mockResolvedValue(undefined);
    mockRelay.waitForDecision.mockResolvedValue({
      type: 'decision',
      correlationId: 'test-uuid-1234',
      question: 'Which color?',
      selectedLabel: 'Red',
      selectedIndex: 0,
    });
    mockRelay.pushPayload.mockResolvedValue({ ok: true, clients: 1 });

    await callTool('jarvis_decide', {
      ...baseArgs,
      context: 'Choose your favorite',
    });

    expect(mockRelay.pushPayload).toHaveBeenCalledWith(
      expect.objectContaining({ level: 3, summary: 'Choose your favorite' }),
    );
  });

  it('registers waiter before pushPayload (race condition prevention)', async () => {
    const callOrder: string[] = [];
    mockRelay.ensureConnected.mockResolvedValue(undefined);
    mockRelay.waitForDecision.mockImplementation(() => {
      callOrder.push('waitForDecision');
      return Promise.resolve({
        type: 'decision',
        question: 'Which color?',
        selectedLabel: 'Red',
        selectedIndex: 0,
      });
    });
    mockRelay.pushPayload.mockImplementation(() => {
      callOrder.push('pushPayload');
      return Promise.resolve({ ok: true, clients: 1 });
    });

    await callTool('jarvis_decide', baseArgs);

    expect(callOrder.indexOf('waitForDecision')).toBeLessThan(
      callOrder.indexOf('pushPayload'),
    );
  });

  it('returns selected option on success', async () => {
    mockRelay.ensureConnected.mockResolvedValue(undefined);
    mockRelay.waitForDecision.mockResolvedValue({
      type: 'decision',
      question: 'Which color?',
      selectedLabel: 'Blue',
      selectedIndex: 1,
    });
    mockRelay.pushPayload.mockResolvedValue({ ok: true, clients: 1 });

    const result = await callTool('jarvis_decide', baseArgs);
    expect(result.content[0].text).toContain('"Blue"');
    expect(result.content[0].text).toContain('option 2');
  });

  it('returns isError on timeout', async () => {
    mockRelay.ensureConnected.mockResolvedValue(undefined);
    mockRelay.waitForDecision.mockRejectedValue(new Error('Timed out'));
    mockRelay.pushPayload.mockResolvedValue({ ok: true, clients: 1 });

    const result = await callTool('jarvis_decide', baseArgs);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Timed out');
  });

  it('uses default timeout 120s / custom timeout', async () => {
    mockRelay.ensureConnected.mockResolvedValue(undefined);
    mockRelay.waitForDecision.mockResolvedValue({
      type: 'decision',
      correlationId: 'test-uuid-1234',
      question: 'Which color?',
      selectedLabel: 'Red',
      selectedIndex: 0,
    });
    mockRelay.pushPayload.mockResolvedValue({ ok: true, clients: 1 });

    // Default timeout — called with correlationId, timeout, and payload
    await callTool('jarvis_decide', baseArgs);
    expect(mockRelay.waitForDecision).toHaveBeenCalledWith(
      'test-uuid-1234',
      120000,
      expect.objectContaining({ correlationId: 'test-uuid-1234' }),
    );

    vi.clearAllMocks();
    mockRelay.ensureConnected.mockResolvedValue(undefined);
    mockRelay.waitForDecision.mockResolvedValue({
      type: 'decision',
      correlationId: 'test-uuid-1234',
      question: 'Which color?',
      selectedLabel: 'Red',
      selectedIndex: 0,
    });
    mockRelay.pushPayload.mockResolvedValue({ ok: true, clients: 1 });

    // Custom timeout
    await callTool('jarvis_decide', { ...baseArgs, timeout_seconds: 30 });
    expect(mockRelay.waitForDecision).toHaveBeenCalledWith(
      'test-uuid-1234',
      30000,
      expect.objectContaining({ correlationId: 'test-uuid-1234' }),
    );
  });
});

describe('jarvis_approve', () => {
  const baseArgs = {
    title: 'Deploy Plan',
    decisions: [
      {
        question: 'Environment?',
        options: [{ label: 'Staging' }, { label: 'Prod' }],
      },
    ],
  };

  it('constructs L4 payload with decisions + optional summary/risks + correlationId', async () => {
    mockRelay.ensureConnected.mockResolvedValue(undefined);
    mockRelay.waitForApproval.mockResolvedValue({
      type: 'approval',
      approved: true,
      decisions: [{ question: 'Environment?', selectedLabel: 'Staging', selectedIndex: 0 }],
    });
    mockRelay.pushPayload.mockResolvedValue({ ok: true, clients: 1 });

    await callTool('jarvis_approve', {
      ...baseArgs,
      summary: 'Deploy summary',
      risks: ['Downtime possible'],
    });

    expect(mockRelay.pushPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 4,
        title: 'Deploy Plan',
        summary: 'Deploy summary',
        risks: ['Downtime possible'],
        decisions: baseArgs.decisions,
        correlationId: 'test-uuid-1234',
      }),
    );
    // waitForApproval receives correlationId, timeout, and payload
    expect(mockRelay.waitForApproval).toHaveBeenCalledWith(
      'test-uuid-1234',
      300000,
      expect.objectContaining({ correlationId: 'test-uuid-1234' }),
    );
  });

  it('returns formatted message with choices when APPROVED', async () => {
    mockRelay.ensureConnected.mockResolvedValue(undefined);
    mockRelay.waitForApproval.mockResolvedValue({
      type: 'approval',
      approved: true,
      decisions: [
        { question: 'Environment?', selectedLabel: 'Staging', selectedIndex: 0 },
      ],
    });
    mockRelay.pushPayload.mockResolvedValue({ ok: true, clients: 1 });

    const result = await callTool('jarvis_approve', baseArgs);
    expect(result.content[0].text).toContain('APPROVED');
    expect(result.content[0].text).toContain('Environment?');
    expect(result.content[0].text).toContain('"Staging"');
  });

  it('returns rejected message when REJECTED', async () => {
    mockRelay.ensureConnected.mockResolvedValue(undefined);
    mockRelay.waitForApproval.mockResolvedValue({
      type: 'approval',
      approved: false,
      decisions: [],
    });
    mockRelay.pushPayload.mockResolvedValue({ ok: true, clients: 1 });

    const result = await callTool('jarvis_approve', baseArgs);
    expect(result.content[0].text).toContain('REJECTED');
  });

  it('returns isError on timeout', async () => {
    mockRelay.ensureConnected.mockResolvedValue(undefined);
    mockRelay.waitForApproval.mockRejectedValue(new Error('Timed out'));
    mockRelay.pushPayload.mockResolvedValue({ ok: true, clients: 1 });

    const result = await callTool('jarvis_approve', baseArgs);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Timed out');
  });
});
