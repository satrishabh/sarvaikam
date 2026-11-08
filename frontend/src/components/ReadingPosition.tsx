import { useEffect, useState } from "react";

export default function ReadingPosition({ lessonId }: { lessonId: number }) {
  const [position, setPosition] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      const article = document.getElementById("lesson-body");
      if (!article) return;
      const rect = article.getBoundingClientRect();
      const distance = Math.max(1, rect.height - window.innerHeight * 0.6);
      setPosition(
        Math.max(
          0,
          Math.min(100, Math.round(((80 - rect.top) / distance) * 100)),
        ),
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [lessonId]);
  return (
    <div
      className="reader-position"
      role="progressbar"
      aria-label="Reading position"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={position}
      aria-valuetext={`${position}% through the article; not lesson completion`}
    >
      <span style={{ width: `${position}%` }} />
    </div>
  );
}
