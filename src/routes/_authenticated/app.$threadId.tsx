import { createFileRoute, useParams } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getThread } from "@/lib/threads.functions";
import { supabase } from "@/integrations/supabase/client";
import { SendIcon, ShieldAlertIcon, ScaleIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/_authenticated/app/$threadId")({
  component: ThreadView,
});

type ThreadData = Awaited<ReturnType<typeof getThread>>;

function ThreadView() {
  const { threadId } = useParams({ from: "/_authenticated/app/$threadId" });
  const fetchThread = useServerFn(getThread);
  const q = useQuery({
    queryKey: ["thread", threadId],
    queryFn: () => fetchThread({ data: { threadId } }),
  });

  if (q.isLoading) {
    return <div className="grid h-full place-items-center text-sm text-muted-foreground">Carregando…</div>;
  }
  if (q.error || !q.data) {
    return <div className="grid h-full place-items-center text-sm text-destructive">Erro ao carregar conversa.</div>;
  }

  return <ChatSurface key={threadId} threadId={threadId} thread={q.data.thread} initial={q.data.messages} />;
}

function ChatSurface({
  threadId,
  thread,
  initial,
}: {
  threadId: string;
  thread: ThreadData["thread"];
  initial: ThreadData["messages"];
}) {
  const initialMessages = useMemo<UIMessage[]>(
    () =>
      initial.map((m) => ({
        id: m.id,
        role: m.role as UIMessage["role"],
        parts: (m.parts as UIMessage["parts"]) ?? [],
      })),
    [initial],
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          const headers = new Headers(init?.headers);
          if (token) headers.set("Authorization", `Bearer ${token}`);
          let body = init?.body;
          if (typeof body === "string") {
            try {
              const parsed = JSON.parse(body);
              body = JSON.stringify({ ...parsed, threadId });
            } catch {
              // keep as-is
            }
          }
          return fetch(input, { ...init, body, headers });
        }) as typeof fetch,
      }),
    [threadId],
  );

  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
  });

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    taRef.current?.focus();
  }, [threadId, status]);

  const busy = status === "submitted" || status === "streaming";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    await sendMessage({ text });
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate font-serif text-lg font-semibold">{thread.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <Badge>{areaLabel(thread.area)}</Badge>
              <Badge>{thread.natureza}</Badge>
              <span>polo: <strong className="text-foreground">{thread.polo}</strong></span>
              <span>público: <strong className="text-foreground">{thread.publico}</strong></span>
              {thread.jurisdicao && <span>jur.: <strong className="text-foreground">{thread.jurisdicao}</strong></span>}
            </div>
            <p className="mt-1.5 text-xs italic text-muted-foreground">objetivo: {thread.objetivo}</p>
          </div>
          {thread.sigilo && (
            <div className="flex shrink-0 items-center gap-1.5 rounded-sm border border-destructive/30 bg-destructive/5 px-2.5 py-1 text-[11px] font-medium text-destructive">
              <ShieldAlertIcon className="h-3.5 w-3.5" /> Sigilo
            </div>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.length === 0 && <FirstHint />}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {status === "submitted" && <ThinkingDots />}
          {error && (
            <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error.message || "Falha na geração. Tente novamente."}
            </div>
          )}
        </div>
      </div>

      <form onSubmit={submit} className="border-t border-border bg-card px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(e);
              }
            }}
            rows={2}
            disabled={busy}
            placeholder="Cole material, descreva o trabalho ou peça uma análise. Comandos genéricos serão recusados."
            className="min-h-[60px] flex-1 resize-none rounded-sm border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="grid h-[60px] w-12 place-items-center rounded-sm bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <SendIcon className="h-4 w-4" />
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-[11px] text-muted-foreground">
          IA-RF • Etapa generalista — não gera peças, pareceres ou contratos. Toda saída é insumo sujeito à revisão integral.
        </p>
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const text = (message.parts ?? [])
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("");
  if (!text) return null;

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-primary text-primary-foreground">
        <ScaleIcon className="h-4 w-4" />
      </div>
      <div className="prose prose-sm max-w-none flex-1 text-foreground prose-headings:font-serif prose-headings:text-foreground prose-strong:text-foreground prose-p:my-2 prose-li:my-0.5">
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
    </div>
  );
}

function FirstHint() {
  return (
    <div className="rounded-sm border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
      <div className="font-serif text-base font-semibold text-foreground">Sessão parametrizada</div>
      <p className="mt-1.5">
        Forneça material concreto (trechos, fatos, documentos) e um pedido específico dentro do perímetro de análise e apoio. Pedidos genéricos ou fora de escopo serão recusados.
      </p>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <div className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60" style={{ animationDelay: "150ms" }} />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60" style={{ animationDelay: "300ms" }} />
      </div>
      Analisando…
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground">
      {children}
    </span>
  );
}

function areaLabel(a: string) {
  return ({ publico: "Público", tributario: "Tributário", civel: "Cível", trabalhista: "Trabalhista" } as Record<string, string>)[a] ?? a;
}