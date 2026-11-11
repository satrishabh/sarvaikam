import type { CSSProperties } from "react";
import {
  defaultReaderPreferences,
  READER_THEMES,
  ReaderPreferences,
  themeAvailable,
} from "../readerPreferences";

export default function ReaderSettings({
  value,
  onChange,
  saved,
  signedIn,
  syncFailed,
}: {
  value: ReaderPreferences;
  onChange: (value: ReaderPreferences) => void;
  saved: boolean;
  signedIn: boolean;
  syncFailed: boolean;
}) {
  return (
    <div className="reader-settings space-y-7">
      <fieldset>
        <legend>Text size</legend>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[16, 18, 20, 22].map((size) => (
            <button
              key={size}
              className="reader-option"
              aria-label={`${size} pixel reading text`}
              aria-pressed={value.size === size}
              onClick={() => onChange({ ...value, size })}
            >
              {size}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Typeface</legend>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            className="reader-option"
            aria-pressed={value.font === "sans"}
            onClick={() => onChange({ ...value, font: "sans" })}
          >
            Modern
          </button>
          <button
            className="reader-option font-serif"
            aria-pressed={value.font === "serif"}
            onClick={() => onChange({ ...value, font: "serif" })}
          >
            Book
          </button>
        </div>
      </fieldset>
      <fieldset>
        <legend>Page appearance</legend>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {READER_THEMES.map((item) => {
            const available = themeAvailable(item.value, signedIn);
            return (
              <button
                key={item.value}
                className="reader-option theme-swatch"
                disabled={!available}
                aria-pressed={value.theme === item.value}
                aria-label={`${item.label} page${available ? "" : ", sign in to unlock"}`}
                style={
                  {
                    "--swatch-page": item.page,
                    "--swatch-ink": item.ink,
                  } as CSSProperties
                }
                onClick={() => onChange({ ...value, theme: item.value })}
              >
                <span className="theme-swatch-sample" aria-hidden="true">
                  Aa
                </span>
                <span className="theme-swatch-label">{item.label}</span>
                <span className="theme-swatch-note">
                  {available ? item.note : "Sign in to unlock"}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <fieldset>
        <legend>Line spacing</legend>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(["comfortable", "compact"] as const).map((spacing) => (
            <button
              key={spacing}
              className="reader-option capitalize"
              aria-pressed={value.spacing === spacing}
              onClick={() => onChange({ ...value, spacing })}
            >
              {spacing}
            </button>
          ))}
        </div>
      </fieldset>
      <p role="status" className="text-sm text-muted">
        {!saved
          ? "Preferences apply for this visit. This browser could not save them."
          : !signedIn
            ? "Saved on this device. Sign in to use the same settings on every device."
            : syncFailed
              ? "Saved on this device, but your account could not be updated. Change a setting to try again."
              : "Saved to your account, so they follow you to every device."}
      </p>
      <button
        className="outline-btn w-full"
        onClick={() => onChange({ ...defaultReaderPreferences })}
      >
        Reset reading preferences
      </button>
    </div>
  );
}
