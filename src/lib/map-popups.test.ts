import { describe, expect, it } from 'vitest';
import { urlSafe } from './map-popups';

describe('urlSafe', () => {
  it('escapes a link so a quote cannot leave the attribute', () => {
    expect(urlSafe('https://example.com/a"onmouseover="alert(1)')).toBe('https://example.com/a&quot;onmouseover=&quot;alert(1)');
    expect(urlSafe("https://example.com/?q='x'&y=<b>")).toBe('https://example.com/?q=&#39;x&#39;&amp;y=&lt;b&gt;');
  });

  it('refuses anything but http(s)', () => {
    expect(urlSafe('javascript:alert(1)')).toBe('#');
    expect(urlSafe('data:text/html,<script>')).toBe('#');
    expect(urlSafe(undefined)).toBe('#');
  });
});
