import { findPodForWorkspace, selectContainer, execInPod } from '../kube/exec.js';
import type { ProtocolStatus } from '../types.js';

export async function readProtocolStatus(workspace: string, sessionId: string): Promise<ProtocolStatus> {
  const empty: ProtocolStatus = {
    session_id: sessionId,
    heartbeat_age_seconds: null,
    has_outbox: false,
    has_inbox: false,
    has_shutdown_requested: false,
    progress_tail: null,
    result: null,
  };

  try {
    const { podName, containers } = await findPodForWorkspace(workspace);
    const container = selectContainer(containers);

    const script = [
      'dir="$1"',
      `echo "---HEARTBEAT---"`,
      `stat -c %Y "$dir/heartbeat" 2>/dev/null || echo "NONE"`,
      `echo "---OUTBOX---"`,
      `test -f "$dir/outbox.md" && echo "EXISTS" || echo "NONE"`,
      `echo "---INBOX---"`,
      `test -f "$dir/inbox.md" && echo "EXISTS" || echo "NONE"`,
      `echo "---SHUTDOWN---"`,
      `test -f "$dir/shutdown-requested" && echo "EXISTS" || echo "NONE"`,
      `echo "---PROGRESS---"`,
      `tail -5 "$dir/progress.jsonl" 2>/dev/null || echo "NONE"`,
      `echo "---RESULT---"`,
      `cat "$dir/result.json" 2>/dev/null || echo "NONE"`,
    ].join(' && ');

    const result = await execInPod(podName, container, ['bash', '-c', script, '--', `/projects/.agent/${sessionId}`]);

    if (result.exitCode !== 0) {
      return empty;
    }

    return parseProtocolOutput(result.stdout, sessionId);
  } catch {
    // Pod not running, exec failed, etc. — return empty
    return empty;
  }
}

function parseProtocolOutput(output: string, sessionId: string): ProtocolStatus {
  const sections = new Map<string, string>();
  const delimiters = ['---HEARTBEAT---', '---OUTBOX---', '---INBOX---', '---SHUTDOWN---', '---PROGRESS---', '---RESULT---'];

  let currentKey: string | null = null;
  let currentLines: string[] = [];

  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (delimiters.includes(trimmed)) {
      if (currentKey) {
        sections.set(currentKey, currentLines.join('\n').trim());
      }
      currentKey = trimmed;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentKey) {
    sections.set(currentKey, currentLines.join('\n').trim());
  }

  // Parse heartbeat age
  let heartbeat_age_seconds: number | null = null;
  const hbRaw = sections.get('---HEARTBEAT---') ?? 'NONE';
  if (hbRaw !== 'NONE' && hbRaw !== '') {
    const mtime = parseInt(hbRaw, 10);
    if (!isNaN(mtime)) {
      heartbeat_age_seconds = Math.floor(Date.now() / 1000) - mtime;
    }
  }

  // Parse result.json
  let result: object | null = null;
  const resultRaw = sections.get('---RESULT---') ?? 'NONE';
  if (resultRaw !== 'NONE' && resultRaw !== '') {
    try {
      result = JSON.parse(resultRaw);
    } catch {
      // Invalid JSON — leave as null
    }
  }

  // Parse progress tail
  let progress_tail: string[] | null = null;
  const progressRaw = sections.get('---PROGRESS---') ?? 'NONE';
  if (progressRaw !== 'NONE' && progressRaw !== '') {
    progress_tail = progressRaw.split('\n').filter(l => l.trim() !== '');
  }

  return {
    session_id: sessionId,
    heartbeat_age_seconds,
    has_outbox: (sections.get('---OUTBOX---') ?? '').trim() === 'EXISTS',
    has_inbox: (sections.get('---INBOX---') ?? '').trim() === 'EXISTS',
    has_shutdown_requested: (sections.get('---SHUTDOWN---') ?? '').trim() === 'EXISTS',
    progress_tail,
    result,
  };
}
