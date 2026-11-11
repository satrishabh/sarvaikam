export interface ReaderPreferences {
  size: number;
  font: "sans" | "serif";
  theme: "day" | "night";
  spacing: "comfortable" | "compact";
}
const KEY = "sarvaikam.reader.v1";
export const defaultReaderPreferences: ReaderPreferences = {
  size: 18,
  font: "sans",
  theme: "day",
  spacing: "comfortable",
};
// Returns settings only when every field is a known value, so stored or account data can never break the reader.
export function normalizeReaderPreferences(raw: unknown): ReaderPreferences | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<Record<keyof ReaderPreferences, unknown>>;
  const valid =
    [16, 18, 20, 22].includes(value.size as number) &&
    ["sans", "serif"].includes(value.font as string) &&
    ["day", "night"].includes(value.theme as string) &&
    ["comfortable", "compact"].includes(value.spacing as string);
  return valid ? (value as ReaderPreferences) : null;
}
export function readReaderPreferences(): ReaderPreferences {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return normalizeReaderPreferences(raw) ?? { ...defaultReaderPreferences };
  } catch {
    return { ...defaultReaderPreferences };
  }
}
export function saveReaderPreferences(value: ReaderPreferences) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
