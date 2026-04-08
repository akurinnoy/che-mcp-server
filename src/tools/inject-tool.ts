import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

interface InjectToolParams {
  workspace: string;
  tool: string;
}

export async function injectTool(params: InjectToolParams): Promise<{
  injected: boolean;
  restart_required: boolean;
  message: string;
}> {
  try {
    await execFileAsync('inject-tool', [params.tool, params.workspace], { timeout: 30_000 });
    return {
      injected: true,
      restart_required: true,
      message: `Tool "${params.tool}" injected into workspace "${params.workspace}". Workspace will restart to apply the change.`,
    };
  } catch (err: any) {
    throw new Error(`Failed to inject tool "${params.tool}": ${err.message}`);
  }
}
