"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeAssistantSettings, type AssistantSettings, ASSISTANT_SETTINGS_DEFAULTS } from "@dvault/core";

/** Loads + persists the assistant's language / voice / sensitive-speech settings. */
export function useAssistantSettings() {
  const [settings, setSettings] = useState<AssistantSettings>({ ...ASSISTANT_SETTINGS_DEFAULTS });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { settings?: Partial<AssistantSettings> }) => {
        if (cancelled) return;
        setSettings(normalizeAssistantSettings(d.settings));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (next: Partial<AssistantSettings>) => {
    const merged = normalizeAssistantSettings({ ...settings, ...next });
    setSettings(merged);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        "assistant.language": merged.language,
        "assistant.voice": merged.voice,
        "assistant.speakSensitive": merged.speakSensitive,
      }),
    }).catch(() => null);
    return res?.ok ?? false;
  }, [settings]);

  return { settings, save, loaded };
}
