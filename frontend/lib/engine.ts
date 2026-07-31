// Server-only PromptForge engine: one structured Claude call that scores AND revises a
// draft against a chosen prompt framework (see lib/frameworks.ts). The system prompt and the
// output schema are built per-framework, so the model judges exactly that framework's
// dimensions; the keyed scorecard it returns is reshaped into an ordered list here.
//
// The call is STREAMED. Latency is almost entirely output-token generation (measured: ~195
// chars/sec, with fixed overhead indistinguishable from zero), so the only way to make this
// feel fast is to show fields as they are written rather than after 13-21s of nothing. The
// generator yields raw text deltas for the UI to preview, then one authoritative `done`.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { DimensionResult, Evaluation, EvaluationResult } from "./schema";
import {
  buildEvaluationSchema,
  buildSystemPrompt,
  getFramework,
  requiredKeys,
} from "./frameworks";
import { overallScore } from "./scoring";
import { MODEL } from "./model";
import { MISSING_ANTHROPIC_KEY } from "./keys";

/**
 * `delta` carries a slice of the model's JSON as it is written — best-effort preview only.
 * `done` carries the parsed, schema-validated result and is the sole source of truth.
 */
export type EvaluateChunk =
  | { type: "delta"; text: string }
  | { type: "done"; result: EvaluationResult };

export async function* streamEvaluate(
  draft: string,
  frameworkId?: string,
  focus?: string,
  // A key the user saved in Settings (resolved by the route via lib/keys.ts); falls back
  // to the server env var so existing deployments keep working unchanged.
  apiKeyOverride?: string,
): AsyncGenerator<EvaluateChunk> {
  const apiKey = apiKeyOverride ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(MISSING_ANTHROPIC_KEY);
  }

  const framework = getFramework(frameworkId);
  const client = new Anthropic({ apiKey });
  const schema = buildEvaluationSchema(framework);

  // temperature: 0 keeps scoring consistent. NOTE: remove `temperature` if you switch to
  // Claude Opus 4.7/4.8 - those models reject sampling params (HTTP 400). Sonnet 4.6 accepts it.
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    temperature: 0,
    system: buildSystemPrompt(framework),
    messages: [
      {
        role: "user",
        content: focus
          ? `${draft}\n\n---\nWhen scoring and revising this pass, pay particular attention to: ${focus}`
          : draft,
      },
    ],
    output_config: { format: zodOutputFormat(schema) },
  });

  // Structured output arrives as a single JSON text block, so text deltas are JSON fragments.
  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta" &&
      event.delta.text
    ) {
      yield { type: "delta", text: event.delta.text };
    }
  }

  const message = await stream.finalMessage();
  const raw = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  // Parse and validate here rather than relying on the stream's parsed_output, so the
  // authoritative result comes from the same zod schema that constrained the generation.
  const parsed = (() => {
    try {
      return schema.parse(JSON.parse(raw));
    } catch {
      throw new Error("The model did not return a parseable evaluation. Try again.");
    }
  })();

  // Reshape the keyed scorecard into an ordered list carrying each dimension's display name,
  // in the framework's canonical order. The keys are guaranteed present by the schema.
  const keyed = parsed.scorecard as Record<string, DimensionResult>;
  const scorecard = framework.dimensions.map((d) => ({
    key: d.key,
    name: d.name,
    ...keyed[d.key],
  }));

  const evaluation: Evaluation = {
    // Echoed from the request — the model is no longer asked to retype the draft.
    prompt_evaluated: draft,
    scorecard,
    priority_fix: parsed.priority_fix,
    revised_prompt: parsed.revised_prompt,
    suggested_title: parsed.suggested_title,
    suggested_category: parsed.suggested_category,
    suggested_tags: parsed.suggested_tags,
    framework: { id: framework.id, name: framework.name },
  };

  yield {
    type: "done",
    result: {
      evaluation,
      overall_score: overallScore(scorecard, requiredKeys(framework)),
    },
  };
}
