import { useEffect, useState } from "react";

/**
 * Returns true while the page is scrolling and for a short time after it stops.
 * Scroll events from nested containers (such as the reels feed) are included.
 */
export default function useScrollHidden(idleMs = 900) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let timer: number | undefined;
    const onScroll = () => {
      setHidden(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setHidden(false), idleMs);
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.clearTimeout(timer);
    };
  }, [idleMs]);
  return hidden;
}
