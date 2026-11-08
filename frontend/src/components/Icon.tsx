import { CSSProperties } from "react";

const paths: Record<string, string[]> = {
  arrow: ["M5 12h14", "m13 6 6 6-6 6"],
  chevron: ["m9 5 7 7-7 7"],
  check: ["m5 12 4 4L19 6"],
  book: [
    "M12 6v15",
    "M3 3h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5v16h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3z",
  ],
  code: ["m8 6-6 6 6 6", "m16 6 6 6-6 6", "m14 3-4 18"],
  layers: ["m12 3 10 5-10 5L2 8z", "m2 12 10 5 10-5", "m2 16 10 5 10-5"],
  cloud: ["M6 18a4 4 0 1 1 0-8 6 6 0 0 1 11-3 5.5 5.5 0 0 1 1 11z"],
  target: [
    "M12 8a4 4 0 1 0 4 4",
    "M12 3a9 9 0 1 0 9 9",
    "m12 12 9-9",
    "M16 3h5v5",
  ],
  clock: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18", "M12 7v5l3 2"],
  search: ["M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15", "m16 16 5 5"],
  chart: ["M4 3v18h17", "M8 16v-5", "M13 16V7", "M18 16V4"],
  menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
  close: ["m6 6 12 12", "M18 6 6 18"],
  play: ["m8 4 12 8-12 8z"],
  spark: ["m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"],
  user: ["M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8", "M4 21v-2a8 8 0 0 1 16 0v2"],
};

export default function Icon({
  name,
  className = "h-5 w-5",
  style,
}: {
  name: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {(paths[name] ?? paths.book).map((path, i) => (
        <path key={i} d={path} />
      ))}
    </svg>
  );
}
