/**
 * Claude on Amazon Bedrock, for writing and translating the words. Credentials come from the AWS chain
 * (`aws login` on this Mac); SHORTS_LLM_MODEL and AWS_REGION override the model and region.
 */
import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk';
import type Anthropic from '@anthropic-ai/sdk';

// the local models turned "three quarters" into "a third" in Turkish; Claude writes and translates far better
const MODEL = process.env.SHORTS_LLM_MODEL ?? 'anthropic.claude-opus-5-5';
let client: AnthropicBedrockMantle | null = null;

const jsonOf = (text: string) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : text);
};

/** Asks for a JSON object; retries when the reply doesn't parse or fails `check`, telling the model why. */
export async function askJson<T>(system: string, user: string, { check }: { check?: (v: T) => string | null } = {}): Promise<T> {
  client ??= new AnthropicBedrockMantle({ awsRegion: process.env.AWS_REGION ?? 'us-east-1' });
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: user }];
  let problem = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: `${system}\nReply with the JSON object alone: no code fence, no text around it.`,
      messages,
      output_config: { effort: 'medium' },
    }).catch((err: unknown) => {
      const why = err instanceof Error ? err.message : String(err);
      throw new Error(`Bedrock (${MODEL}): ${why}${/expired|credential|token|security/i.test(why) ? ' (run `aws login`)' : ''}`);
    });
    if (response.stop_reason === 'refusal') throw new Error(`Bedrock declined: ${response.stop_details?.explanation ?? 'no reason given'}`);
    const text = response.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('');
    try {
      const value = jsonOf(text) as T;
      problem = check?.(value) ?? '';
      if (!problem) return value;
    } catch {
      problem = 'it was not valid JSON';
    }
    // append-only: the rejected reply stays, the correction follows it
    messages.push({ role: 'assistant', content: response.content }, { role: 'user', content: `That was rejected: ${problem}. Send the corrected JSON.` });
  }
  throw new Error(`Bedrock kept failing: ${problem}`);
}
