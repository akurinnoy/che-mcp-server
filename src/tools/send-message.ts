import { sendMessage } from '../messaging/store.js';

export function sendMessageTool(params: {
  from: string;
  to: string;
  body: string;
  thread_id?: string;
}): { message_id: string; thread_id: string } {
  return sendMessage(params.from, params.to, params.body, params.thread_id);
}
