export type ReaderTheme = "device" | "day" | "paper" | "slate" | "night";

export interface ReaderPreferences {
  size: number;
  font: "sans" | "serif";
  theme: ReaderTheme;
  spacing: "comfortable" | "compact";
}

// Page themes. "signedInOnly" themes appear only after sign-in; anonymous readers keep White and Dark.
export const READER_THEMES: {
  value: ReaderTheme;
  label: string;
  note: string;
  page: string;
  ink: string;
  signedInOnly: boolean;
}[] = [
  { value: "device", label: "Device", note: "Follows your device's light or dark setting", page: "var(--reader-day-page)", ink: "var(--reader-day-text)", signedInOnly: false },
  { value: "day", label: "White", note: "The original page", page: "var(--reader-day-page)", ink: "var(--reader-day-text)", signedInOnly: false },
  { value: "night", label: "Dark", note: "Easy on the eyes at night", page: "var(--reader-night-page)", ink: "var(--reader-night-text)", signedInOnly: false },
  { value: "paper", label: "Warm", note: "Cream paper for long reads", page: "var(--reader-paper-page)", ink: "var(--reader-paper-text)", signedInOnly: true },
  { value: "slate", label: "Slate", note: "Cool grey with a blue accent", page: "var(--reader-slate-page)", ink: "var(--reader-slate-text)", signedInOnly: true },
];

export function themeAvailable(theme: ReaderTheme, signedIn: boolean): boolean {
  const entry = READER_THEMES.find((item) => item.value === theme);
  return !!entry && (signedIn || !entry.signedInOnly);
}

// The theme the page should show: a signed-in theme falls back to White for signed-out readers,
// and Device becomes White or Dark depending on the device's light or dark setting.
export function effectiveTheme(theme: ReaderTheme, signedIn: boolean, prefersDark = false): ReaderTheme {
  if (theme === "device") return prefersDark ? "night" : "day";
  return themeAvailable(theme, signedIn) ? theme : "day";
}

export function devicePrefersDark(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
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
    READER_THEMES.some((item) => item.value === value.theme) &&
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
