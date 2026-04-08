import { stopAgent } from '../orchestrator/index.js';
export async function stopAgentTool(params: { workspace: string }) {
  return stopAgent(params);
}
