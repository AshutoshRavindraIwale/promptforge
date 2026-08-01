"use client";

import { useEffect } from "react";

// App-wide error boundary. Without this, a thrown render error white-screens the whole app;
// this gives a recoverable fallback with a reset() that re-renders the failed segment.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col items-center justify-center px-6 text-center">
      <span className="size-2.5 rotate-45 rounded-[1px] bg-ember" />
      <h1 className="mt-5 text-[22px] font-light tracking-[-0.01em] text-ink">
        Something went wrong.
      </h1>
      <p className="mt-2 text-sm text-ink-2">
        The page hit an unexpected error. You can try again — if it keeps
        happening, reload the app.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-full bg-ember px-5 py-2.5 text-[13px] font-medium text-bg transition hover:brightness-110"
      >
        Try again
      </button>
    </main>
  );
}
