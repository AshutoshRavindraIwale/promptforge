// Server-only PromptForge engine: one structured Claude call that scores AND revises a
// draft against a chosen prompt framework (see lib/frameworks.ts). The system prompt and the
// output schema are built per-framework, so the model judges exactly that framework's
// dimensions; the keyed scorecard it returns is reshaped into an ordered list here. Output
// shape is enforced by zodOutputFormat(schema), so there is no manual JSON parsing.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Evaluation } from "./schema";
import {
  buildEvaluationSchema,
  buildSystemPrompt,
  getFramework,
} from "./frameworks";
import { MODEL } from "./model";
import { MISSING_ANTHROPIC_KEY } from "./keys";

export async function evaluate(
  draft: string,
  frameworkId?: string,
  focus?: string,
  // A key the user saved in Settings (resolved by the route via lib/keys.ts); falls back
  // to the server env var so existing deployments keep working unchanged.
  apiKeyOverride?: string,
): Promise<Evaluation> {
  const apiKey = apiKeyOverride ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(MISSING_ANTHROPIC_KEY);
  }

  const framework = getFramework(frameworkId);
  const client = new Anthropic({ apiKey });

  // temperature: 0 keeps scoring consistent. NOTE: remove `temperature` if you switch to
  // Claude Opus 4.7/4.8 - those models reject sampling params (HTTP 400). Sonnet 4.6 accepts it.
  const message = await client.messages.parse({
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
    output_config: { format: zodOutputFormat(buildEvaluationSchema(framework)) },
  });

  const parsed = message.parsed_output;
  if (!parsed) {
    throw new Error("The model did not return a parseable evaluation. Try again.");
  }

  // Reshape the keyed scorecard into an ordered list carrying each dimension's display name,
  // in the framework's canonical order. The keys are guaranteed present by the schema.
  const keyed = parsed.scorecard as Record<
    string,
    { score: Evaluation["scorecard"][number]["score"]; assessment: string; advice: string }
  >;
  const scorecard = framework.dimensions.map((d) => ({
    key: d.key,
    name: d.name,
    ...keyed[d.key],
  }));

  return {
    prompt_evaluated: parsed.prompt_evaluated,
    scorecard,
    priority_fix: parsed.priority_fix,
    revised_prompt: parsed.revised_prompt,
    suggested_title: parsed.suggested_title,
    suggested_category: parsed.suggested_category,
    suggested_tags: parsed.suggested_tags,
    framework: { id: framework.id, name: framework.name },
  };
}
