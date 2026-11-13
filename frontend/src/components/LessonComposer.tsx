import { useState } from 'react';
import { blocksToMarkdown, ContentBlock, markdownToBlocks, readContentFile } from '../authoring';

export default function LessonComposer({ value, onChange, onImporting }: { value: string; onChange: (value: string) => void; onImporting: (busy: boolean) => void }) {
  const [mode, setMode] = useState<'sections' | 'markdown'>('sections');
  const [blocks, setBlocks] = useState<ContentBlock[]>(() => markdownToBlocks(value));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [importing, setImporting] = useState(false);
  const update = (next: ContentBlock[]) => { setBlocks(next); onChange(blocksToMarkdown(next)); setNotice(''); };
  const importFile = async (file: File) => {
    setError(''); setNotice('');
    if (value.trim() && !confirm('Replace the current lesson text with this file?')) return;
    setImporting(true); onImporting(true);
    try {
      const text = await readContentFile(file); setBlocks(markdownToBlocks(text)); onChange(text);
      setNotice(`${file.name} loaded. Preview the lesson, then save to publish it.`);
    } catch (e) { setError((e as Error).message); } finally { setImporting(false); onImporting(false); }
  };
  return <div className="space-y-4">
    <div className="surface space-y-3 p-4"><label className="field">Upload lesson text<input type="file" accept=".md,.markdown,.txt" disabled={importing} className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-track file:px-4 file:py-3" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void importFile(file); }} /><span className="field-help">Markdown or plain text, up to 500,000 characters. PDFs, videos, and ZIPs go in Resources after saving.</span></label>{importing && <p role="status">Reading file…</p>}{error && <p role="alert" className="text-sm text-danger">{error}</p>}{notice && <p role="status" className="text-sm">{notice}</p>}</div>
    <div className="flex flex-wrap items-center gap-3"><button type="button" className="outline-btn" aria-pressed={mode === 'sections'} onClick={() => { setBlocks(markdownToBlocks(value)); setMode('sections'); }}>Write in sections</button><button type="button" className="btn-quiet" aria-pressed={mode === 'markdown'} onClick={() => setMode('markdown')}>Markdown editor</button></div>
    {mode === 'sections' ? <><p className="text-sm text-muted">Write normally. Add headings and sections with the buttons below; no code is needed.</p>
      {blocks.map((block, index) => <div key={index} className="surface space-y-3 p-4"><div className="flex items-center gap-3"><label className="field min-w-0 flex-1">Section heading (optional)<input className="input" maxLength={250} value={block.heading} placeholder={index === 0 ? 'Introduction' : 'Section heading'} onChange={e => update(blocks.map((b, i) => i === index ? { ...b, heading: e.target.value } : b))} /></label>{blocks.length > 1 && <button type="button" className="btn-quiet text-danger" aria-label={`Remove section ${index + 1}`} onClick={() => { if (!block.body.trim() || confirm('Remove this section and its text?')) update(blocks.filter((_, i) => i !== index)); }}>Remove</button>}</div><label className="field">Section content<textarea className="input min-h-40" maxLength={500000} value={block.body} placeholder="Explain the idea in your own words…" onChange={e => update(blocks.map((b, i) => i === index ? { ...b, body: e.target.value } : b))} /></label></div>)}
      <div className="flex flex-wrap gap-2">{['Explanation', 'Example', 'Practice', 'Self-review', 'Sources'].map(heading => <button type="button" key={heading} className="outline-btn" onClick={() => update([...blocks, { heading, body: '' }])}>+ {heading}</button>)}</div>
    </> : <label className="field">Markdown content<textarea className="input min-h-[420px] font-mono text-sm" value={value} maxLength={500000} onChange={e => onChange(e.target.value)} /></label>}
    <p className="text-xs text-muted">{value.length.toLocaleString()} / 500,000 characters. Add original source names and links in a Sources section.</p>
  </div>;
}
