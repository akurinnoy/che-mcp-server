import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearAllInboxes,
  initStore,
  sendMessage,
} from '../../src/messaging/store.js';
import { receiveMessagesTool } from '../../src/tools/receive-messages.js';

describe('receiveMessagesTool', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'receive-messages-test-'));
    initStore(tmpDir);
  });

  afterEach(() => {
    clearAllInboxes();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns and consumes messages for a session', () => {
    sendMessage('supervisor-1', 'worker-1', 'task A');
    sendMessage('supervisor-1', 'worker-1', 'task B');

    const result = receiveMessagesTool({ session_id: 'worker-1' });
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].body).toBe('task A');
    expect(result.messages[1].body).toBe('task B');

    const empty = receiveMessagesTool({ session_id: 'worker-1' });
    expect(empty.messages).toHaveLength(0);
  });

  it('filters by thread_id when provided', () => {
    sendMessage('supervisor-1', 'worker-1', 'thread-X msg', 'thread-X');
    sendMessage('supervisor-1', 'worker-1', 'thread-Y msg', 'thread-Y');

    const result = receiveMessagesTool({
      session_id: 'worker-1',
      thread_id: 'thread-X',
    });
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].body).toBe('thread-X msg');

    const remaining = receiveMessagesTool({ session_id: 'worker-1' });
    expect(remaining.messages).toHaveLength(1);
    expect(remaining.messages[0].body).toBe('thread-Y msg');
  });

  it('returns empty array for unknown session', () => {
    const result = receiveMessagesTool({ session_id: 'nobody' });
    expect(result.messages).toEqual([]);
  });
});
