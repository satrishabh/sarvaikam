import { useEffect, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import {
  effectiveTheme,
  readReaderPreferences,
  saveReaderPreferences,
  type ReaderPreferences,
} from "./readerPreferences";

// Shared by the lesson reader and the Settings page, so both show and save the same preferences.
export default function useReaderPreferences() {
  const { user, applyUser } = useAuth();
  const [preferences, setPreferences] = useState<ReaderPreferences>(readReaderPreferences);
  const [saved, setSaved] = useState(true);
  const [syncFailed, setSyncFailed] = useState(false);

  useEffect(() => {
    setSaved(saveReaderPreferences(preferences));
  }, [preferences]);

  useEffect(() => {
    setSyncFailed(false);
    if (!user) return;
    if (user.readerPreferences) {
      // The account's saved settings win on sign-in, so they follow the reader across devices.
      setPreferences(user.readerPreferences);
      return;
    }
    // First time this account has settings: keep this device's settings as the account's settings.
    api
      .updateReaderPreferences(readReaderPreferences())
      .then(applyUser)
      .catch(() => setSyncFailed(true));
  }, [user?.id]); // Runs when the signed-in account changes, not on every settings change.

  // A signed-in-only theme falls back to White for signed-out readers, on every page that uses this hook.
  const theme = effectiveTheme(preferences.theme, !!user);

  useEffect(() => {
    const previous = document.documentElement.getAttribute("data-reader-theme");
    document.documentElement.setAttribute("data-reader-theme", theme);
    return () => {
      if (previous === null) document.documentElement.removeAttribute("data-reader-theme");
      else document.documentElement.setAttribute("data-reader-theme", previous);
    };
  }, [theme]);

  const change = (next: ReaderPreferences) => {
    setPreferences(next);
    setSyncFailed(false);
    if (!user) return;
    api
      .updateReaderPreferences(next)
      .then(applyUser)
      .catch(() => setSyncFailed(true));
  };

  return { preferences, theme, saved, syncFailed, change };
}
