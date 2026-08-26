"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { keyHeaders } from "@/lib/apiKeys";

// Recording stops itself here so a mic left open can't run up an 8 MB upload.
const MAX_RECORDING_MS = 2 * 60 * 1000;

// Chrome and Firefox record webm/opus; Safari only offers mp4. Both are containers Whisper reads.
const PREFERRED_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
] as const;

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return PREFERRED_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
}

// ---------------------------------------------------------------------------
// Web Speech API — used ONLY to paint rough words while you talk. Groq Whisper
// still produces the authoritative transcript on stop. It isn't in the standard
// DOM lib, hence the minimal typings.
// ---------------------------------------------------------------------------
interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognition;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Number of bars in the level meter.
const BAR_COUNT = 4;

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

type Status = "idle" | "recording" | "transcribing";

type Props = {
  /** Current draft; the transcript is appended to it. */
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
};

/**
 * A mic button that dictates into the prompt input, with live feedback while you talk.
 *
 * Two things run at once during a recording: MediaRecorder captures the audio that is sent to
 * /api/transcribe (Groq Whisper) on stop, and the browser's Web Speech API paints rough words
 * into the draft as you speak. The Groq transcript replaces that preview when it lands — the
 * preview exists to prove you're being heard, not to be the final text.
 *
 * Where Web Speech is missing (Firefox), the level meter still animates, so the recording state
 * is always visibly live. If Groq fails, whatever the preview captured is kept rather than lost.
 */
