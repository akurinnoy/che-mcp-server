import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  clearAllInboxes,
  getUnreadCount,
  initStore,
  receiveMessages,
  sendMessage,
} from '../../src/messaging/store.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'store-persistence-test-'));
  initStore(tmpDir);
});

afterEach(() => {
  clearAllInboxes();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('MessageStore persistence', () => {
  it('isolation — messages in one test do not leak to the next', () => {
    sendMessage('supervisor', 'worker-1', 'test message');
    const result = receiveMessages('worker-1');
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].body).toBe('test message');
  });

  it('persistence across restart — messages survive re-initialization from same directory', () => {
    sendMessage('supervisor', 'worker-1', 'task brief');
    // Simulate restart: call initStore again from SAME directory WITHOUT clearAllInboxes
    initStore(tmpDir);
    // Messages should be loaded back from disk
    expect(getUnreadCount('worker-1')).toBe(1);
    const result = receiveMessages('worker-1');
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].body).toBe('task brief');
    expect(result.messages[0].from).toBe('supervisor');
    expect(result.messages[0].to).toBe('worker-1');
  });

  it('file deletion — clearAllInboxes removes messages.json from disk', () => {
    sendMessage('supervisor', 'worker-2', 'hello');
    const messagesFile = join(tmpDir, 'messages.json');
    // File should exist after sendMessage (flush occurred)
    expect(existsSync(messagesFile)).toBe(true);
    clearAllInboxes();
    // File should be deleted after clearAllInboxes
    expect(existsSync(messagesFile)).toBe(false);
    // In-memory state cleared too
    const result = receiveMessages('worker-2');
    expect(result.messages).toHaveLength(0);
  });

  it('empty start — initStore on fresh directory gives no messages', () => {
    const result = receiveMessages('nobody');
    expect(result.messages).toEqual([]);
    expect(getUnreadCount('nobody')).toBe(0);
  });

  it('count accuracy — getUnreadCount reflects correct count after reload', () => {
    sendMessage('supervisor', 'worker-3', 'message one');
    sendMessage('supervisor', 'worker-3', 'message two');
    expect(getUnreadCount('worker-3')).toBe(2);
    // Simulate restart
    initStore(tmpDir);
    expect(getUnreadCount('worker-3')).toBe(2);
    receiveMessages('worker-3');
    expect(getUnreadCount('worker-3')).toBe(0);
  });
});
