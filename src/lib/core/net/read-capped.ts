/** A response's text, up to `cap` bytes, or up to the first `stop` when one is given: the rest is never read. */
export async function readCapped(res: Response, cap: number, stop?: RegExp): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let text = '';
  let size = 0;
  while (size < cap) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    const part = value.subarray(0, Math.min(value.length, cap - size));
    size += part.length;
    text += decoder.decode(part, { stream: true });
    if (stop?.test(text)) break;
  }
  await reader.cancel().catch(() => undefined);
  return text + decoder.decode();
}
