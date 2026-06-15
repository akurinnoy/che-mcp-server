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

let currentDataDir: string | null = null;
const inboxes = new Map<string, Message[]>();

export function initStore(dataDir: string): void {
  currentDataDir = dataDir;
  mkdirSync(dataDir, { recursive: true });
  inboxes.clear();

  const tmpPath = join(dataDir, 'messages.json.tmp');
  const mainPath = join(dataDir, 'messages.json');

  if (existsSync(tmpPath) && !existsSync(mainPath)) {
    renameSync(tmpPath, mainPath);
  }

  if (existsSync(mainPath)) {
    try {
      const raw = readFileSync(mainPath, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, Message[]>;
      for (const [key, value] of Object.entries(parsed)) {
        inboxes.set(key, value);
      }
    } catch {
      console.error('Warning: could not load store, starting empty');
    }
  }
}

function flushToDisk(): void {
  if (!currentDataDir) return;
  const data = JSON.stringify(Object.fromEntries(inboxes));
  const tmpPath = join(currentDataDir, 'messages.json.tmp');
  const mainPath = join(currentDataDir, 'messages.json');
  writeFileSync(tmpPath, data, 'utf-8');
  renameSync(tmpPath, mainPath);
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

  if (currentDataDir) flushToDisk();

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
    if (currentDataDir) flushToDisk();
    return { messages: matching };
  }

  inboxes.delete(sessionId);
  if (currentDataDir) flushToDisk();
  return { messages: inbox };
}

export function getUnreadCount(sessionId: string): number {
  const inbox = inboxes.get(sessionId);
  return inbox ? inbox.length : 0;
}

export function clearAllInboxes(): void {
  inboxes.clear();
  if (!currentDataDir) return;
  rmSync(join(currentDataDir, 'messages.json'), { force: true });
}

if (!process.env.VITEST) {
  initStore(DATA_DIR);
}
