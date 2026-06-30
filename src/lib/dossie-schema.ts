import { z } from "zod";

const TextSchema = z.preprocess(
  (value) => (value === null || value === undefined ? "" : String(value)),
  z.string(),
);

const StringArraySchema = z.preprocess(
  (value) => (Array.isArray(value) ? value : []),
  z.array(TextSchema),
);

const RiskLevelSchema = z.preprocess((value) => {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (["alto", "alta", "grave", "elevado", "elevada", "high"].includes(normalized)) {
    return "alto";
  }
  if (["baixo", "baixa", "leve", "reduzido", "reduzida", "low"].includes(normalized)) {
    return "baixo";
  }
  return "medio";
}, z.enum(["alto", "medio", "baixo"]));

const PartSchema = z.preprocess(
  (value) => (value && typeof value === "object" ? value : {}),
  z.object({
    nome: TextSchema,
    polo: TextSchema.describe("autor, réu, terceiro, consulente, etc"),
    observacao: TextSchema.optional(),
  }),
);

const PedidoTeseSchema = z.preprocess(
  (value) => (value && typeof value === "object" ? value : {}),
  z.object({
    titulo: TextSchema,
    descricao: TextSchema,
  }),
);

const LinhaTempoSchema = z.preprocess(
  (value) => (value && typeof value === "object" ? value : {}),
  z.object({
    data: TextSchema.describe("data ou descrição temporal"),
    evento: TextSchema,
  }),
);

const RiscoSchema = z.preprocess(
  (value) => (value && typeof value === "object" ? value : {}),
  z.object({
    nivel: RiskLevelSchema,
    descricao: TextSchema,
  }),
);

export const DossieSchema = z.object({
  resumo: TextSchema.default("").describe("Resumo executivo do caso em 2 a 4 frases"),
  fatos: TextSchema.default("").describe("Narrativa cronológica dos fatos relevantes, em markdown"),
  partes: z
    .preprocess((value) => (Array.isArray(value) ? value : []), z.array(PartSchema))
    .default([])
    .describe("Partes identificadas e seus polos"),
  pedidos_teses: z
    .preprocess((value) => (Array.isArray(value) ? value : []), z.array(PedidoTeseSchema))
    .default([])
    .describe("Pedidos formulados e teses jurídicas iniciais"),
  linha_tempo: z
    .preprocess((value) => (Array.isArray(value) ? value : []), z.array(LinhaTempoSchema))
    .default([])
    .describe("Movimentações ou eventos processuais relevantes em ordem"),
  riscos: z
    .preprocess((value) => (Array.isArray(value) ? value : []), z.array(RiscoSchema))
    .default([])
    .describe("Riscos, fragilidades e pontos sensíveis"),
  alertas: StringArraySchema
    .default([])
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