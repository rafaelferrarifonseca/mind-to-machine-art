import { createFileRoute, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { getThread } from "@/lib/threads.functions";
import {
  refineGeneralista,
  runGeneralista,
  saveDossie,
  setThreadStatus,
} from "@/lib/generalista.functions";
import { EMPTY_DOSSIE, type Dossie } from "@/lib/dossie-schema";
import {
  ShieldAlertIcon,
  ScaleIcon,
  SparklesIcon,
  PencilIcon,
  ArchiveIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  Clock3Icon,
  UsersIcon,
  FileTextIcon,
  GavelIcon,
  RefreshCwIcon,
  DownloadIcon,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/$threadId")({
  component: ThreadView,
});

function ThreadView() {
  const { threadId } = useParams({ from: "/_authenticated/app/$threadId" });
  const queryClient = useQueryClient();
  const fetchThread = useServerFn(getThread);
  const runGen = useServerFn(runGeneralista);
  const refine = useServerFn(refineGeneralista);
  const save = useServerFn(saveDossie);
  const setStatus = useServerFn(setThreadStatus);

  const q = useQuery({
    queryKey: ["thread", threadId],
    queryFn: () => fetchThread({ data: { threadId } }),
    // se status em_tratamento, repolla até virar tratado
    refetchInterval: (q) => {
      const status = (q.state.data as any)?.thread?.status;
      return status === "em_tratamento" ? 2500 : false;
    },
  });

  const refineMut = useMutation({
    mutationFn: (feedback: string) => refine({ data: { threadId, feedback } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
      queryClient.invalidateQueries({ queryKey: ["threads"] });
      toast.success("Dossiê revisado");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const reRunMut = useMutation({
    mutationFn: () => runGen({ data: { threadId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
      toast.success("Tratamento refeito");
    },
  });

  const saveMut = useMutation({
    mutationFn: (d: Dossie) => save({ data: { threadId, dossie: d } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
      toast.success("Alterações salvas");
    },
  });

  const statusMut = useMutation({
    mutationFn: (status: "tratado" | "em_analise" | "arquivado") =>
      setStatus({ data: { threadId, status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
      queryClient.invalidateQueries({ queryKey: ["threads"] });
    },
  });

  if (q.isLoading) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }
  if (q.error || !q.data) {
    return (
      <div className="grid h-full place-items-center text-sm text-destructive">
        Erro ao carregar análise.
      </div>
    );
  }

  const thread = q.data.thread;
  const dossie =
    ((thread.dossie as unknown as Dossie | null) ?? null) || EMPTY_DOSSIE;
  const isProcessing = thread.status === "em_tratamento" && !thread.dossie;

  return (
    <div className="flex h-full flex-col">
      <ThreadHeader
        thread={thread}
        dossie={dossie}
        onArchive={() => statusMut.mutate("arquivado")}
        onUseAI={() => statusMut.mutate("em_analise")}
        onMarkTreated={() => statusMut.mutate("tratado")}
        onReRun={() => reRunMut.mutate()}
        reRunPending={reRunMut.isPending}
      />

      <div className="flex-1 overflow-y-auto bg-background">
        <div className="mx-auto max-w-4xl px-6 py-6">
          {isProcessing ? (
            <ProcessingCard />
          ) : (
            <DossieView
              dossie={dossie}
              onSave={(d) => saveMut.mutate(d)}
              saving={saveMut.isPending}
            />
          )}

          {!isProcessing && (
            <RefinementBox
              onSend={(t) => refineMut.mutate(t)}
              pending={refineMut.isPending}
            />
          )}

          {thread.status === "em_analise" && (
            <EspecialistaPlaceholder />
          )}
        </div>
      </div>
    </div>
  );
}

function ThreadHeader({
  thread,
  dossie,
  onArchive,
  onUseAI,
  onMarkTreated,
  onReRun,
  reRunPending,
}: {
  thread: any;
  dossie: Dossie;
  onArchive: () => void;
  onUseAI: () => void;
  onMarkTreated: () => void;
  onReRun: () => void;
  reRunPending: boolean;
}) {
  return (
    <header className="border-b border-border bg-card px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate font-serif text-lg font-semibold">
            {thread.title}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {thread.cliente && (
              <Badge>
                <UsersIcon className="mr-1 inline h-3 w-3" />
                {thread.cliente}
              </Badge>
            )}
            <Badge>{areaLabel(thread.area)}</Badge>
            <StatusBadge status={thread.status} />
            {thread.polo && <span>polo: <strong className="text-foreground">{thread.polo}</strong></span>}
            {thread.jurisdicao && <span>jur.: <strong className="text-foreground">{thread.jurisdicao}</strong></span>}
          </div>
          {thread.objetivo && (
            <p className="mt-1.5 text-xs italic text-muted-foreground">
              objetivo: {thread.objetivo}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {thread.sigilo && (
            <div className="flex items-center gap-1.5 rounded-sm border border-destructive/30 bg-destructive/5 px-2.5 py-1 text-[11px] font-medium text-destructive">
              <ShieldAlertIcon className="h-3.5 w-3.5" /> Sigilo
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={onReRun}
          disabled={reRunPending}
          className="flex items-center gap-1.5 rounded-sm border border-border bg-card px-2.5 py-1 text-xs hover:bg-secondary disabled:opacity-50"
          title="Reprocessar do zero com a Generalista"
        >
          <RefreshCwIcon className={`h-3 w-3 ${reRunPending ? "animate-spin" : ""}`} />
          Reprocessar
        </button>
        <button
          onClick={() => downloadDossie(thread, dossie, "md")}
          className="flex items-center gap-1.5 rounded-sm border border-border bg-card px-2.5 py-1 text-xs hover:bg-secondary"
          title="Baixar dossiê em Markdown"
        >
          <DownloadIcon className="h-3 w-3" /> .md
        </button>
        <button
          onClick={() => downloadDossie(thread, dossie, "json")}
          className="flex items-center gap-1.5 rounded-sm border border-border bg-card px-2.5 py-1 text-xs hover:bg-secondary"
          title="Baixar dossiê em JSON"
        >
          <DownloadIcon className="h-3 w-3" /> .json
        </button>
        <button
          onClick={onMarkTreated}
          className="flex items-center gap-1.5 rounded-sm border border-border bg-card px-2.5 py-1 text-xs hover:bg-secondary"
        >
          <CheckCircle2Icon className="h-3 w-3" /> Trabalhar sem IA
        </button>
        <button
          onClick={onUseAI}
          className="flex items-center gap-1.5 rounded-sm bg-primary px-2.5 py-1 text-xs text-primary-foreground hover:opacity-90"
        >
          <SparklesIcon className="h-3 w-3" /> Acionar Especialista
          <ArrowRightIcon className="h-3 w-3" />
        </button>
        <button
          onClick={onArchive}
          className="ml-auto flex items-center gap-1.5 rounded-sm border border-border bg-card px-2.5 py-1 text-xs opacity-70 hover:bg-secondary hover:opacity-100"
        >
          <ArchiveIcon className="h-3 w-3" /> Arquivar
        </button>
      </div>
    </header>
  );
}

function ProcessingCard() {
  return (
    <div className="rounded-sm border border-dashed border-border bg-card p-6 text-center">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-accent/10 text-accent">
        <ScaleIcon className="h-5 w-5 animate-pulse" />
      </div>
      <h2 className="mt-3 font-serif text-base font-semibold">
        Tratamento prévio em andamento
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A IA Generalista está organizando o material em dossiê estruturado. Isso leva alguns segundos.
      </p>
    </div>
  );
}

function DossieView({
  dossie,
  onSave,
  saving,
}: {
  dossie: Dossie;
  onSave: (d: Dossie) => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<Dossie>(dossie);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setDraft(dossie);
  }, [dossie]);

  if (editing) {
    return (
      <div className="rounded-sm border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <PencilIcon className="h-3.5 w-3.5 text-accent" /> Editar dossiê
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setDraft(dossie); setEditing(false); }}
              className="rounded-sm border border-border px-3 py-1 text-xs hover:bg-secondary"
            >
              Cancelar
            </button>
            <button
              disabled={saving}
              onClick={() => { onSave(draft); setEditing(false); }}
              className="rounded-sm bg-primary px-3 py-1 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
        <div className="space-y-4 p-4">
          <EditField label="Resumo" value={draft.resumo} onChange={(v) => setDraft({ ...draft, resumo: v })} rows={3} />
          <EditField label="Fatos (markdown)" value={draft.fatos} onChange={(v) => setDraft({ ...draft, fatos: v })} rows={8} mono />
          <EditField
            label="Alertas (um por linha)"
            value={draft.alertas.join("\n")}
            onChange={(v) => setDraft({ ...draft, alertas: v.split("\n").map(s => s.trim()).filter(Boolean) })}
            rows={4}
          />
          <p className="text-[11px] text-muted-foreground">
            Partes, pedidos, linha do tempo e riscos: ajuste por refinamento na caixa abaixo, ou reprocesse.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 rounded-sm border border-border bg-card px-2.5 py-1 text-xs hover:bg-secondary"
        >
          <PencilIcon className="h-3 w-3" /> Editar dossiê
        </button>
      </div>

      {dossie.resumo && (
        <Card title="Resumo" icon={<FileTextIcon className="h-3.5 w-3.5" />}>
          <p className="text-sm leading-relaxed text-foreground">{dossie.resumo}</p>
        </Card>
      )}

      {dossie.alertas.length > 0 && (
        <Card
          title="Alertas e lacunas"
          icon={<AlertTriangleIcon className="h-3.5 w-3.5" />}
          tone="warn"
        >
          <ul className="space-y-1.5 text-sm">
            {dossie.alertas.map((a, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {dossie.partes.length > 0 && (
        <Card title="Partes" icon={<UsersIcon className="h-3.5 w-3.5" />}>
          <ul className="divide-y divide-border text-sm">
            {dossie.partes.map((p, i) => (
              <li key={i} className="flex items-baseline justify-between py-1.5">
                <span className="font-medium">{p.nome}</span>
                <span className="text-xs text-muted-foreground">{p.polo}{p.observacao ? ` · ${p.observacao}` : ""}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {dossie.fatos && (
        <Card title="Fatos" icon={<FileTextIcon className="h-3.5 w-3.5" />}>
          <div className="prose prose-sm max-w-none text-foreground">
            <ReactMarkdown>{dossie.fatos}</ReactMarkdown>
          </div>
        </Card>
      )}

      {dossie.pedidos_teses.length > 0 && (
        <Card title="Pedidos e teses" icon={<GavelIcon className="h-3.5 w-3.5" />}>
          <ol className="space-y-2.5 text-sm">
            {dossie.pedidos_teses.map((p, i) => (
              <li key={i}>
                <div className="font-medium text-foreground">{i + 1}. {p.titulo}</div>
                <div className="text-muted-foreground">{p.descricao}</div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {dossie.linha_tempo.length > 0 && (
        <Card title="Linha do tempo" icon={<Clock3Icon className="h-3.5 w-3.5" />}>
          <ul className="space-y-2 text-sm">
            {dossie.linha_tempo.map((e, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground">{e.data}</span>
                <span>{e.evento}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {dossie.riscos.length > 0 && (
        <Card title="Riscos" icon={<AlertTriangleIcon className="h-3.5 w-3.5" />}>
          <ul className="space-y-2 text-sm">
            {dossie.riscos.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <RiskChip nivel={r.nivel} />
                <span>{r.descricao}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {isEmpty(dossie) && (
        <Card title="Dossiê vazio">
          <p className="text-sm text-muted-foreground">
            A Generalista não extraiu informações estruturadas. Use o campo abaixo para guiar o tratamento, ou reprocesse.
          </p>
        </Card>
      )}
    </div>
  );
}

function isEmpty(d: Dossie) {
  return (
    !d.resumo && !d.fatos &&
    d.partes.length === 0 && d.pedidos_teses.length === 0 &&
    d.linha_tempo.length === 0 && d.riscos.length === 0 && d.alertas.length === 0
  );
}

function RefinementBox({
  onSend,
  pending,
}: {
  onSend: (text: string) => void;
  pending: boolean;
}) {
  const [text, setText] = useState("");
  return (
    <div className="mt-6 rounded-sm border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <SparklesIcon className="h-3.5 w-3.5 text-accent" />
        Pedir ajuste à Generalista
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Aponte erros, peça mais detalhe em algum bloco, ou complemente o material. O dossiê será reescrito.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        disabled={pending}
        placeholder="ex.: o réu na verdade é pessoa jurídica; detalhar melhor a tese de prescrição; adicionar evento de citação em 12/03/2024"
        className="input mt-2 resize-y text-sm"
      />
      <div className="mt-2 flex justify-end">
        <button
          disabled={pending || !text.trim()}
          onClick={() => { onSend(text.trim()); setText(""); }}
          className="flex items-center gap-1.5 rounded-sm bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Refinando…" : "Refinar dossiê"}
        </button>
      </div>
    </div>
  );
}

function EspecialistaPlaceholder() {
  return (
    <div className="mt-6 rounded-sm border border-dashed border-accent/40 bg-accent/5 p-5">
      <div className="flex items-center gap-2 font-serif text-base font-semibold">
        <SparklesIcon className="h-4 w-4 text-accent" /> IA Especialista
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        O dossiê tratado será o ponto de partida do chat com a IA Especialista da área, com contexto já preenchido.
      </p>
      <div className="mt-3 inline-flex items-center gap-1.5 rounded-sm bg-card px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        em breve
      </div>
    </div>
  );
}

function Card({
  title,
  icon,
  children,
  tone,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  tone?: "warn";
}) {
  return (
    <section
      className={`rounded-sm border bg-card ${tone === "warn" ? "border-accent/40" : "border-border"}`}
    >
      <header className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function EditField({
  label,
  value,
  onChange,
  rows,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className={`input mt-1 resize-y text-sm ${mono ? "font-mono text-xs" : ""}`}
      />
    </div>
  );
}

function RiskChip({ nivel }: { nivel: "alto" | "medio" | "baixo" }) {
  const map = {
    alto: "bg-destructive/10 text-destructive border-destructive/30",
    medio: "bg-accent/10 text-accent-foreground border-accent/40",
    baixo: "bg-muted text-muted-foreground border-border",
  } as const;
  const label = { alto: "Alto", medio: "Médio", baixo: "Baixo" }[nivel];
  return (
    <span
      className={`mt-0.5 inline-flex shrink-0 items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${map[nivel]}`}
    >
      {label}
    </span>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground">
      {children}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    em_tratamento: { label: "Em tratamento", cls: "bg-amber-100 text-amber-900 border-amber-300" },
    tratado: { label: "Tratado", cls: "bg-emerald-100 text-emerald-900 border-emerald-300" },
    em_analise: { label: "Em análise", cls: "bg-sky-100 text-sky-900 border-sky-300" },
    arquivado: { label: "Arquivado", cls: "bg-slate-100 text-slate-700 border-slate-300" },
  };
  const s = map[status] ?? { label: status, cls: "bg-secondary text-secondary-foreground border-border" };
  return (
    <span className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${s.cls}`}>
      {s.label}
    </span>
  );
}

function areaLabel(a: string) {
  return (
    { publico: "Público", tributario: "Tributário", civel: "Cível", trabalhista: "Trabalhista" } as Record<string, string>
  )[a] ?? a;
}

function slugify(s: string) {
  return (s || "dossie")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "dossie";
}

function dossieToMarkdown(thread: any, d: Dossie) {
  const lines: string[] = [];
  lines.push(`# ${thread.title}`);
  const meta = [
    thread.cliente && `**Cliente:** ${thread.cliente}`,
    `**Área:** ${areaLabel(thread.area)}`,
    thread.natureza && `**Natureza:** ${thread.natureza}`,
    thread.polo && `**Polo:** ${thread.polo}`,
    thread.jurisdicao && `**Jurisdição:** ${thread.jurisdicao}`,
    `**Status:** ${thread.status}`,
    thread.sigilo && `**Sigilo:** sim`,
  ].filter(Boolean);
  if (meta.length) lines.push("", meta.join("  \n"));
  if (thread.objetivo) lines.push("", `> Objetivo: ${thread.objetivo}`);
  if (d.resumo) lines.push("", "## Resumo", "", d.resumo);
  if (d.alertas?.length) {
    lines.push("", "## Alertas e lacunas", "");
    d.alertas.forEach((a) => lines.push(`- ${a}`));
  }
  if (d.partes?.length) {
    lines.push("", "## Partes", "");
    d.partes.forEach((p) =>
      lines.push(`- **${p.nome}** — ${p.polo}${p.observacao ? ` · ${p.observacao}` : ""}`)
    );
  }
  if (d.fatos) lines.push("", "## Fatos", "", d.fatos);
  if (d.pedidos_teses?.length) {
    lines.push("", "## Pedidos e teses", "");
    d.pedidos_teses.forEach((p, i) =>
      lines.push(`${i + 1}. **${p.titulo}** — ${p.descricao}`)
    );
  }
  if (d.linha_tempo?.length) {
    lines.push("", "## Linha do tempo", "");
    d.linha_tempo.forEach((e) => lines.push(`- \`${e.data}\` — ${e.evento}`));
  }
  if (d.riscos?.length) {
    lines.push("", "## Riscos", "");
    d.riscos.forEach((r) => lines.push(`- **[${r.nivel.toUpperCase()}]** ${r.descricao}`));
  }
  lines.push("", "---", `_Gerado em ${new Date().toLocaleString("pt-BR")} — XPTO Advogados_`);
  return lines.join("\n");
}

function downloadDossie(thread: any, d: Dossie, fmt: "md" | "json") {
  const content =
    fmt === "md" ? dossieToMarkdown(thread, d) : JSON.stringify({ thread, dossie: d }, null, 2);
  const mime = fmt === "md" ? "text/markdown;charset=utf-8" : "application/json;charset=utf-8";
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dossie-${slugify(thread.cliente || thread.title)}.${fmt}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}