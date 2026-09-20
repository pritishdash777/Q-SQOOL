/** Groq may return TeX's \(...\) and \[...\] delimiters; remark-math uses $ and $$. */
export function normalizeChatMarkdown(text: string): string {
  return text.split(/(```[\s\S]*?(?:```|$))/g).map(part => {
    if (part.startsWith('```')) return part;
    return part
      .replace(/\\\[([\s\S]*?)\\\]/g, (_match, math: string) => `\n\n$$\n${math.trim()}\n$$\n\n`)
      .replace(/\\\(([\s\S]*?)\\\)/g, (_match, math: string) => `$${math.trim()}$`);
  }).join('');
}
