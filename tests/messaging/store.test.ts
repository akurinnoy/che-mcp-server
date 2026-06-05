import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAllInboxes,
  getUnreadCount,
  receiveMessages,
  sendMessage,
} from '../../src/messaging/store.js';

describe('Message Store', () => {
  beforeEach(() => {
    clearAllInboxes();
  });

  it('sendMessage creates a message with UUID id and thread_id', () => {
    const result = sendMessage('supervisor-1', 'worker-1', 'hello');
    expect(result.message_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(result.thread_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('sendMessage with explicit thread_id uses it', () => {
    const threadId = 'custom-thread-abc';
    const result = sendMessage('supervisor-1', 'worker-1', 'hello', threadId);
    expect(result.thread_id).toBe(threadId);
  });

  it('receiveMessages returns and removes messages', () => {
    sendMessage('supervisor-1', 'worker-1', 'task-1');
    sendMessage('supervisor-1', 'worker-1', 'task-2');

    const first = receiveMessages('worker-1');
    expect(first.messages).toHaveLength(2);
    expect(first.messages[0].body).toBe('task-1');
    expect(first.messages[1].body).toBe('task-2');

    const second = receiveMessages('worker-1');
    expect(second.messages).toHaveLength(0);
  });

  it('receiveMessages with thread_id filters correctly', () => {
    sendMessage('supervisor-1', 'worker-1', 'msg-thread-A', 'thread-A');
    sendMessage('supervisor-1', 'worker-1', 'msg-thread-B', 'thread-B');
    sendMessage('supervisor-1', 'worker-1', 'msg-thread-A-2', 'thread-A');

    const filtered = receiveMessages('worker-1', 'thread-A');
    expect(filtered.messages).toHaveLength(2);
    expect(filtered.messages[0].body).toBe('msg-thread-A');
    expect(filtered.messages[1].body).toBe('msg-thread-A-2');
    expect(filtered.messages[0].thread_id).toBe('thread-A');

    const remaining = receiveMessages('worker-1');
    expect(remaining.messages).toHaveLength(1);
    expect(remaining.messages[0].body).toBe('msg-thread-B');
  });

  it('receiveMessages with thread_id cleans up inbox when all messages match', () => {
    sendMessage('supervisor-1', 'worker-1', 'msg-1', 'thread-A');
    sendMessage('supervisor-1', 'worker-1', 'msg-2', 'thread-A');

    const result = receiveMessages('worker-1', 'thread-A');
    expect(result.messages).toHaveLength(2);
    expect(getUnreadCount('worker-1')).toBe(0);
  });

  it('receiveMessages returns empty array when no messages', () => {
    const result = receiveMessages('nonexistent-session');
    expect(result.messages).toEqual([]);
  });

  it('getUnreadCount returns count without consuming', () => {
    sendMessage('supervisor-1', 'worker-1', 'hello');
    sendMessage('supervisor-1', 'worker-1', 'world');

    expect(getUnreadCount('worker-1')).toBe(2);
    expect(getUnreadCount('worker-1')).toBe(2);

    receiveMessages('worker-1');
    expect(getUnreadCount('worker-1')).toBe(0);
  });

  it('multiple senders to same recipient', () => {
    sendMessage('supervisor-1', 'worker-1', 'from-sup');
    sendMessage('worker-2', 'worker-1', 'from-peer');

    const result = receiveMessages('worker-1');
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].from).toBe('supervisor-1');
    expect(result.messages[0].body).toBe('from-sup');
    expect(result.messages[1].from).toBe('worker-2');
    expect(result.messages[1].body).toBe('from-peer');
  });
});
