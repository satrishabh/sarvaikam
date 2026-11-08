export interface ReaderPreferences {
  size: number;
  font: "sans" | "serif";
  theme: "day" | "paper" | "night";
  spacing: "comfortable" | "compact";
}
const KEY = "sarvaikam.reader.v1";
export const defaultReaderPreferences: ReaderPreferences = {
  size: 18,
  font: "sans",
  theme: "day",
  spacing: "comfortable",
};
export function readReaderPreferences(): ReaderPreferences {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return {
      size: [16, 18, 20, 22].includes(raw.size) ? raw.size : 18,
      font: raw.font === "serif" ? "serif" : "sans",
      theme: ["day", "paper", "night"].includes(raw.theme) ? raw.theme : "day",
      spacing: raw.spacing === "compact" ? "compact" : "comfortable",
    };
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
