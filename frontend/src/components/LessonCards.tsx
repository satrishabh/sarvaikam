import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type TransitionEvent as ReactTransitionEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { LessonCard } from "../readingOutline";
import Icon from "./Icon";

type Axis = "x" | "y";
type Drag = {
  id: number;
  axis: Axis | null;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  offset: number;
  samples: { offset: number; time: number }[];
};
type Settling = { axis: Axis; direction: 1 | -1 | 0; committed: number | null };

const SETTLE = "transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1)";
const EXIT = "transform 240ms ease-out";

/**
 * Swipe right or up for the next card; left or down for the previous one.
 * The card follows the finger 1:1, can be caught mid-motion, and flicks carry it past the threshold.
 */
export default function LessonCards({
  cards,
  title,
  onClose,
}: {
  cards: LessonCard[];
  title: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const card = cards[index];
  const last = cards.length - 1;
  const cardRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<Drag | null>(null);
  const settling = useRef<Settling | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [index]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" || event.key === "ArrowUp") go(1);
      if (event.key === "ArrowLeft" || event.key === "ArrowDown") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, last]);

  const place = (value: number, axis: Axis, transition: string) => {
    const element = cardRef.current;
    if (!element) return;
    element.style.transition = transition;
    element.style.transform = axis === "x" ? `translate3d(${value}px, 0, 0)` : `translate3d(0, ${value}px, 0)`;
  };

  // Offsets are measured so that a positive x or a negative y means "advance".
  const advanceDirection = (axis: Axis): 1 | -1 => (axis === "x" ? 1 : -1);

  const go = (step: 1 | -1) => setIndex((current) => Math.min(last, Math.max(0, current + step)));

  const settle = (axis: Axis, direction: 1 | -1 | 0, committed: number | null) => {
    const element = cardRef.current;
    const size = axis === "x" ? element?.offsetWidth ?? 0 : element?.offsetHeight ?? 0;
    settling.current = { axis, direction, committed };
    place(direction === 0 ? 0 : direction * size * 1.1, axis, direction === 0 ? SETTLE : EXIT);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const element = cardRef.current;
    let offset = 0;
    let axis: Axis | null = null;
    if (settling.current && element) {
      // Catch the card where it is on screen, so a reversal starts from its live position.
      const matrix = new DOMMatrix(getComputedStyle(element).transform);
      axis = settling.current.axis;
      offset = axis === "x" ? matrix.m41 : matrix.m42;
      element.style.transition = "none";
      element.style.transform = axis === "x" ? `translate3d(${offset}px, 0, 0)` : `translate3d(0, ${offset}px, 0)`;
      settling.current = null;
    }
    element?.setPointerCapture(event.pointerId);
    drag.current = {
      id: event.pointerId,
      axis,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      offset,
      samples: [{ offset, time: event.timeStamp }],
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    if (current.axis === null) {
      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      current.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      current.lastX = event.clientX;
      current.lastY = event.clientY;
      return;
    }
    const axis = current.axis;
    const step = axis === "x" ? event.clientX - current.lastX : event.clientY - current.lastY;
    current.lastX = event.clientX;
    current.lastY = event.clientY;

    // A long card scrolls first while its text can still move in the direction of the finger.
    const body = bodyRef.current;
    if (axis === "y" && current.offset === 0 && body && body.scrollHeight > body.clientHeight) {
      const canScroll = step < 0 ? body.scrollTop + body.clientHeight < body.scrollHeight - 1 : body.scrollTop > 0;
      if (canScroll) {
        body.scrollTop -= step;
        return;
      }
    }

    const advancing = Math.sign(step) === advanceDirection(axis);
    const atEdge = advancing ? index === last : index === 0;
    current.offset += step * (atEdge ? 0.35 : 1); // resist past the first and last cards
    current.samples.push({ offset: current.offset, time: event.timeStamp });
    if (current.samples.length > 6) current.samples.shift();
    place(current.offset, axis, "none");
  };

  const finish = (event: ReactPointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    drag.current = null;
    cardRef.current?.releasePointerCapture(event.pointerId);
    if (current.axis === null) return;

    const axis = current.axis;
    const element = cardRef.current;
    const size = (axis === "x" ? element?.offsetWidth : element?.offsetHeight) || 1;
    const recent = current.samples.filter((sample) => event.timeStamp - sample.time < 120);
    const first = recent[0] ?? current.samples[0];
    const velocity = (current.offset - first.offset) / Math.max(1, event.timeStamp - first.time); // px per ms
    // Project where a flick would carry the card, then decide from that point rather than the release point.
    const projected = current.offset + velocity * 180;
    const forward = advanceDirection(axis);
    const pastThreshold = Math.abs(projected) > size * 0.25;
    if (pastThreshold && Math.sign(projected) === forward && index < last) {
      settle(axis, forward, index + 1);
    } else if (pastThreshold && Math.sign(projected) === -forward && index > 0) {
      settle(axis, -forward as 1 | -1, index - 1);
    } else {
      settle(axis, 0, null);
    }
  };

  const onTransitionEnd = (event: ReactTransitionEvent<HTMLElement>) => {
    if (event.propertyName !== "transform" || !settling.current) return;
    const { axis, direction, committed } = settling.current;
    settling.current = null;
    place(0, axis, "none");
    if (direction !== 0 && committed !== null) setIndex(committed);
  };

  const sectionLabel = card.id === "lesson-body" ? "Start here" : `Section ${cards.slice(0, index + 1).filter((item) => item.id !== "lesson-body").length}`;

  return (
    <div className="lesson-deck" role="dialog" aria-modal="true" aria-label={`${title}: swipe cards`} >
      <div className="lesson-deck-top">
        <p className="min-w-0 truncate text-sm font-medium text-muted">{title}</p>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm tabular-nums text-muted" aria-live="polite">
            {index + 1} / {cards.length}
          </span>
          <button ref={closeRef} className="sheet-close" onClick={onClose} aria-label="Close cards">
            <Icon name="close" />
          </button>
        </div>
      </div>
      <div className="lesson-deck-stage">
        <article
          ref={cardRef}
          key={card.id}
          className="lesson-card"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finish}
          onPointerCancel={finish}
          onTransitionEnd={onTransitionEnd}
        >
          <div ref={bodyRef} className="lesson-card-body">
            <p className="eyebrow">{sectionLabel}</p>
            <h2 className="mt-3 text-[clamp(1.6rem,4vw,2.25rem)] font-semibold leading-[1.15]">{card.title}</h2>
            <div className="reader-copy prose mt-6 max-w-none leading-[1.75]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.markdown}</ReactMarkdown>
            </div>
          </div>
        </article>
      </div>
      <div className="lesson-deck-bottom">
        <div className="lesson-deck-dots" aria-hidden="true">
          {cards.map((item, dot) => (
            <span key={item.id} className={dot === index ? "is-active" : undefined} />
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <button className="btn-quiet px-3 text-sm" onClick={() => go(-1)} disabled={index === 0}>
            Back
          </button>
          <p className="text-xs text-muted">Swipe right or up to continue</p>
          {index < last ? (
            <button className="btn px-5 text-sm" onClick={() => go(1)}>
              Next
            </button>
          ) : (
            <button className="btn px-5 text-sm" onClick={onClose}>
              Back to lesson
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
