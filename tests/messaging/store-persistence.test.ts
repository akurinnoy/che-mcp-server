import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearAllInboxes,
  getUnreadCount,
  initStore,
  receiveMessages,
  sendMessage,
} from '../../src/messaging/store.js';

describe('crash recovery', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'mcp-persist-test-'));
    initStore(tmpDir);
  });

  afterEach(() => {
    clearAllInboxes();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('isolation: messages from a prior dir are not present after initStore switches dir', () => {
    sendMessage('alice', 'bob', 'hello');
    const dirB = mkdtempSync(join(tmpdir(), 'mcp-persist-test-'));
    try {
      initStore(dirB);
      const { messages } = receiveMessages('bob');
      expect(messages).toHaveLength(0);
    } finally {
      rmSync(dirB, { recursive: true, force: true });
    }
  });

  it('persistence: messages survive initStore reload of the same directory', () => {
    const { message_id } = sendMessage('alice', 'bob', 'hello from alice');
    // Simulate restart by re-initialising from the same directory
    initStore(tmpDir);
    const { messages } = receiveMessages('bob');
    expect(messages).toHaveLength(1);
    expect(messages[0].message_id).toBe(message_id);
    expect(messages[0].body).toBe('hello from alice');
  });

  it('file deletion: clearAllInboxes removes messages.json from disk', () => {
    sendMessage('alice', 'bob', 'hello');
    clearAllInboxes();
    expect(existsSync(join(tmpDir, 'messages.json'))).toBe(false);
  });

  it('empty start: initStore on a fresh directory returns getUnreadCount 0', () => {
    // tmpDir is fresh (created in beforeEach, no messages written)
    expect(getUnreadCount('bob')).toBe(0);
    expect(getUnreadCount('alice')).toBe(0);
  });

  it('getUnreadCount accuracy: count is correct after initStore reload', () => {
    sendMessage('alice', 'bob', 'msg1');
    sendMessage('alice', 'bob', 'msg2');
    // Simulate restart
    initStore(tmpDir);
    expect(getUnreadCount('bob')).toBe(2);
  });
});
