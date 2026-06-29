import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createThread, deleteThread, listThreads } from "@/lib/threads.functions";
import { ScaleIcon, PlusIcon, LogOutIcon, TrashIcon, FileTextIcon, ShieldAlertIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

const AREAS = [
  { value: "publico", label: "Direito Público" },
  { value: "tributario", label: "Direito Tributário" },
  { value: "civel", label: "Direito Cível" },
  { value: "trabalhista", label: "Direito Trabalhista" },
];
const NATUREZAS = [
  { value: "contencioso", label: "Contencioso" },
  { value: "consultivo", label: "Consultivo" },
  { value: "tributario", label: "Tributário" },
];

function AppLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const list = useServerFn(listThreads);
  const create = useServerFn(createThread);
  const remove = useServerFn(deleteThread);
  const params = useParams({ strict: false }) as { threadId?: string };
  const activeId = params.threadId;

  const threadsQ = useQuery({
    queryKey: ["threads"],
    queryFn: () => list(),
  });

  const [modalOpen, setModalOpen] = useState(false);
  const createMut = useMutation({
    mutationFn: (data: Parameters<typeof create>[0]["data"]) => create({ data }),
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: ["threads"] });
      setModalOpen(false);
      navigate({ to: "/app/$threadId", params: { threadId: row.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao criar"),
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

  return (
    <div className="grid h-screen grid-cols-[280px_1fr] bg-background">
      <aside className="flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
          <div className="grid h-9 w-9 place-items-center rounded-sm bg-accent text-accent-foreground">
            <ScaleIcon className="h-4 w-4" />
          </div>
          <div>
            <div className="font-serif text-base font-semibold leading-none">IA-RF</div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Etapa Generalista</div>
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

        <div className="mt-4 flex-1 overflow-y-auto px-2 pb-2">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider opacity-50">
            Conversas
          </div>
          {threadsQ.isLoading && <div className="px-3 py-2 text-xs opacity-60">Carregando…</div>}
          {threadsQ.data?.length === 0 && (
            <div className="px-3 py-2 text-xs opacity-60">Nenhuma análise ainda.</div>
          )}
          <ul className="space-y-0.5">
            {threadsQ.data?.map((t) => (
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
                    <FileTextIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span className="truncate">{t.title}</span>
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

      {modalOpen && <NewThreadModal onClose={() => setModalOpen(false)} onCreate={(d) => createMut.mutate(d)} pending={createMut.isPending} />}
    </div>
  );
}

function NewThreadModal({
  onClose,
  onCreate,
  pending,
}: {
  onClose: () => void;
  onCreate: (data: Parameters<typeof createThread>[0]["data"]) => void;
  pending: boolean;
}) {
  const [form, setForm] = useState({
    title: "",
    area: "publico",
    natureza: "contencioso",
    polo: "",
    objetivo: "",
    publico: "",
    sigilo: false,
    jurisdicao: "",
    premissas: "",
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onCreate({
      title: form.title || undefined,
      area: form.area as "publico" | "tributario" | "civel" | "trabalhista",
      natureza: form.natureza as "contencioso" | "consultivo" | "tributario",
      polo: form.polo,
      objetivo: form.objetivo,
      publico: form.publico,
      sigilo: form.sigilo,
      jurisdicao: form.jurisdicao || null,
      premissas: form.premissas || null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-sm border border-border bg-card p-8 shadow-xl"
      >
        <h2 className="font-serif text-2xl font-semibold">Parametrizar nova análise</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O sistema só opera dentro do perímetro definido. Preencha o contexto da matéria antes de iniciar.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Área">
            <select
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
              className="input"
            >
              {AREAS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Natureza do trabalho">
            <select
              value={form.natureza}
              onChange={(e) => setForm({ ...form, natureza: e.target.value })}
              className="input"
            >
              {NATUREZAS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Polo / posição representada" hint="Ex.: autor, réu, consulente">
            <input
              required
              value={form.polo}
              onChange={(e) => setForm({ ...form, polo: e.target.value })}
              className="input"
              placeholder="ex.: réu — empresa contratante"
            />
          </Field>
          <Field label="Público destinatário" hint="Calibra linguagem e profundidade">
            <input
              required
              value={form.publico}
              onChange={(e) => setForm({ ...form, publico: e.target.value })}
              className="input"
              placeholder="ex.: sócio responsável"
            />
          </Field>
          <Field label="Objetivo pretendido" hint="Produto e resultado esperados" full>
            <textarea
              required
              rows={2}
              value={form.objetivo}
              onChange={(e) => setForm({ ...form, objetivo: e.target.value })}
              className="input"
              placeholder="ex.: triagem do processo e mapeamento de teses defensivas"
            />
          </Field>
          <Field label="Jurisdição" hint="Opcional — tribunal competente">
            <input
              value={form.jurisdicao}
              onChange={(e) => setForm({ ...form, jurisdicao: e.target.value })}
              className="input"
              placeholder="ex.: TJSP"
            />
          </Field>
          <Field label="Título da análise" hint="Opcional">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input"
              placeholder="Identificador interno"
            />
          </Field>
          <Field label="Premissas e restrições" hint="Opcional — prazos, instruções, limites" full>
            <textarea
              rows={2}
              value={form.premissas}
              onChange={(e) => setForm({ ...form, premissas: e.target.value })}
              className="input"
            />
          </Field>
        </div>

        <label className="mt-5 flex items-start gap-3 rounded-sm border border-border bg-secondary/50 p-3 text-sm">
          <input
            type="checkbox"
            checked={form.sigilo}
            onChange={(e) => setForm({ ...form, sigilo: e.target.checked })}
            className="mt-1"
          />
          <div>
            <div className="flex items-center gap-1.5 font-medium">
              <ShieldAlertIcon className="h-3.5 w-3.5 text-accent" />
              Caso envolve segredo de justiça ou dados pessoais sensíveis
            </div>
            <p className="text-xs text-muted-foreground">
              Aciona tratamento mais restritivo e alertas adicionais na conversa.
            </p>
          </div>
        </label>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-sm border border-border px-4 py-2 text-sm hover:bg-secondary">
            Cancelar
          </button>
          <button
            disabled={pending}
            className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Criando…" : "Iniciar análise"}
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
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</label>
      {hint && <div className="text-[11px] text-muted-foreground/70">{hint}</div>}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}