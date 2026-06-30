import { createServerFn } from "@tanstack/react-start";
import { generateObject } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { GENERALISTA_INSTRUCTIONS } from "@/lib/system-prompt";
import { DossieSchema, type Dossie } from "@/lib/dossie-schema";
import type { Json } from "@/integrations/supabase/types";

function buildContext(thread: {
  cliente: string | null;
  area: string;
  polo: string | null;
  objetivo: string | null;
  sigilo: boolean;
  jurisdicao: string | null;
  premissas: string | null;
}) {
  return [
    `Cliente: ${thread.cliente || "não informado"}`,
    `Área: ${thread.area}`,
    `Polo / posição: ${thread.polo || "não especificado"}`,
    `Objetivo: ${thread.objetivo || "não especificado"}`,
    `Jurisdição: ${thread.jurisdicao || "não especificada"}`,
    `Sigilo: ${thread.sigilo ? "SIM" : "não declarado"}`,
    `Premissas/restrições: ${thread.premissas || "nenhuma"}`,
  ].join("\n");
}

async function generateDossie(opts: {
  context: string;
  rawInput: string;
  feedback?: string;
  previousDossie?: Dossie | null;
}): Promise<Dossie> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const gateway = createLovableAiGatewayProvider(key);
  const model = gateway("google/gemini-3-flash-preview");

  const previousPart = opts.previousDossie
    ? `\n\n# DOSSIÊ ATUAL (a revisar)\n${JSON.stringify(opts.previousDossie, null, 2)}`
    : "";
  const feedbackPart = opts.feedback
    ? `\n\n# AJUSTES SOLICITADOS PELO ADVOGADO\n${opts.feedback}\n\nIncorpore os ajustes acima ao dossiê. Mantenha o que continua válido.`
    : "";

  const prompt = `${GENERALISTA_INSTRUCTIONS}

# CONTEXTO DA MATÉRIA
${opts.context}

# MATERIAL BRUTO FORNECIDO PELO ADVOGADO
${opts.rawInput || "(nenhum material textual fornecido)"}${previousPart}${feedbackPart}

Devolva o dossiê estruturado conforme o schema. Não invente. Use "alertas" para registrar lacunas.`;

  const { object } = await generateObject({
    model,
    schema: DossieSchema,
    prompt,
  });
  return object;
}

const RunSchema = z.object({ threadId: z.string().uuid() });

export const runGeneralista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RunSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: thread, error } = await supabase
      .from("threads")
      .select("*")
      .eq("id", data.threadId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!thread) throw new Error("Análise não encontrada");

    const dossie = await generateDossie({
      context: buildContext(thread),
      rawInput: thread.raw_input ?? "",
    });

    const { error: upErr } = await supabase
      .from("threads")
      .update({
        dossie: dossie as unknown as Json,
        status: "tratado",
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.threadId)
      .eq("user_id", userId);
    if (upErr) throw new Error(upErr.message);

    await supabase.from("audit_log").insert({
      user_id: userId,
      thread_id: data.threadId,
      action: "generalista.dossie_generated",
      metadata: null,
    });

    return dossie;
  });

const RefineSchema = z.object({
  threadId: z.string().uuid(),
  feedback: z.string().min(3).max(4000),
});

export const refineGeneralista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RefineSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: thread, error } = await supabase
      .from("threads")
      .select("*")
      .eq("id", data.threadId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!thread) throw new Error("Análise não encontrada");

    const dossie = await generateDossie({
      context: buildContext(thread),
      rawInput: thread.raw_input ?? "",
      previousDossie: (thread.dossie as unknown as Dossie | null) ?? null,
      feedback: data.feedback,
    });

    const { error: upErr } = await supabase
      .from("threads")
      .update({
        dossie: dossie as unknown as Json,
        status: "tratado",
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.threadId)
      .eq("user_id", userId);
    if (upErr) throw new Error(upErr.message);

    await supabase.from("audit_log").insert({
      user_id: userId,
      thread_id: data.threadId,
      action: "generalista.refined",
      metadata: { feedback: data.feedback.slice(0, 200) },
    });

    return dossie;
  });

const SaveDossieSchema = z.object({
  threadId: z.string().uuid(),
  dossie: DossieSchema,
});

export const saveDossie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveDossieSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("threads")
      .update({
        dossie: data.dossie as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.threadId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      user_id: userId,
      thread_id: data.threadId,
      action: "dossie.edited_manually",
      metadata: null,
    });
    return { ok: true };
  });

const SetStatusSchema = z.object({
  threadId: z.string().uuid(),
  status: z.enum(["em_tratamento", "tratado", "em_analise", "arquivado"]),
});

export const setThreadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SetStatusSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("threads")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.threadId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      user_id: userId,
      thread_id: data.threadId,
      action: "thread.status_changed",
      metadata: { status: data.status },
    });
    return { ok: true };
  });