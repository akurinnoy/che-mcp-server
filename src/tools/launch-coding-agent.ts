import { launchCodingAgent } from '../orchestrator/index.js';

interface Params { workspace: string; task: string; agent_type?: string; }

export async function launchCodingAgentTool(params: Params) {
  return launchCodingAgent(params);
}
