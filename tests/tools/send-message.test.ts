import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearAllInboxes,
  initStore,
  receiveMessages,
} from '../../src/messaging/store.js';
import { sendMessageTool } from '../../src/tools/send-message.js';

describe('sendMessageTool', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'send-message-test-'));
    initStore(tmpDir);
  });

  afterEach(() => {
    clearAllInboxes();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('sends a message and returns message_id and thread_id', () => {
    const result = sendMessageTool({
      from: 'supervisor-1',
      to: 'worker-1',
      body: 'do the thing',
    });

    expect(result.message_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(result.thread_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    const inbox = receiveMessages('worker-1');
    expect(inbox.messages).toHaveLength(1);
    expect(inbox.messages[0].body).toBe('do the thing');
    expect(inbox.messages[0].from).toBe('supervisor-1');
    expect(inbox.messages[0].to).toBe('worker-1');
  });

  it('passes through explicit thread_id', () => {
    const result = sendMessageTool({
      from: 'supervisor-1',
      to: 'worker-1',
      body: 'continue',
      thread_id: 'existing-thread',
    });

    expect(result.thread_id).toBe('existing-thread');
  });
});
