export const authoringSlug = (title: string, max = 100) => title.normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '').slice(0, max).replace(/-$/g, '');

export interface ContentBlock { heading: string; body: string }
export const blocksToMarkdown = (blocks: ContentBlock[]) => blocks
  .filter(block => block.body.trim())
  .map(block => [block.heading.trim() ? `## ${block.heading.trim().replace(/[\r\n]+/g, ' ')}` : '', block.body.trim()].filter(Boolean).join('\n\n'))
  .join('\n\n');

export function markdownToBlocks(markdown: string): ContentBlock[] {
  const blocks: ContentBlock[] = [{ heading: '', body: '' }];
  let fence = '';
  for (const line of markdown.split('\n')) {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker && !fence) fence = marker[1];
    else if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = '';
    const heading = !fence && !marker ? line.match(/^## (.+)$/) : null;
    if (heading) blocks.push({ heading: heading[1], body: '' });
    else blocks[blocks.length - 1].body += `${line}\n`;
  }
  const result = blocks.filter(b => b.heading || b.body.trim()).map(b => ({ ...b, body: b.body.trim() }));
  return result.length ? result : [{ heading: '', body: '' }];
}

export async function readContentFile(file: File, limit = 500000) {
  if (!/\.(md|markdown|txt)$/i.test(file.name)) throw new Error('Choose a Markdown (.md) or text (.txt) file. Attach PDFs and videos as resources after saving.');
  if (file.size === 0 || file.size > limit * 4) throw new Error('This content file is empty or too large.');
  const text = (await file.text()).replace(/^\uFEFF/, '');
  if (!text.trim() || text.length > limit || text.includes('\0')) throw new Error(`Choose readable text with no more than ${limit.toLocaleString()} characters.`);
  return text;
}
