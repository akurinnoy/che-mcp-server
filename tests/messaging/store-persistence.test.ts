import { mkdtempSync, rmSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearAllInboxes,
  getUnreadCount,
  initStore,
  sendMessage,
} from '../../src/messaging/store.js';

describe('crash recovery', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'store-persistence-test-'));
    initStore(tmpDir);
  });

  afterEach(() => {
    clearAllInboxes();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('isolation: messages from prior dir absent after initStore switches dir', () => {
    // Send a message in the first tmpDir
    sendMessage('agent-a', 'agent-b', 'hello from prior dir');
    expect(getUnreadCount('agent-b')).toBe(1);

    // Switch to a fresh directory
    const newDir = mkdtempSync(join(tmpdir(), 'store-persistence-new-'));
    try {
      initStore(newDir);
      // Messages from prior dir should not appear in the new store
      expect(getUnreadCount('agent-b')).toBe(0);
    } finally {
      clearAllInboxes();
      rmSync(newDir, { recursive: true, force: true });
      // Restore tmpDir so afterEach cleanup works cleanly
      initStore(tmpDir);
    }
  });

  it('persistence: messages survive initStore reload of same directory', () => {
    // Send messages and confirm they are present
    sendMessage('sender-1', 'receiver-1', 'persisted message 1');
    sendMessage('sender-1', 'receiver-1', 'persisted message 2');
    expect(getUnreadCount('receiver-1')).toBe(2);

    // Reload from the same directory (simulates restart/crash recovery)
    initStore(tmpDir);

    // Messages should still be present after reload
    expect(getUnreadCount('receiver-1')).toBe(2);
  });

  it('file deletion: clearAllInboxes removes messages.json from disk', () => {
    sendMessage('sender-2', 'receiver-2', 'message to clear');

    const messagesFile = join(tmpDir, 'messages.json');
    expect(existsSync(messagesFile)).toBe(true);

    clearAllInboxes();

    expect(existsSync(messagesFile)).toBe(false);
  });

  it('empty start: initStore on fresh directory returns getUnreadCount 0', () => {
    // tmpDir is a freshly created dir (no prior messages)
    // initStore was already called in beforeEach
    expect(getUnreadCount('any-session')).toBe(0);
  });

  it('getUnreadCount accuracy: count correct after initStore reload', () => {
    sendMessage('sender-3', 'receiver-3', 'msg-1');
    sendMessage('sender-3', 'receiver-3', 'msg-2');
    sendMessage('sender-3', 'receiver-3', 'msg-3');

    // Reload store from same directory
    initStore(tmpDir);

    expect(getUnreadCount('receiver-3')).toBe(3);
  });
});
