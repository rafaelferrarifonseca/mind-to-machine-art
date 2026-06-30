import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  createThread,
  deleteThread,
  listThreads,
} from "@/lib/threads.functions";
import { runGeneralista } from "@/lib/generalista.functions";
import {
  ScaleIcon,
  PlusIcon,
  LogOutIcon,
  TrashIcon,
  FileTextIcon,
  ShieldAlertIcon,
  SearchIcon,
  PaperclipIcon,
  XIcon,
  Loader2Icon,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

type Area = "publico" | "tributario" | "civel" | "trabalhista";
type Status = "em_tratamento" | "tratado" | "em_analise" | "arquivado";

const AREAS: { value: Area; label: string }[] = [
  { value: "publico", label: "Público" },
  { value: "tributario", label: "Tributário" },
  { value: "civel", label: "Cível" },
  { value: "trabalhista", label: "Trabalhista" },
];

const STATUS_LABEL: Record<Status, string> = {
  em_tratamento: "Em tratamento",
  tratado: "Tratado",
  em_analise: "Em análise",
  arquivado: "Arquivado",
};

type GroupBy = "cliente" | "area" | "status" | "data";

function AppLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const list = useServerFn(listThreads);
  const create = useServerFn(createThread);
  const remove = useServerFn(deleteThread);
  const runGen = useServerFn(runGeneralista);
  const params = useParams({ strict: false }) as { threadId?: string };
  const activeId = params.threadId;

  const threadsQ = useQuery({
    queryKey: ["threads"],
    queryFn: () => list(),
  });

  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("data");
  const [areaFilter, setAreaFilter] = useState<Area | "">("");
  const [statusFilter, setStatusFilter] = useState<Status | "">("");
  const [modalOpen, setModalOpen] = useState(false);

  const createMut = useMutation({
    mutationFn: async (d: NewThreadData) => {
      const row = await create({ data: d });
      // dispara generalista em segundo plano
      runGen({ data: { threadId: row.id } })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["threads"] });
          queryClient.invalidateQueries({ queryKey: ["thread", row.id] });
        })
        .catch((e) =>
          toast.error(
            e instanceof Error
              ? `Falha no tratamento prévio: ${e.message}`
              : "Falha no tratamento prévio",
          ),
        );
      return row;
    },
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: ["threads"] });
      setModalOpen(false);
      navigate({ to: "/app/$threadId", params: { threadId: row.id } });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Erro ao criar"),
  });

  const deleteMut = useMutation({
    mutationFn: (threadId: string) => remove({ data: { threadId } }),
    onSuccess: (_, threadId) => {
      queryClient.invalidateQueries({ queryKey: ["threads"] });
      if (activeId === threadId) navigate({ to: "/app" });
    },
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const filtered = useMemo(() => {
    const items = threadsQ.data ?? [];
    const q = search.trim().toLowerCase();
    return items.filter((t) => {
      if (areaFilter && t.area !== areaFilter) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      if (q) {
        const hay = `${t.title} ${t.cliente ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [threadsQ.data, search, areaFilter, statusFilter]);

  const grouped = useMemo(() => groupThreads(filtered, groupBy), [filtered, groupBy]);

  return (
    <div className="grid h-screen grid-cols-[300px_1fr] bg-background">
      <aside className="flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
          <div className="grid h-9 w-9 place-items-center rounded-sm bg-accent text-accent-foreground">
            <ScaleIcon className="h-4 w-4" />
          </div>
          <div>
            <div className="font-serif text-base font-semibold leading-none">XPTO</div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">
              IA-RF • Generalista
            </div>
          </div>
        </div>

        <div className="px-3 pt-3">
          <button
            onClick={() => setModalOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-sm bg-accent px-3 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90"
          >
            <PlusIcon className="h-4 w-4" /> Nova análise
          </button>
        </div>

        <div className="space-y-2 border-b border-sidebar-border px-3 py-3">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-50" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente ou título"
              className="w-full rounded-sm border border-sidebar-border bg-sidebar-accent/40 py-1.5 pl-8 pr-2 text-xs text-sidebar-foreground placeholder:opacity-50 focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <SelectMini
              value={areaFilter}
              onChange={(v) => setAreaFilter(v as Area | "")}
              placeholder="Área"
            >
              <option value="">Todas as áreas</option>
              {AREAS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </SelectMini>
            <SelectMini
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as Status | "")}
            >
              <option value="">Todos status</option>
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </SelectMini>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider opacity-50">
              Agrupar
            </span>
            {(["data", "cliente", "area", "status"] as GroupBy[]).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`rounded-sm px-1.5 py-0.5 text-[10px] uppercase tracking-wide transition ${
                  groupBy === g
                    ? "bg-accent text-accent-foreground"
                    : "opacity-60 hover:opacity-100"
                }`}
              >
                {g === "data" ? "Data" : g === "area" ? "Área" : g === "cliente" ? "Cliente" : "Status"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {threadsQ.isLoading && (
            <div className="px-3 py-2 text-xs opacity-60">Carregando…</div>
          )}
          {!threadsQ.isLoading && filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-xs opacity-60">
              Nenhuma análise encontrada.
            </div>
          )}
          {grouped.map((g) => (
            <div key={g.key} className="mb-3">
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider opacity-50">
                {g.label}
              </div>
              <ul className="space-y-0.5">
                {g.items.map((t) => (
                  <li key={t.id}>
                    <div
                      className={`group flex items-center gap-2 rounded-sm px-3 py-2 text-sm transition ${
                        activeId === t.id
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "hover:bg-sidebar-accent/60"
                      }`}
                    >
                      <Link
                        to="/app/$threadId"
                        params={{ threadId: t.id }}
                        className="flex min-w-0 flex-1 items-center gap-2"
                      >
                        <StatusDot status={t.status as Status} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">{t.title}</div>
                          <div className="truncate text-[10px] opacity-60">
                            {t.cliente || "sem cliente"} ·{" "}
                            {areaLabel(t.area)}
                          </div>
                        </div>
                      </Link>
                      <button
                        onClick={() => {
                          if (confirm("Excluir esta análise?")) deleteMut.mutate(t.id);
                        }}
                        className="opacity-0 transition group-hover:opacity-60 hover:!opacity-100"
                        aria-label="Excluir"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <button
          onClick={signOut}
          className="flex items-center gap-2 border-t border-sidebar-border px-5 py-3 text-xs opacity-70 hover:opacity-100"
        >
          <LogOutIcon className="h-3.5 w-3.5" /> Sair
        </button>
      </aside>

      <main className="h-screen overflow-hidden">
        <Outlet />
      </main>

      {modalOpen && (
        <NewThreadModal
          onClose={() => setModalOpen(false)}
          onCreate={(d) => createMut.mutate(d)}
          pending={createMut.isPending}
        />
      )}
    </div>
  );
}

type NewThreadData = {
  title?: string;
  cliente?: string | null;
  area: Area;
  polo?: string | null;
  objetivo?: string | null;
  sigilo: boolean;
  jurisdicao?: string | null;
  raw_input?: string | null;
  attachments?: { path: string; name: string; mime: string; size: number }[];
};

function NewThreadModal({
  onClose,
  onCreate,
  pending,
}: {
  onClose: () => void;
  onCreate: (data: NewThreadData) => void;
  pending: boolean;
}) {
  const [form, setForm] = useState({
    title: "",
    cliente: "",
    area: "publico" as Area,
    polo: "",
    objetivo: "",
    jurisdicao: "",
    sigilo: false,
    raw_input: "",
  });
  type Upload = {
    id: string;
    name: string;
    size: number;
    mime: string;
    status: "uploading" | "done" | "error";
    path?: string;
    error?: string;
  };
  const [uploads, setUploads] = useState<Upload[]>([]);

  const ACCEPTED =
    ".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,image/png,image/jpeg,image/webp";
  const MAX_BYTES = 20 * 1024 * 1024;
  const MAX_FILES = 10;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      toast.error("Sessão expirada");
      return;
    }
    const remaining = MAX_FILES - uploads.length;
    const incoming = Array.from(files).slice(0, remaining);
    if (files.length > remaining) toast.error(`Máximo de ${MAX_FILES} arquivos.`);
    for (const file of incoming) {
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: excede 20MB`);
        continue;
      }
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 200);
      const path = `${uid}/drafts/${id}-${safeName}`;
      setUploads((u) => [
        ...u,
        { id, name: file.name, size: file.size, mime: file.type || "application/octet-stream", status: "uploading" },
      ]);
      const { error } = await supabase.storage
        .from("thread-uploads")
        .upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      setUploads((u) =>
        u.map((it) =>
          it.id === id
            ? error
              ? { ...it, status: "error", error: error.message }
              : { ...it, status: "done", path }
            : it,
        ),
      );
      if (error) toast.error(`${file.name}: ${error.message}`);
    }
  }

  async function removeUpload(id: string) {
    const item = uploads.find((u) => u.id === id);
    setUploads((u) => u.filter((it) => it.id !== id));
    if (item?.path) {
      await supabase.storage.from("thread-uploads").remove([item.path]).catch(() => {});
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const ready = uploads.filter((u) => u.status === "done" && u.path);
    const pendingUp = uploads.some((u) => u.status === "uploading");
    if (pendingUp) {
      toast.error("Aguarde os anexos terminarem de enviar.");
      return;
    }
    if (!form.raw_input.trim() && ready.length === 0) {
      toast.error("Cole o material ou anexe ao menos um documento.");
      return;
    }
    onCreate({
      title: form.title || undefined,
      cliente: form.cliente || null,
      area: form.area,
      polo: form.polo || null,
      objetivo: form.objetivo || null,
      jurisdicao: form.jurisdicao || null,
      sigilo: form.sigilo,
      raw_input: form.raw_input,
      attachments: ready.map((u) => ({
        path: u.path!,
        name: u.name,
        mime: u.mime,
        size: u.size,
      })),
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-sm border border-border bg-card p-7 shadow-xl"
      >
        <h2 className="font-serif text-xl font-semibold">Nova análise</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          A IA Generalista fará o <strong>tratamento prévio</strong> do material — você revisa, ajusta e decide o próximo passo.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Field label="Cliente">
            <input
              value={form.cliente}
              onChange={(e) => setForm({ ...form, cliente: e.target.value })}
              className="input"
              placeholder="ex.: Indústria XYZ Ltda"
            />
          </Field>
          <Field label="Área">
            <select
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value as Area })}
              className="input"
            >
              {AREAS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Polo / posição" hint="Opcional">
            <input
              value={form.polo}
              onChange={(e) => setForm({ ...form, polo: e.target.value })}
              className="input"
              placeholder="ex.: réu"
            />
          </Field>
          <Field label="Jurisdição" hint="Opcional">
            <input
              value={form.jurisdicao}
              onChange={(e) => setForm({ ...form, jurisdicao: e.target.value })}
              className="input"
              placeholder="ex.: TJSP"
            />
          </Field>
          <Field label="Objetivo" hint="Opcional" full>
            <input
              value={form.objetivo}
              onChange={(e) => setForm({ ...form, objetivo: e.target.value })}
              className="input"
              placeholder="ex.: triagem inicial do processo"
            />
          </Field>
          <Field
            label="Material a tratar"
            hint="Cole o texto da peça, ata, e-mail — ou anexe documentos abaixo"
            full
          >
            <textarea
              rows={8}
              value={form.raw_input}
              onChange={(e) => setForm({ ...form, raw_input: e.target.value })}
              className="input font-mono text-xs"
              placeholder="Cole aqui o conteúdo bruto…"
            />
          </Field>
          <div className="sm:col-span-2">
            <label className="block cursor-pointer rounded-sm border border-dashed border-border bg-secondary/40 px-3 py-3 text-xs text-muted-foreground transition hover:bg-secondary/70">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <PaperclipIcon className="h-3.5 w-3.5" />
                  Anexar PDFs, documentos ou imagens
                </span>
                <span className="text-[10px] uppercase tracking-wide opacity-60">
                  até {MAX_FILES} arq. · 20MB cada
                </span>
              </div>
              <input
                type="file"
                multiple
                accept={ACCEPTED}
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.currentTarget.value = "";
                }}
                className="hidden"
              />
            </label>
            {uploads.length > 0 && (
              <ul className="mt-2 space-y-1">
                {uploads.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center gap-2 rounded-sm border border-border bg-card px-2.5 py-1.5 text-xs"
                  >
                    {u.status === "uploading" ? (
                      <Loader2Icon className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                    ) : u.status === "error" ? (
                      <ShieldAlertIcon className="h-3.5 w-3.5 shrink-0 text-destructive" />
                    ) : (
                      <FileTextIcon className="h-3.5 w-3.5 shrink-0 text-accent" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{u.name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {(u.size / 1024).toFixed(0)} KB
                      {u.status === "error" && ` · ${u.error}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeUpload(u.id)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Remover anexo"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <label className="mt-4 flex items-start gap-3 rounded-sm border border-border bg-secondary/50 p-3 text-sm">
          <input
            type="checkbox"
            checked={form.sigilo}
            onChange={(e) => setForm({ ...form, sigilo: e.target.checked })}
            className="mt-1"
          />
          <div>
            <div className="flex items-center gap-1.5 font-medium">
              <ShieldAlertIcon className="h-3.5 w-3.5 text-accent" />
              Segredo de justiça ou dados pessoais sensíveis
            </div>
            <p className="text-xs text-muted-foreground">
              Aciona tratamento mais restritivo no dossiê.
            </p>
          </div>
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-border px-4 py-2 text-sm hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            disabled={pending}
            className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Criando…" : "Iniciar tratamento prévio"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
  full,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {hint && <div className="text-[10px] text-muted-foreground/70">{hint}</div>}
      <div className="mt-1">{children}</div>
    </div>
  );
}

function SelectMini({
  value,
  onChange,
  children,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={placeholder}
      className="w-full truncate rounded-sm border border-sidebar-border bg-sidebar-accent/40 px-1.5 py-1 text-[11px] text-sidebar-foreground focus:outline-none focus:ring-1 focus:ring-accent"
    >
      {children}
    </select>
  );
}

function StatusDot({ status }: { status: Status }) {
  const cls =
    status === "em_tratamento"
      ? "bg-amber-400"
      : status === "tratado"
        ? "bg-emerald-400"
        : status === "em_analise"
          ? "bg-sky-400"
          : "bg-slate-400";
  return (
    <span
      title={STATUS_LABEL[status]}
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${cls}`}
    />
  );
}

type ThreadRow = {
  id: string;
  title: string;
  cliente: string | null;
  area: string;
  status: string;
  updated_at: string;
};

function groupThreads(items: ThreadRow[], by: GroupBy) {
  const groups = new Map<string, { key: string; label: string; sort: number; items: ThreadRow[] }>();

  for (const it of items) {
    let key = "";
    let label = "";
    let sort = 0;
    if (by === "cliente") {
      key = it.cliente?.toLowerCase() || "_sem";
      label = it.cliente || "Sem cliente";
      sort = key === "_sem" ? 9999 : 0;
    } else if (by === "area") {
      key = it.area;
      label = areaLabel(it.area);
    } else if (by === "status") {
      key = it.status;
      label = STATUS_LABEL[it.status as Status] ?? it.status;
      sort = ["em_tratamento", "tratado", "em_analise", "arquivado"].indexOf(key);
    } else {
      const d = new Date(it.updated_at);
      const diff = (Date.now() - d.getTime()) / 86_400_000;
      if (diff < 1) { key = "hoje"; label = "Hoje"; sort = 0; }
      else if (diff < 7) { key = "semana"; label = "Últimos 7 dias"; sort = 1; }
      else if (diff < 30) { key = "mes"; label = "Últimos 30 dias"; sort = 2; }
      else { key = "antigos"; label = "Antigos"; sort = 3; }
    }
    if (!groups.has(key)) groups.set(key, { key, label, sort, items: [] });
    groups.get(key)!.items.push(it);
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (a.sort !== b.sort) return a.sort - b.sort;
    return a.label.localeCompare(b.label, "pt-BR");
  });
}

function areaLabel(a: string) {
  return (
    { publico: "Público", tributario: "Tributário", civel: "Cível", trabalhista: "Trabalhista" } as Record<string, string>
  )[a] ?? a;
}