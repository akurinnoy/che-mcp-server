import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from '../config.js';

export interface Message {
  message_id: string;
  from: string;
  to: string;
  body: string;
  thread_id: string;
  timestamp: string;
}

const inboxes = new Map<string, Message[]>();

let currentDataDir: string | null = null;

export function initStore(dataDir: string): void {
  currentDataDir = dataDir;
  mkdirSync(dataDir, { recursive: true });

  // Clear in-memory state
  inboxes.clear();

  // Crash recovery: rename .tmp file if it exists from a previous crash
  const tmpPath = join(dataDir, 'messages.json.tmp');
  const filePath = join(dataDir, 'messages.json');
  if (existsSync(tmpPath)) {
    renameSync(tmpPath, filePath);
  }

  // Load existing messages from disk
  if (existsSync(filePath)) {
    try {
      const raw = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw) as Record<string, Message[]>;
      for (const [key, messages] of Object.entries(data)) {
        inboxes.set(key, messages);
      }
    } catch {
      // Corrupted file — start fresh
    }
  }
}

function flushToDisk(): void {
  if (!currentDataDir) return;
  const filePath = join(currentDataDir, 'messages.json');
  const tmpPath = join(currentDataDir, 'messages.json.tmp');
  const data: Record<string, Message[]> = {};
  for (const [key, messages] of inboxes.entries()) {
    data[key] = messages;
  }
  writeFileSync(tmpPath, JSON.stringify(data), 'utf-8');
  renameSync(tmpPath, filePath);
}

export function sendMessage(
  from: string,
  to: string,
  body: string,
  thread_id?: string,
): { message_id: string; thread_id: string } {
  const message_id = crypto.randomUUID();
  const resolvedThreadId = thread_id ?? crypto.randomUUID();

  const message: Message = {
    message_id,
    from,
    to,
    body,
    thread_id: resolvedThreadId,
    timestamp: new Date().toISOString(),
  };

  const inbox = inboxes.get(to);
  if (inbox) {
    inbox.push(message);
  } else {
    inboxes.set(to, [message]);
  }

  flushToDisk();

  return { message_id, thread_id: resolvedThreadId };
}

export function receiveMessages(
  sessionId: string,
  threadId?: string,
): { messages: Message[] } {
  const inbox = inboxes.get(sessionId);
  if (!inbox || inbox.length === 0) {
    return { messages: [] };
  }

  if (threadId) {
    const matching: Message[] = [];
    const remaining: Message[] = [];
    for (const msg of inbox) {
      if (msg.thread_id === threadId) {
        matching.push(msg);
      } else {
        remaining.push(msg);
      }
    }
    if (remaining.length === 0) {
      inboxes.delete(sessionId);
    } else {
      inboxes.set(sessionId, remaining);
    }
    flushToDisk();
    return { messages: matching };
  }

  inboxes.delete(sessionId);
  flushToDisk();
  return { messages: inbox };
}

export function getUnreadCount(sessionId: string): number {
  const inbox = inboxes.get(sessionId);
  return inbox ? inbox.length : 0;
}

export function clearAllInboxes(): void {
  inboxes.clear();
  if (currentDataDir) {
    const filePath = join(currentDataDir, 'messages.json');
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }
}

if (!process.env.VITEST) {
  initStore(DATA_DIR);
}
