// The assistant's answers only need bold and lists; rendering them as React text keeps any HTML inert.
export type Inline = { text: string; bold: boolean };
export type Block = { type: "p"; parts: Inline[] } | { type: "ul"; items: Inline[][] };

function inline(text: string): Inline[] {
  const parts: Inline[] = []; let rest = text;
  for (;;) {
    const open = rest.indexOf("**"); const close = open < 0 ? -1 : rest.indexOf("**", open + 2);
    if (close < 0) { if (rest) parts.push({ text: rest, bold: false }); return parts; }
    if (open > 0) parts.push({ text: rest.slice(0, open), bold: false });
    if (close > open + 2) parts.push({ text: rest.slice(open + 2, close), bold: true });
    rest = rest.slice(close + 2);
  }
}

export function parseMarkdown(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = /^[-*]\s+(.*)$/.exec(line); const numbered = /^\d+[.)]\s+/.test(line);
    if (bullet || numbered) {
      const item = inline(bullet ? bullet[1] : line); const last = blocks.at(-1);
      if (last?.type === "ul") last.items.push(item); else blocks.push({ type: "ul", items: [item] });
    } else blocks.push({ type: "p", parts: inline(line) }); // each non-list line is its own paragraph
  }
  return blocks;
}
