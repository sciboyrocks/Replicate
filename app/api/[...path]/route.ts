import { NextRequest, NextResponse } from "next/server";
import { catalog } from "@/lib/catalog";
import { base } from "@/lib/models";
import { configSchema } from "@/lib/schema";
import * as runner from "@/lib/runner";
import { csv, experimentExport } from "@/lib/export";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  try {
    const p = (await ctx.params).path;
    if (p[0] === "catalog")
      return NextResponse.json(
        await catalog(req.nextUrl.searchParams.has("refresh")),
      );
    if (p[0] === "experiments" && !p[1])
      return NextResponse.json(
        (await runner.history()).map((e) => ({
          id: e.id,
          createdAt: e.createdAt,
          status: e.status,
          title: e.config.title,
          mode: e.config.mode,
          n: e.config.n,
          models: e.config.models,
          completed: e.attempts.filter((a) => a.status === "done").length,
          total: e.attempts.length,
        })),
      );
    if (p[0] === "experiments" && p[1]) {
      const e = await runner.get(p[1]);
      if (p[2] === "export") {
        const isCsv = req.nextUrl.searchParams.get("format") === "csv";
        return new Response(
          isCsv ? csv(e) : JSON.stringify(experimentExport(e), null, 2),
          {
            headers: {
              "Content-Type": isCsv ? "text/csv" : "application/json",
              "Content-Disposition": `attachment; filename="replicate-${e.id}.${isCsv ? "csv" : "json"}"`,
            },
          },
        );
      }
      return NextResponse.json(e);
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch {
    return NextResponse.json(
      { error: "Experiment unavailable" },
      { status: 404 },
    );
  }
}
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  try {
    const origin = req.headers.get("origin");
    const allowedOrigin =
      !origin ||
      (() => {
        try {
          const o = new URL(origin);
          return (
            ["127.0.0.1", "localhost", "[::1]"].includes(o.hostname) &&
            o.host === req.headers.get("host")
          );
        } catch {
          return false;
        }
      })();
    if (!allowedOrigin)
      return NextResponse.json(
        { error: "Cross-origin writes are not allowed" },
        { status: 403 },
      );
    if (!req.headers.get("content-type")?.includes("application/json"))
      return NextResponse.json({ error: "JSON required" }, { status: 415 });
    const p = (await ctx.params).path;
    if (p[0] !== "experiments")
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!p[1]) {
      const c = configSchema.parse(await req.json());
      const cat = c.mode === "demo" ? { models: base } : await catalog();
      const routes: Record<string, import("@/lib/types").Route[]> = {};
      for (const id of c.models) {
        const model = cat.models.find((m) => m.id === id);
        if (!model) throw Error("Unknown checkpoint");
        routes[id] = model.routes.filter(
          (r) =>
            r.available &&
            (c.allowPaid || r.free) &&
            (c.reasoning === "default" ||
              (r.reasoning === "toggle" && r.provider === "openrouter")) &&
            (!r.maxTokens || c.maxTokens <= r.maxTokens),
        );
        if (c.mode === "live" && !routes[id].length)
          throw Error(
            `No compatible configured route for ${model.name} ${model.size}. Check keys, reasoning and token limit.`,
          );
      }
      if (c.mode === "live" && c.grading === "semantic") {
        if (c.judgeProvider === "openrouter") {
          if (!process.env.OPENROUTER_API_KEY)
            throw Error("OpenRouter judge key is missing");
          const r = cat.models
            .flatMap((m) => m.routes)
            .find(
              (r) => r.provider === "openrouter" && r.model === c.judgeModel,
            );
          if (!r)
            throw Error(
              "Judge must be an exact model ID in the current research catalog",
            );
          if (!r.free && !c.allowPaid)
            throw Error("Paid judge requires paid routes enabled");
        } else if (!process.env.VLLM_BASE_URL)
          throw Error("vLLM judge endpoint is not configured");
      }
      return NextResponse.json(
        await runner.create({
          ...c,
          routes,
          modelsSnapshot: cat.models.filter((m) => c.models.includes(m.id)),
        }),
        { status: 201 },
      );
    }
    if (p[2] === "cancel") return NextResponse.json(await runner.cancel(p[1]));
    if (p[2] === "resume") return NextResponse.json(await runner.resume(p[1]));
    if (p[2] === "override") {
      const o = z
        .object({
          attemptId: z.string().uuid(),
          correct: z.boolean(),
          reason: z.string().trim().min(1).max(1000),
        })
        .parse(await req.json());
      return NextResponse.json(
        await runner.override(p[1], o.attemptId, o.correct, o.reason),
      );
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof z.ZodError
            ? e.issues.map((i) => i.message).join("; ")
            : e instanceof Error
              ? e.message
              : "Request failed",
      },
      { status: 400 },
    );
  }
}
