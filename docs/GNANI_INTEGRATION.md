# Gnani.ai voice integration

## Honest status of this build

**Gnani.ai is NOT connected in this environment** — no API credentials were provided and
`api.vachana.ai` is not reachable from this machine. Nothing pretends otherwise:

- The Assistant page, the extension panel and `/api/voice/status` report
  **“Gnani.ai: not configured”** with a labelled **browser Web Speech fallback**.
- `/api/voice/stt` returns **503 `{configured:false}`** when the key is missing — callers
  fall back or surface the error; no fake transcripts exist anywhere.
- TTS falls back to `speechSynthesis` (labelled), or the response is shown as text only.

The integration itself is **real and complete**: the adapter implements Gnani's published
contract below, and connecting it takes one environment variable.

## The contract (from docs.gnani.ai — verified)

### Speech-to-Text (REST)

```
POST https://api.vachana.ai/stt/v3
Header:  X-API-Key-ID: <your key>
Multipart form:
  audio_file     — WAV/MP3/OGG/FLAC/AAC/M4A, 8–44.1 kHz, ≤ 30 s
  model          — prisma-v3.0 | prisma-v2.5
  language_code  — en-IN, hi-IN, kn-IN, … or indic-auto (v3)
Response 200: { "success": true, "request_id": "...", "transcript": "...",
               "model": "...", "detected_language_code": "...", "processing_time": 0.58 }
```

### Text-to-Speech (REST)

```
POST https://api.vachana.ai/api/v1/tts/inference
Header:  X-API-Key-ID: <your key>
JSON body:
  text, voice (e.g. Kaveri / Nalini / Deepak), model (timbre-v2.5 | timbre-v3.0),
  language (en-IN | hi-IN | hi-en | ta-IN | kn-IN | te-IN | ml-IN | mr-IN | bn-IN | gu-IN | pa-IN),
  speed (0.85–1.15),
  audio_config { sample_rate: 48000, num_channels: 1, sample_width: 2,
                 encoding: "linear_pcm", container: "wav" }
Response 200: binary audio/wav
```

## Where it lives in the code

| Piece | File |
|---|---|
| Server adapter (both endpoints, honest errors) | `apps/web/src/lib/voice/gnani.ts` |
| Status endpoint (drives all UI indicators) | `apps/web/src/app/api/voice/status/route.ts` |
| STT route (WAV up, transcript back; 503 when unconfigured) | `apps/web/src/app/api/voice/stt/route.ts` |
| TTS route (text in, WAV out; 503 when unconfigured) | `apps/web/src/app/api/voice/tts/route.ts` |
| Client recorder (PCM→WAV; browsers' WebM isn't accepted by Gnani) | `packages/core/src/wav.ts` |
| Assistant UI (states, fallback labelling) | `apps/web/src/app/(app)/assistant/page.tsx` |
| Extension voice (same routes via device token) | `apps/extension/src/panel/DPanel.tsx` |

The API key lives **only** on the server (`apps/web/.env`). Clients never see it.

## Setup checklist (all four, then voice is real)

- [ ] **1. Get an API key** — sign up at https://app.gnani.ai/voice/ → create an API key with
      **STT** and **TTS** scopes (per their error reference, missing scopes return
      `SCOPE_NOT_ALLOWED`).
- [ ] **2. Put it in the environment** — `apps/web/.env`:
      ```
      GNANI_API_KEY="your-real-key"
      ```
      (Optional: override model/voice/languages — see `apps/web/.env.example`.)
- [ ] **3. Restart the server** — `npm run dev` (env is read at boot).
- [ ] **4. Verify** —
      - `curl -s http://localhost:3000/api/voice/status` → `"voice":{"configured":true,...}`
      - Open **D Assistant**: the badge flips from *“Browser speech fallback — not Gnani”*
        to *“Gnani.ai connected”*.
      - Click the mic, say **“D, what is my full name?”** — the transcript comes from
        `prisma-v3.0` and responses are spoken with your configured Gnani voice.

## Multilingual

Gnani supports Indian-language STT (`indic-auto` detects automatically) and 10 TTS languages
plus Hinglish (`hi-en`). The language is selectable through `GNANI_DEFAULT_LANGUAGE` /
`GNANI_LANGUAGES`, and the STT route accepts a `language` form field per request.
**Current honest limitation:** the *intent parser* understands English commands — Indic
transcripts flow through, but command understanding is English-first (see
docs/LIMITATIONS.md). Falling back to browser speech: language is pinned to `en-IN`.

## What the fallback is (and is not)

The browser Web Speech fallback (used when Gnani isn't configured) is:

- clearly labelled everywhere (“not Gnani.ai”),
- click-to-start only, like the real integration,
- good enough to demo intent handling with typed commands even with no voice at all.

It is **not** equivalent: accuracy, Indic coverage, and noise handling are all far below
Gnani's models. For any real deployment, configure the key.
