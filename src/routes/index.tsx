import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ScaleIcon, ShieldCheckIcon, FileSearchIcon, EyeIcon } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IA-RF • XPTO Advogados" },
      { name: "description", content: "Sistema proprietário de IA jurídica do XPTO Advogados — parametrizada, auditável e em conformidade com LGPD." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-sm bg-primary text-primary-foreground">
              <ScaleIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="font-serif text-xl font-semibold leading-none">IA-RF</div>
              <div className="text-xs text-muted-foreground">XPTO Advogados</div>
            </div>
          </div>
          <Link
            to="/auth"
            className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Entrar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Etapa Generalista • MVP
          </div>
          <h1 className="font-serif text-5xl font-semibold leading-[1.05] text-foreground md:text-6xl">
            Inteligência artificial parametrizada, sob a governança do escritório.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Ambiente proprietário de análise e apoio jurídico para as áreas Pública, Tributária, Cível e Trabalhista. Toda interação é parametrizada na origem, conservadora por padrão, auditável e submetida à supervisão humana.
          </p>
          <div className="mt-10 flex gap-3">
            <Link
              to="/auth"
              className="rounded-sm bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Acessar o sistema
            </Link>
            <a
              href="#pilares"
              className="rounded-sm border border-border bg-card px-5 py-3 text-sm font-medium text-foreground hover:bg-secondary"
            >
              Conhecer os pilares
            </a>
          </div>
        </div>

        <section id="pilares" className="mt-24 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: FileSearchIcon, title: "Análise e apoio", body: "Leitura, organização, resumo e conferência de processos e documentos — sem geração de peças finais." },
            { icon: ShieldCheckIcon, title: "Parametrização travada", body: "Área, polo, objetivo e público obrigatórios. Tom, formato e postura conservadora fixados no sistema." },
            { icon: EyeIcon, title: "Supervisão humana", body: "Toda saída é insumo. Revisão integral do advogado responsável antes de uso externo." },
            { icon: ScaleIcon, title: "Trilha de auditoria", body: "Cada comando registra usuário, parâmetros e resposta. Conforme LGPD e Plano Nacional OAB." },
          ].map((p) => (
            <div key={p.title} className="rounded-sm border border-border bg-card p-6">
              <p.icon className="h-5 w-5 text-accent" />
              <h3 className="mt-4 font-serif text-lg font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-muted-foreground">
          IA-RF • Sistema proprietário XPTO Advogados • Uso interno
        </div>
      </footer>
    </div>
  );
}
