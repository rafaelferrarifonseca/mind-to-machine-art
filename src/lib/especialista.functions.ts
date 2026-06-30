import { createServerFn } from "@tanstack/react-start";
import { generateText, type ModelMessage } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { ESPECIALISTA_INSTRUCTIONS } from "@/lib/system-prompt";
import type { Dossie } from "@/lib/dossie-schema";
import type { Json } from "@/integrations/supabase/types";

type StoredPart = { type: "text"; text: string };

function partsToText(parts: unknown): string {
  if (typeof parts === "string") return parts;
  if (Array.isArray(parts)) {
    return parts
      .map((p: any) => (p && typeof p === "object" && p.type === "text" ? String(p.text ?? "") : ""))
      .join("");
  }
  if (parts && typeof parts === "object" && (parts as any).type === "text") {
    return String((parts as any).text ?? "");
  }
  return "";
}

function buildSystemPrompt(thread: any, dossie: Dossie | null): string {
  const ctx = [
    `Cliente: ${thread.cliente || "não informado"}`,
    `Área / módulo especialista: ${thread.area}`,
    `Natureza: ${thread.natureza || "não informada"}`,
    `Polo / posição: ${thread.polo || "não especificado"}`,
    `Objetivo: ${thread.objetivo || "não especificado"}`,
    `Jurisdição: ${thread.jurisdicao || "não especificada"}`,
    `Público destinatário: ${thread.publico || "não especificado"}`,
    `Sigilo: ${thread.sigilo ? "SIM — segredo de justiça ou dados sensíveis" : "não declarado"}`,
    `Premissas/restrições: ${thread.premissas || "nenhuma"}`,
  ].join("\n");

  const dossieBlock = dossie
    ? JSON.stringify(dossie, null, 2)
    : "(dossiê não disponível — solicitar tratamento prévio antes de prosseguir)";

  return `${ESPECIALISTA_INSTRUCTIONS}

# PARÂMETROS DA MATÉRIA
${ctx}

# DOSSIÊ TRATADO (insumo da Generalista — base factual)
\`\`\`json
${dossieBlock}
\`\`\`

Use estritamente o dossiê e os parâmetros acima como base factual. Não invente fatos, partes ou números. Siga rigorosamente o fluxo de validação prévia da tese antes de redigir qualquer minuta.`;
}

export const sendEspecialistaMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      threadId: z.string().uuid(),
      content: z.string().min(1).max(8000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: thread, error: tErr } = await supabase
      .from("threads")
      .select("*")
      .eq("id", data.threadId)
      .eq("user_id", userId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!thread) throw new Error("Análise não encontrada");

    const { data: history, error: hErr } = await supabase
      .from("messages")
      .select("role,parts,created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (hErr) throw new Error(hErr.message);

    const userPart: StoredPart = { type: "text", text: data.content };

    const { error: insUserErr } = await supabase.from("messages").insert({
      thread_id: data.threadId,
      user_id: userId,
      role: "user",
      parts: [userPart] as unknown as Json,
    });
    if (insUserErr) throw new Error(insUserErr.message);

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const system = buildSystemPrompt(thread, (thread.dossie as unknown as Dossie | null) ?? null);

    const modelMessages: ModelMessage[] = [
      ...(history ?? [])
        .map((m) => ({ role: m.role as "user" | "assistant", text: partsToText(m.parts) }))
        .filter((m) => m.text.trim().length > 0)
        .map((m) => ({ role: m.role, content: m.text }) as ModelMessage),
      { role: "user", content: data.content },
    ];

    let assistantText = "";
    try {
      const { text } = await generateText({
        model,
        system,
        messages: modelMessages,
      });
      assistantText = text?.trim() || "(sem resposta)";
    } catch (err) {
      assistantText = `Falha ao gerar resposta: ${err instanceof Error ? err.message : String(err)}`;
    }

    const assistantPart: StoredPart = { type: "text", text: assistantText };
    const { error: insAssistantErr } = await supabase.from("messages").insert({
      thread_id: data.threadId,
      user_id: userId,
      role: "assistant",
      parts: [assistantPart] as unknown as Json,
    });
    if (insAssistantErr) throw new Error(insAssistantErr.message);

    await supabase
      .from("threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.threadId)
      .eq("user_id", userId);

    await supabase.from("audit_log").insert({
      user_id: userId,
      thread_id: data.threadId,
      action: "especialista.message",
      metadata: { user_chars: data.content.length, assistant_chars: assistantText.length },
    });

    return { assistant: assistantText };
  });

export const clearEspecialistaThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("thread_id", data.threadId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      user_id: userId,
      thread_id: data.threadId,
      action: "especialista.cleared",
      metadata: null,
    });
    return { ok: true };
  });