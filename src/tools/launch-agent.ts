import { launchAgent } from '../orchestrator/index.js';

export async function launchAgentTool(params: {
  workspace: string;
  session_id: string;
  command: string;
  working_directory?: string;
  env?: Record<string, string>;
}): Promise<{ session_id: string; status: string }> {
  return launchAgent(params);
}
