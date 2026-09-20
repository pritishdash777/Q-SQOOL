import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeChatMarkdown } from '../lib/q-ai-format.ts';

test('TeX brackets become Markdown math without changing fenced code', () => {
  const input = 'H is \\( |0\\rangle + |1\\rangle \\)\\n\\n\\[ H = \\frac{1}{\\sqrt{2}} \\]\\n\\n```python\\nprint("\\\\[literal\\\\]")\\n```'.replaceAll('\\n', '\n');
  const result = normalizeChatMarkdown(input);
  assert.match(result, /\$\|0\\rangle \+ \|1\\rangle\$/);
  assert.match(result, /\$\$\nH = \\frac\{1\}\{\\sqrt\{2\}\}\n\$\$/);
  assert.match(result, /print\("\\\\\[literal\\\\\]"\)/);
});
