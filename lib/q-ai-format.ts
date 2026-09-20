/** Normalize TeX delimiters without treating a matrix row break (\\[2pt]) as math. */
export function normalizeChatMarkdown(text: string): string {
  // Leave fenced and inline code untouched, including incomplete fenced code.
  return text.split(/(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]*`)/g).map(part => {
    if (part.startsWith('`') || part.startsWith('~~~')) return part;
    return part
      .replace(/(?<!\\)\\\[([\s\S]*?)(?<!\\)\\\]/g, (match, math: string, offset: number, source: string) => {
        const lineStart = source.lastIndexOf('\n', offset - 1) + 1;
        const before = source.slice(lineStart, offset);
        // Display delimiters inside table cells must remain on the same line.
        if (before.trimStart().startsWith('|')) return `$$${math.trim()}$$`;
        return `\n\n$$\n${math.trim()}\n$$\n\n`;
      })
      .replace(/(?<!\\)\\\(([\s\S]*?)(?<!\\)\\\)/g, (_match, math: string) => `$${math.trim()}$`);
  }).join('');
}
