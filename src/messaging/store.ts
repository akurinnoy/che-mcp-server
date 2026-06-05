export interface Message {
  message_id: string;
  from: string;
  to: string;
  body: string;
  thread_id: string;
  timestamp: string;
}

const inboxes = new Map<string, Message[]>();

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
    return { messages: matching };
  }

  inboxes.delete(sessionId);
  return { messages: inbox };
}

export function getUnreadCount(sessionId: string): number {
  const inbox = inboxes.get(sessionId);
  return inbox ? inbox.length : 0;
}

export function clearAllInboxes(): void {
  inboxes.clear();
}
