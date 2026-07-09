import type { Message } from '../messaging/store.js';
import { receiveMessages } from '../messaging/store.js';

export function receiveMessagesTool(params: {
  session_id: string;
  thread_id?: string;
}): { messages: Message[] } {
  return receiveMessages(params.session_id, params.thread_id);
}
