import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";

export type StoredMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: Json;
};

const CreateThreadSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  cliente: z.string().min(1).max(200).optional().nullable(),
  area: z.enum(["publico", "tributario", "civel", "trabalhista"]),
  natureza: z.enum(["contencioso", "consultivo", "tributario"]).optional().nullable(),
  polo: z.string().max(200).optional().nullable(),
  objetivo: z.string().max(500).optional().nullable(),
  publico: z.string().max(200).optional().nullable(),
  sigilo: z.boolean().default(false),
  jurisdicao: z.string().max(200).optional().nullable(),
  premissas: z.string().max(2000).optional().nullable(),
  raw_input: z.string().max(60000).optional().nullable(),
});

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateThreadSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const fallbackTitle = data.cliente
      ? `${data.cliente} • ${data.area}`
      : `${data.area}${data.natureza ? " • " + data.natureza : ""}`;
    const { data: row, error } = await supabase
      .from("threads")
      .insert({
        user_id: userId,
        title: data.title ?? fallbackTitle,
        cliente: data.cliente ?? null,
        area: data.area,
        natureza: data.natureza ?? null,
        polo: data.polo ?? null,
        objetivo: data.objetivo ?? null,
        publico: data.publico ?? null,
        sigilo: data.sigilo,
        jurisdicao: data.jurisdicao ?? null,
        premissas: data.premissas ?? null,
        raw_input: data.raw_input ?? null,
        status: "em_tratamento",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      user_id: userId,
      thread_id: row.id,
      action: "thread.created",
      metadata: { area: data.area, cliente: data.cliente ?? null },
    });
    return row;
  });

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("threads")
      .select("id,title,cliente,area,status,updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const getThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: thread, error: tErr } = await supabase
      .from("threads")
      .select("*")
      .eq("id", data.threadId)
      .eq("user_id", userId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!thread) throw new Error("Thread não encontrada");

    const { data: msgs, error: mErr } = await supabase
      .from("messages")
      .select("id,role,parts,created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (mErr) throw new Error(mErr.message);

    const messages: StoredMessage[] = (msgs ?? []).map((m) => ({
      id: m.id,
      role: m.role as StoredMessage["role"],
      parts: m.parts,
    }));
    return { thread, messages };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("threads")
      .delete()
      .eq("id", data.threadId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      user_id: userId,
      action: "thread.deleted",
      metadata: { thread_id: data.threadId },
    });
    return { ok: true };
  });