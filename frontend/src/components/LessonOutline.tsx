import type { OutlineItem } from "../readingOutline";

export default function LessonOutline({ items }: { items: OutlineItem[] }) {
  if (items.length < 2) return null;
  return (
    <nav aria-label="On this page" className="mt-7">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
        On this page
      </p>
      <ul className="mt-3 space-y-1 text-xs">
        {items.map((item) => (
          <li key={item.id} className={item.level === 3 ? "pl-3" : undefined}>
            <a
              href={`#${item.id}`}
              className="flex min-h-11 items-start rounded-lg p-2.5 text-muted hover:bg-track"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
