import { z } from "zod";

export const DossieSchema = z.object({
  resumo: z.string().describe("Resumo executivo do caso em 2 a 4 frases"),
  fatos: z.string().describe("Narrativa cronológica dos fatos relevantes, em markdown"),
  partes: z
    .array(
      z.object({
        nome: z.string(),
        polo: z.string().describe("autor, réu, terceiro, consulente, etc"),
        observacao: z.string().optional(),
      }),
    )
    .describe("Partes identificadas e seus polos"),
  pedidos_teses: z
    .array(
      z.object({
        titulo: z.string(),
        descricao: z.string(),
      }),
    )
    .describe("Pedidos formulados e teses jurídicas iniciais"),
  linha_tempo: z
    .array(
      z.object({
        data: z.string().describe("data ou descrição temporal"),
        evento: z.string(),
      }),
    )
    .describe("Movimentações ou eventos processuais relevantes em ordem"),
  riscos: z
    .array(
      z.object({
        nivel: z.enum(["alto", "medio", "baixo"]),
        descricao: z.string(),
      }),
    )
    .describe("Riscos, fragilidades e pontos sensíveis"),
  alertas: z
    .array(z.string())
    .describe("Pontos de atenção: prazos, sigilo, lacunas informacionais"),
});

export type Dossie = z.infer<typeof DossieSchema>;

export const EMPTY_DOSSIE: Dossie = {
  resumo: "",
  fatos: "",
  partes: [],
  pedidos_teses: [],
  linha_tempo: [],
  riscos: [],
  alertas: [],
};