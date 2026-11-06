/**
 * Assistant language + voice (accent) options — shared by the web app and
 * the Chrome extension. Language codes match Gnani.ai's STT/TTS coverage;
 * voices are from the Gnani timbre catalog (v2.5 / v3.0).
 */

export interface LanguageOption {
  code: string;
  label: string;
  /** BCP-47 for the browser Web-Speech fallback */
  fallback: string;
}

export const ASSISTANT_LANGUAGES: LanguageOption[] = [
  { code: "en-IN", label: "English (India)", fallback: "en-IN" },
  { code: "hi-IN", label: "हिन्दी — Hindi", fallback: "hi-IN" },
  { code: "hi-en", label: "Hinglish (हिंदी + English)", fallback: "hi-IN" },
  { code: "ta-IN", label: "தமிழ் — Tamil", fallback: "ta-IN" },
  { code: "te-IN", label: "తెలుగు — Telugu", fallback: "te-IN" },
  { code: "kn-IN", label: "ಕನ್ನಡ — Kannada", fallback: "kn-IN" },
  { code: "ml-IN", label: "മലയാളം — Malayalam", fallback: "ml-IN" },
  { code: "mr-IN", label: "मराठी — Marathi", fallback: "mr-IN" },
  { code: "bn-IN", label: "বাংলা — Bengali", fallback: "bn-IN" },
  { code: "gu-IN", label: "ગુજરાતી — Gujarati", fallback: "gu-IN" },
  { code: "pa-IN", label: "ਪੰਜਾਬੀ — Punjabi", fallback: "pa-IN" },
  { code: "indic-auto", label: "Auto-detect (Indic)", fallback: "en-IN" },
];

export interface VoiceOption {
  id: string;
  label: string;
  /** Gnani TTS model this voice belongs to */
  model: "timbre-v2.5" | "timbre-v3.0";
}

export const ASSISTANT_VOICES: VoiceOption[] = [
  { id: "Kaveri", label: "Kaveri · Indian English", model: "timbre-v2.5" },
  { id: "Nalini", label: "Nalini · Hindi", model: "timbre-v2.5" },
  { id: "Deepak", label: "Deepak · Hindi", model: "timbre-v2.5" },
  { id: "Poorvi", label: "Poorvi · Hinglish", model: "timbre-v2.5" },
  { id: "Shivani", label: "Shivani · multilingual", model: "timbre-v3.0" },
  { id: "Avinash", label: "Avinash · multilingual", model: "timbre-v3.0" },
  { id: "Lakshmi", label: "Lakshmi · multilingual", model: "timbre-v3.0" },
];

export const ASSISTANT_SETTINGS_DEFAULTS = {
  language: "en-IN",
  voice: "Kaveri",
  /** When false (default), sensitive values like Aadhaar are shown masked and
   *  NEVER spoken aloud. The user can opt in explicitly. */
  speakSensitive: false,
} as const;

export type AssistantSettings = {
  language: string;
  voice: string;
  speakSensitive: boolean;
};

export function normalizeAssistantSettings(raw: Partial<AssistantSettings> | null | undefined): AssistantSettings {
  const lang = raw?.language && ASSISTANT_LANGUAGES.some((l) => l.code === raw.language)
    ? raw.language
    : ASSISTANT_SETTINGS_DEFAULTS.language;
  const voice = raw?.voice && ASSISTANT_VOICES.some((v) => v.id === raw.voice)
    ? raw.voice
    : ASSISTANT_SETTINGS_DEFAULTS.voice;
  return {
    language: lang,
    voice,
    speakSensitive: raw?.speakSensitive === true,
  };
}

/** BCP-47 code for the browser Web-Speech fallback. */
export function fallbackLocale(language: string): string {
  return ASSISTANT_LANGUAGES.find((l) => l.code === language)?.fallback ?? "en-IN";
}

/** Gnani TTS model for a given voice (catalog-specific). */
export function ttsModelForVoice(voice: string): "timbre-v2.5" | "timbre-v3.0" {
  return ASSISTANT_VOICES.find((v) => v.id === voice)?.model ?? "timbre-v2.5";
}