export function MicButton({ value, onChange, disabled }: Props) {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // start() awaits getUserMedia before `status` flips to "recording", so the button stays
  // clickable in between. `starting` latches synchronously so a second click can't open a
  // second stream; `mounted` covers this component going away while the prompt is still up.
  const startingRef = useRef(false);
  const mountedRef = useRef(true);

  // Level meter plumbing. Bars are mutated directly rather than through state: this runs on
  // every animation frame, and re-rendering at 60fps to move four divs would be wasteful.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);

  // The draft as it stood before this dictation started, plus the newest preview text. The
  // final transcript is applied as base + transcript, which is what overwrites the preview.
  const baseRef = useRef("");
  const previewRef = useRef("");
  // Keeps the latest draft available to handlers that outlive this render.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  });

  // Releases the mic so the browser drops its "recording" indicator, and stops every loop.
  const teardown = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    timeoutRef.current = null;
    tickRef.current = null;
    rafRef.current = null;

    // abort() rather than stop(): we want no further results once recording has ended.
    recognitionRef.current?.abort();
    recognitionRef.current = null;

    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => {
    // Must run on the client: MediaRecorder is browser-only, and rendering a different button
    // during SSR would cause a hydration mismatch. mediaDevices is also absent on insecure
    // origins, which is the other case where dictation simply can't work.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        pickMimeType() !== undefined,
    );
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      teardown();
    };
  }, [teardown]);

  // Drives the bars from the live mic signal, so silence looks different from speech.
  function startMeter(stream: MediaStream) {
    let ctx: AudioContext;
    try {
      ctx = new AudioContext();
    } catch {
      return; // No Web Audio — the pulsing dot still conveys "recording".
    }
    audioCtxRef.current = ctx;
    void ctx.resume().catch(() => {});

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.7;
    ctx.createMediaStreamSource(stream).connect(analyser);

    const bins = new Uint8Array(analyser.frequencyBinCount);
    // Ignore the very top of the spectrum: it's mostly noise and stays flat during speech.
    const band = Math.floor((bins.length * 0.7) / BAR_COUNT);

    const draw = () => {
      analyser.getByteFrequencyData(bins);
      for (let i = 0; i < BAR_COUNT; i++) {
        let sum = 0;
        for (let j = i * band; j < (i + 1) * band; j++) sum += bins[j];
        const level = sum / band / 255; // 0..1
        const bar = barsRef.current[i];
        // 3px floor so the meter reads as "live and quiet", not "dead".
        if (bar) bar.style.height = `${3 + Math.min(1, level * 2.2) * 13}px`;
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
  }

  // Best-effort live words. Any failure here is silent: the recording is unaffected, and the
  // user still gets the meter plus the accurate transcript at the end.
  function startPreview() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    let recognition: SpeechRecognition;
    try {
      recognition = new Ctor();
      recognition.lang = "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;
    } catch {
      return;
    }

    let committed = "";
    recognition.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) committed += chunk;
        else interim += chunk;
      }
      previewRef.current = (committed + interim).trim();
      const base = baseRef.current;
      onChange(base ? `${base} ${previewRef.current}` : previewRef.current);
    };
    // Preview-only: a failure costs nothing, so don't surface it or touch recording state.
    recognition.onerror = () => {};
    recognition.onend = () => {};

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      // Chrome throws if a recognition session is somehow already running.
    }
  }

  async function transcribe(blob: Blob) {
    setStatus("transcribing");
    const base = baseRef.current;
    const preview = previewRef.current;

    // Leaves the preview text in place while this runs, so the draft never blanks out.
    try {
      const body = new FormData();
      body.set("audio", blob);
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: keyHeaders(),
        body,
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // Keep the preview if we have one — rough words beat losing the take entirely.
        setError(
          preview
            ? "Couldn't refine that — keeping the rough transcript."
            : (data?.error ?? "Transcription failed."),
        );
        return;
      }

      const text = String(data?.text ?? "").trim();
      if (!text) {
        if (!preview) setError("Didn't catch that. Try again.");
        return;
      }

      // The authoritative result: overwrites the preview rather than appending to it.
      onChange(base ? `${base} ${text}` : text);
    } catch {
      setError(
        preview
          ? "Couldn't refine that — keeping the rough transcript."
          : "Transcription failed. Check your connection.",
      );
    } finally {
      previewRef.current = "";
      setStatus("idle");
    }
  }

  function stop() {
    // teardown() runs in onstop, once the final chunk has been flushed.
    recorderRef.current?.stop();
  }

  async function start() {
    // Until getUserMedia resolves, `status` is still "idle" — so the button is enabled and its
    // handler is still `start`. Without this latch a second click starts a second recording and
    // overwrites streamRef, leaving the first stream live with nothing able to stop it: the mic
    // and the browser's recording indicator stay on until the tab closes.
    if (startingRef.current || recorderRef.current) return;
    startingRef.current = true;
    setError(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Denied permission, or no input device.
      startingRef.current = false;
      setError("Microphone unavailable. Check your browser permissions.");
      return;
    }

    // Unmounted while the permission prompt was open — teardown() has already run and never
    // saw this stream, so release it here rather than orphaning it.
    if (!mountedRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      startingRef.current = false;
      return;
    }

    streamRef.current = stream;
    // MediaRecorder construction and start() both throw on some device/codec combinations.
    // Catch it here: teardown releases the stream we just took (the old code leaked it), and
    // the finally clears the latch so a throw can't leave the button permanently dead.
    try {
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        teardown();
        if (chunks.length === 0) {
          previewRef.current = "";
          setStatus("idle");
          return;
        }
        void transcribe(new Blob(chunks, { type: recorder.mimeType }));
      };
      recorder.onerror = () => {
        teardown();
        previewRef.current = "";
        setStatus("idle");
        setError("Recording failed. Please try again.");
      };

      // Anchor the dictation to the draft as it stands now, so both the preview and the final
      // transcript extend it instead of clobbering it.
      baseRef.current = valueRef.current.trimEnd();
      previewRef.current = "";

      recorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
      setElapsed(0);

      startMeter(stream);
      startPreview();

      const startedAt = performance.now();
      tickRef.current = setInterval(
        () => setElapsed(performance.now() - startedAt),
        500,
      );
      timeoutRef.current = setTimeout(stop, MAX_RECORDING_MS);
    } catch {
      teardown();
      previewRef.current = "";
      setStatus("idle");
      setError("Recording failed. Please try again.");
    } finally {
      startingRef.current = false;
    }
  }

  if (!supported) return null;

  const busy = status === "transcribing";
  const recording = status === "recording";
  const label = recording
    ? "Stop dictation"
    : busy
      ? "Transcribing…"
      : "Dictate prompt";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={recording ? stop : start}
        disabled={disabled || busy}
        aria-label={label}
        aria-pressed={recording}
        title={label}
        className={`flex size-8 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:size-11 ${
          recording
            ? "bg-ember/15 text-ember"
            : "text-ink-3 hover:bg-raised hover:text-ink"
        }`}
      >
        {recording ? (
          <span className="size-2.5 animate-pulse rounded-full bg-ember" />
        ) : busy ? (
          <span className="size-3.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
            aria-hidden="true"
          >
            <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
            <path d="M12 18v4" />
          </svg>
        )}
      </button>

      {recording ? (
        <span className="flex items-center gap-2">
          {/* Live level meter: moves with your voice, so silence is visibly different from
              speech even where Web Speech can't supply words. */}
          <span
            className="flex h-4 items-center gap-[2px]"
            aria-hidden="true"
            title="Microphone level"
          >
            {Array.from({ length: BAR_COUNT }, (_, i) => (
              <span
                key={i}
                ref={(el) => {
                  barsRef.current[i] = el;
                }}
                className="w-[3px] rounded-full bg-ember transition-[height] duration-75"
                style={{ height: "3px" }}
              />
            ))}
          </span>
          <span role="status" className="text-xs tabular-nums text-ink-3">
            {formatElapsed(elapsed)} · click to stop
          </span>
        </span>
      ) : busy ? (
        <span role="status" className="text-xs text-ink-3">
          Transcribing…
        </span>
      ) : error ? (
        <span role="status" className="text-xs text-ember">
          {error}
        </span>
      ) : null}
    </div>
  );
}
