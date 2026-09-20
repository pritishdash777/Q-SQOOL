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

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

function render(text) {
  return renderToStaticMarkup(React.createElement(Markdown, {
    remarkPlugins: [remarkGfm, remarkMath],
    rehypePlugins: [rehypeKatex],
  }, normalizeChatMarkdown(text)));
}

test('Hadamard matrix row spacing does not consume the following explanation', () => {
  const input = String.raw`**The Hadamard gate (H)**

| Symbol | Matrix (in the computational basis) |
| --- | --- |
| H | $$\frac{1}{\sqrt{2}}\begin{pmatrix}1 & 1\\[2pt]1 & -1\end{pmatrix}$$ |

### Intuition
- It creates **superposition**.

### Action on the computational basis
\[
\begin{aligned}
H|0\rangle &= \frac{|0\rangle+|1\rangle}{\sqrt{2}}\\[4pt]
H|1\rangle &= \frac{|0\rangle-|1\rangle}{\sqrt{2}}.
\end{aligned}
\]

Thus a qubit changes basis.`;
  const html = render(input);
  assert.doesNotMatch(html, /katex-error|#cc0000|\\begin\{pmatrix\}\$\$/);
  assert.match(html, /<h3>Intuition<\/h3>/);
  assert.match(html, /<strong>superposition<\/strong>/);
  assert.match(html, /<h3>Action on the computational basis<\/h3>/);
  assert.match(html, /<p>Thus a qubit changes basis\.<\/p>/);
  assert.equal((html.match(/class="katex"/g) ?? []).length, 2);
});

test('bracket equations in tables keep table structure and render as math', () => {
  const html = render(String.raw`| Gate | Matrix |
| --- | --- |
| H | \[\frac{1}{\sqrt{2}}\begin{pmatrix}1 & 1\\[2pt]1 & -1\end{pmatrix}\] |`);
  assert.match(html, /<table>/);
  assert.match(html, /class="katex"/);
  assert.doesNotMatch(html, /katex-error/);
});

test('inline code and matrix row breaks remain literal during normalization', () => {
  const code = '`' + String.raw`\[literal\]` + '`';
  assert.equal(normalizeChatMarkdown(code), code);
  const spacing = String.raw`$$\begin{pmatrix}1&1\\[2pt]1&-1\end{pmatrix}$$`;
  assert.equal(normalizeChatMarkdown(spacing), spacing);
});
