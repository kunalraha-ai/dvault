/**
 * Minimal PCM WAV encoder + microphone recorder helpers.
 *
 * Gnani.ai STT accepts WAV/MP3/OGG/FLAC/AAC/M4A — browsers' MediaRecorder
 * produces WebM/Opus, which is NOT accepted. So D-Vault records raw PCM via
 * the AudioWorklet API and encodes WAV client-side before upload.
 */

export interface WavEncodeOptions {
  numChannels?: number;
  sampleRate: number; // e.g. 16000
}

/** Encode Float32 PCM frames (interleaved or mono) into a WAV Blob. */
export function encodeWav(
  frames: Float32Array[],
  opts: WavEncodeOptions,
): Blob {
  const numChannels = opts.numChannels ?? 1;
  const sampleRate = opts.sampleRate;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;

  let totalSamples = 0;
  for (const f of frames) totalSamples += f.length;
  const totalFrames = Math.floor(totalSamples / numChannels);

  const dataSize = totalFrames * numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // byte rate
  view.setUint16(32, numChannels * bytesPerSample, true); // block align
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (const frame of frames) {
    for (let i = 0; i < frame.length; i++) {
      const s = Math.max(-1, Math.min(1, frame[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Record mono PCM from the microphone. Must be started by an explicit
 * user gesture (D-Vault never records without activation).
 *
 * Uses ScriptProcessorNode instead of AudioWorklet because AudioWorklet
 * blob-URL module loading fails in Chrome extension content scripts
 * (isolated world). ScriptProcessorNode is deprecated but 100% reliable
 * in every context including content scripts.
 */
export class PcmRecorder {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private chunks: Float32Array[] = [];
  private sampleRate = 16000;

  async start(): Promise<void> {
    // 1. Get mic stream (this is the permission-gated step)
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    // 2. Create AudioContext (may fall back to native sample rate)
    this.ctx = new AudioContext({ sampleRate: this.sampleRate });
    this.sampleRate = this.ctx.sampleRate;
    const src = this.ctx.createMediaStreamSource(this.stream);

    // 3. ScriptProcessorNode — no module loading needed, works in content scripts
    //    bufferSize=4096 gives ~256ms at 16kHz — fine for voice
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e: AudioProcessingEvent) => {
      const input = e.inputBuffer.getChannelData(0);
      // copy the data (ScriptProcessor reuses the buffer)
      this.chunks.push(new Float32Array(input));
    };
    src.connect(this.processor);

    // ScriptProcessorNode needs a destination connection to fire events.
    // Route through a silent gain node so no audio is played back.
    const sink = this.ctx.createGain();
    sink.gain.value = 0;
    this.processor.connect(sink);
    sink.connect(this.ctx.destination);
  }

  async stop(): Promise<Blob | null> {
    if (!this.ctx) return null;
    const blob = encodeWav(this.chunks, { sampleRate: this.sampleRate, numChannels: 1 });
    this.cleanup();
    return blob;
  }

  get recording(): boolean {
    return this.ctx !== null;
  }

  private cleanup() {
    try { this.processor?.disconnect(); } catch { /* noop */ }
    this.processor = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.chunks = [];
  }

  abort() {
    this.cleanup();
  }
}
