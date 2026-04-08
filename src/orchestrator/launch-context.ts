export interface LaunchContextParams {
  workspace: string;
  agentType: string;
  task: string;
  tools: string[];
  branch?: string;
}

export function buildLaunchContext(params: LaunchContextParams): string {
  const { workspace, agentType, task, tools, branch } = params;
  const lines = [
    `Workspace: ${workspace}`,
    branch ? `Branch: ${branch}` : null,
    `Agent type: ${agentType}`,
    tools.length > 0 ? `Available tools: ${tools.join(', ')}` : null,
    '',
    `Task: ${task}`,
  ].filter((l): l is string => l !== null);

  return lines.join('\n');
}
