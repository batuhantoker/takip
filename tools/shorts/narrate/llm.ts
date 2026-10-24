/**
 * Claude, for writing and translating the words. By default through the Claude Code CLI on this Mac (`claude -p`, the
 * user's own plan, Fable 5.1: the user's pick on 2026-10-22, when `aws login` kept expiring overnight); SHORTS_LLM=bedrock
 * goes to Amazon Bedrock instead (AWS chain, AWS_REGION). SHORTS_LLM_MODEL overrides the model either way.
 */
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk';
import type Anthropic from '@anthropic-ai/sdk';

// the local models turned "three quarters" into "a third" in Turkish; Claude writes and translates far better
const BACKEND = process.env.SHORTS_LLM === 'bedrock' ? 'bedrock' : 'claude';
const MODEL = process.env.SHORTS_LLM_MODEL ?? (BACKEND === 'bedrock' ? 'anthropic.claude-opus-5-5' : 'claude-fable-5-1');
let client: AnthropicBedrockMantle | null = null;

const jsonOf = (text: string) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : text);
};

async function bedrock(system: string, messages: Anthropic.MessageParam[]) {
  client ??= new AnthropicBedrockMantle({ awsRegion: process.env.AWS_REGION ?? 'us-east-1' });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system,
    messages,
    output_config: { effort: 'medium' },
  }).catch((err: unknown) => {
    const why = err instanceof Error ? err.message : String(err);
    throw new Error(`Bedrock (${MODEL}): ${why}${/expired|credential|token|security/i.test(why) ? ' (run `aws login`)' : ''}`);
  });
  if (response.stop_reason === 'refusal') throw new Error(`Bedrock declined: ${response.stop_details?.explanation ?? 'no reason given'}`);
  return response.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('');
}

/** A reply takes about a minute; one that hangs would hold the whole film queue. */
const CLI_TIMEOUT_MS = 10 * 60_000;

/** One prompt through `claude -p`: no tools, no MCP servers, and run from a temp folder so no project CLAUDE.md joins in. */
function cli(system: string, messages: Anthropic.MessageParam[]) {
  const prompt = messages.map(m => (m.role === 'user' ? m.content : `Your reply was:\n${m.content}`)).join('\n\n');
  const args = ['-p', '--output-format', 'json', '--model', MODEL, '--effort', 'medium', '--tools', '',
    '--strict-mcp-config', '--no-session-persistence', '--system-prompt', system];
  return new Promise<string>((resolve, reject) => {
    const child = spawn('claude', args, { cwd: tmpdir(), stdio: ['pipe', 'pipe', 'pipe'] });
    const timer = setTimeout(() => child.kill('SIGTERM'), CLI_TIMEOUT_MS);
    let out = '', err = '';
    child.stdout.on('data', d => (out += d));
    child.stderr.on('data', d => (err += d));
    child.on('error', e => reject(new Error(`claude CLI: ${e.message} (is Claude Code installed and signed in?)`)));
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (signal) return reject(new Error(`claude CLI (${MODEL}) gave no reply in ${CLI_TIMEOUT_MS / 60_000} min (${signal})`));
      let reply: { is_error?: boolean; result?: string } | null = null;
      try {
        reply = JSON.parse(out);
      } catch {
        return reject(new Error(`claude CLI (${MODEL}) exited ${code}: ${(err || out).trim().slice(-300)}`));
      }
      if (reply?.is_error || typeof reply?.result !== 'string') return reject(new Error(`claude CLI (${MODEL}): ${reply?.result ?? err.trim()}`));
      resolve(reply.result);
    });
    child.stdin.end(prompt);
  });
}

/** Asks for a JSON object; retries when the reply doesn't parse or fails `check`, telling the model why. */
export async function askJson<T>(system: string, user: string, { check }: { check?: (v: T) => string | null } = {}): Promise<T> {
  const sys = `${system}\nReply with the JSON object alone: no code fence, no text around it.`;
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: user }];
  let problem = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const text = BACKEND === 'bedrock' ? await bedrock(sys, messages) : await cli(sys, messages);
    try {
      const value = jsonOf(text) as T;
      problem = check?.(value) ?? '';
      if (!problem) return value;
    } catch {
      problem = 'it was not valid JSON';
    }
    // append-only: the rejected reply stays, the correction follows it
    messages.push({ role: 'assistant', content: text }, { role: 'user', content: `That was rejected: ${problem}. Send the corrected JSON.` });
  }
  throw new Error(`${MODEL} kept failing: ${problem}`);
}
