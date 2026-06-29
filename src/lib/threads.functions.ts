import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { UIMessage } from "ai";

const CreateThreadSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  area: z.enum(["publico", "tributario", "civel", "trabalhista"]),
  natureza: z.enum(["contencioso", "consultivo", "tributario"]),
  polo: z.string().min(1).max(200),
  objetivo: z.string().min(1).max(500),
  publico: z.string().min(1).max(200),
  sigilo: z.boolean().default(false),
  jurisdicao: z.string().max(200).optional().nullable(),
  premissas: z.string().max(2000).optional().nullable(),
});

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateThreadSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("threads")
      .insert({
        user_id: userId,
        title: data.title ?? `${data.area} • ${data.natureza}`,
        area: data.area,
        natureza: data.natureza,
        polo: data.polo,
        objetivo: data.objetivo,
        publico: data.publico,
        sigilo: data.sigilo,
        jurisdicao: data.jurisdicao ?? null,
        premissas: data.premissas ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      user_id: userId,
      thread_id: row.id,
      action: "thread.created",
      metadata: { area: data.area, natureza: data.natureza },
    });
    return row;
  });

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("threads")
      .select("id,title,area,natureza,updated_at")
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

    const messages: UIMessage[] = (msgs ?? []).map((m) => ({
      id: m.id,
      role: m.role as UIMessage["role"],
      parts: m.parts as UIMessage["parts"],
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