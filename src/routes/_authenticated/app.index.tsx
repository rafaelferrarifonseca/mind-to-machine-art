import { createFileRoute } from "@tanstack/react-router";
import { FileTextIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/")({
  component: EmptyState,
});

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <FileTextIcon className="h-10 w-10 text-muted-foreground/40" />
      <h2 className="mt-4 font-serif text-2xl font-semibold text-foreground">
        Inicie uma nova análise
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Selecione uma conversa existente na lateral ou clique em <strong>Nova análise</strong> para parametrizar o contexto da matéria antes de iniciar.
      </p>
      <div className="mt-8 max-w-md rounded-sm border border-border bg-card p-4 text-left text-xs text-muted-foreground">
        <div className="font-medium text-foreground">Lembre-se</div>
        <ul className="mt-2 space-y-1.5">
          <li>• A etapa generalista não gera peças, pareceres ou contratos.</li>
          <li>• Toda saída é insumo, sujeito à revisão integral do advogado.</li>
          <li>• Cada comando registra trilha de auditoria (LGPD).</li>
        </ul>
      </div>
    </div>
  );
}