// Client helper for the /api/test route: run one prompt (optionally against a sample
// input) and return the model's text output.

export async function testPrompt(prompt: string, input: string): Promise<string> {
  const res = await fetch("/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, input }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Test failed.");
  return String(data.output ?? "");
}
