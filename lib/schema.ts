import { z } from "zod";
export const configSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    question: z.string().trim().min(1).max(50000),
    reference: z.string().max(20000).default(""),
    rubric: z.string().max(20000).default(""),
    grading: z.enum(["exact", "normalized", "numeric", "semantic"]),
    tolerance: z.number().finite().min(0).max(1e12),
    relativeTolerance: z.number().finite().min(0).max(1),
    models: z
      .array(z.string())
      .min(1)
      .max(10)
      .transform((a) => [...new Set(a)]),
    n: z.number().int().min(1).max(1000),
    mode: z.enum(["demo", "live"]),
    temperature: z.number().min(0).max(2),
    topP: z.number().min(0.001).max(1),
    seed: z.number().int().min(1).max(9999990000).nullable(),
    maxTokens: z.number().int().min(1).max(32768),
    concurrency: z.number().int().min(1).max(16),
    retries: z.number().int().min(0).max(6),
    reasoning: z.enum(["default", "on", "off"]),
    allowPaid: z.boolean(),
    judgeModel: z.string().max(200).default("google/gemma-4-31b-it:free"),
    judgeProvider: z.enum(["openrouter", "vllm"]).default("openrouter"),
  })
  .superRefine((c, ctx) => {
    if (c.grading !== "semantic" && !c.reference.trim())
      ctx.addIssue({ code: "custom", message: "Reference answer is required" });
    if (c.grading === "semantic" && !c.reference.trim() && !c.rubric.trim())
      ctx.addIssue({
        code: "custom",
        message: "Reference or rubric is required",
      });
    if (c.grading === "numeric" && !Number.isFinite(Number(c.reference)))
      ctx.addIssue({
        code: "custom",
        message: "Numeric reference must be a finite number",
      });
  });
