"use client";

import { useEffect, useRef, useState } from "react";

// Minimal typings for the Web Speech API — it isn't in the standard DOM lib.
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
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}
interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
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

type Props = {
  /** Current draft; dictation is appended to it. */
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
};

/**
 * A mic button that dictates into the prompt input using the browser's built-in
 * speech recognition (no API key, no server round-trip). Renders nothing when the
 * browser doesn't support it (e.g. Firefox), so the input degrades gracefully.
 */
export function MicButton({ value, onChange, disabled }: Props) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // Text captured before this dictation session + all finalized chunks so far.
  const baseRef = useRef("");
  const committedRef = useRef("");
  // Keep the latest draft available to the (long-lived) start handler.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  });

  useEffect(() => {
    // Must run on the client: the API is browser-only, and rendering the button
    // during SSR (where it's absent) would cause a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(getRecognitionCtor() !== null);
    return () => recognitionRef.current?.stop();
  }, []);

  function stop() {
    recognitionRef.current?.stop();
  }

  function start() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    baseRef.current = valueRef.current ? valueRef.current + " " : "";
    committedRef.current = "";

    recognition.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) committedRef.current += chunk;
        else interim += chunk;
      }
      onChange(baseRef.current + committedRef.current + interim);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      disabled={disabled}
      aria-label={listening ? "Stop dictation" : "Dictate prompt"}
      aria-pressed={listening}
      title={listening ? "Stop dictation" : "Dictate prompt"}
      className={`flex size-8 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        listening
          ? "bg-ember/15 text-ember"
          : "text-ink-3 hover:bg-raised hover:text-ink"
      }`}
    >
      {listening ? (
        // Pulsing dot while recording.
        <span className="size-2.5 animate-pulse rounded-full bg-ember" />
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
  );
}
