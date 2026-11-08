import {
  defaultReaderPreferences,
  ReaderPreferences,
} from "../readerPreferences";

export default function ReaderSettings({
  value,
  onChange,
  saved,
}: {
  value: ReaderPreferences;
  onChange: (value: ReaderPreferences) => void;
  saved: boolean;
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
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(
            [
              ["day", "Day"],
              ["paper", "Paper"],
              ["night", "Night"],
            ] as const
          ).map(([theme, label]) => (
            <button
              key={theme}
              className="reader-option"
              aria-pressed={value.theme === theme}
              onClick={() => onChange({ ...value, theme })}
            >
              {label}
            </button>
          ))}
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
        {saved
          ? "Preferences are saved on this device. Your lesson progress stays separate."
          : "Preferences apply for this visit. This browser could not save them."}
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
