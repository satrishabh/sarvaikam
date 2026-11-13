const { test } = require('node:test');
const assert = require('node:assert/strict');
const { authoringSlug, markdownToBlocks, blocksToMarkdown, readContentFile } = require('../../.cache/learning-tests/authoring.js');

test('generated URLs normalize accents, punctuation and trailing separators', () => {
  assert.equal(authoringSlug('  Gén AI / ML: Intro! '), 'gen-ai-ml-intro');
  assert.equal(authoringSlug('A long course title', 7), 'a-long');
});
test('the section editor preserves headings inside code examples', () => {
  const original = 'Introduction\n\n## Example\n\n```md\n## This is code\n```\n\n## Practice\n\nTry it.';
  const blocks = markdownToBlocks(original);
  assert.equal(blocks.length, 3);
  assert.equal(blocks[1].heading, 'Example');
  assert.match(blocks[1].body, /## This is code/);
  assert.equal(blocksToMarkdown(blocks), original);
});
test('section headings cannot inject extra lines and blank placeholders are omitted', () => {
  assert.equal(blocksToMarkdown([{heading:'Sources\nInjected',body:'Reference'}, {heading:'Practice',body:''}]), '## Sources Injected\n\nReference');
});
test('imports reject binary formats and oversized text before replacing editor content', async () => {
  let read = false;
  await assert.rejects(() => readContentFile({name:'guide.pdf',size:10,text:async()=>{read=true;return 'PDF';}}), /Markdown/);
  assert.equal(read, false);
  await assert.rejects(() => readContentFile({name:'reel.txt',size:3,text:async()=>'abcd'}, 3), /no more than/);
  await assert.rejects(() => readContentFile({name:'data.txt',size:3,text:async()=>'a\0b'}), /readable text/);
  assert.equal(await readContentFile({name:'intro.md',size:4,text:async()=>'\uFEFFHi!'}), 'Hi!');
});
