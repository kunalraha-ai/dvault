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
 * Record mono 16 kHz PCM from the microphone. Must be started by an explicit
 * user gesture (D-Vault never records without activation).
 */
export class PcmRecorder {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private worklet: AudioWorkletNode | null = null;
  private chunks: Float32Array[] = [];
  private sampleRate = 16000;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    this.ctx = new AudioContext({ sampleRate: this.sampleRate });
    // Safari fallback to 48k if the browser ignores the requested rate
    this.sampleRate = this.ctx.sampleRate;
    const src = this.ctx.createMediaStreamSource(this.stream);

    const workletCode = `
      class RecProcessor extends AudioWorkletProcessor {
        constructor() { super(); this._frames = []; }
        process(inputs) {
          const input = inputs[0];
          if (input && input[0]) {
            this.port.postMessage(input[0].slice(0));
          }
          return true;
        }
      }
      registerProcessor('rec-processor', RecProcessor);
    `;
    const url = URL.createObjectURL(new Blob([workletCode], { type: "text/javascript" }));
    try {
      await this.ctx.audioWorklet.addModule(url);
      this.worklet = new AudioWorkletNode(this.ctx, "rec-processor");
      this.worklet.port.onmessage = (e: MessageEvent) => {
        this.chunks.push(new Float32Array(e.data as Float32Array));
      };
      src.connect(this.worklet);
      // Worklet without a destination connection may be suspended in some browsers
      const sink = this.ctx.createGain();
      sink.gain.value = 0;
      this.worklet.connect(sink).connect(this.ctx.destination);
    } finally {
      URL.revokeObjectURL(url);
    }
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
    try { this.worklet?.disconnect(); } catch { /* noop */ }
    this.worklet = null;
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
