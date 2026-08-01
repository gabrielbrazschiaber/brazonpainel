/**
 * Tipos das entidades usadas pelas telas de administração.
 *
 * Ficam num módulo próprio porque são compartilhados entre a rota `/admin` e
 * cada aba (`ClientesTab`, `VendedoresTab`, `PlanosTab`, `ConfigTab`): manter
 * cópias por arquivo fazia as abas divergirem do que a consulta realmente traz.
 */

export interface Plano {
  id: string;
  nome: string;
  valor: number;
  descricao: string | null;
  ativo: boolean;
}

export interface VendedorRow {
  id: string;
  user_id: string;
  codigo_indicacao: string;
  percentual_comissao: number;
  ativo: boolean;
  nome?: string;
  email?: string;
  clientes_count?: number;
  /** Escopo de atuação (vazio = sem restrição) usado pela reserva do banco de leads. */
  segmentos?: string[] | null;
  estados?: string[] | null;
  cnaes?: string[] | null;
}

export interface ClienteRow {
  id: string;
  user_id: string;
  vendedor_id: string | null;
  data_vencimento: string | null;
  status: string;
  cpf_cnpj: string | null;
  telefone: string | null;
  plano_id: string | null;
  servico_extra: string | null;
  servico_extra_valor: number | null;
  anotacoes: string | null;
  asaas_subscription_id?: string | null;
  planos: { nome: string; valor: number } | null;
  nome?: string;
  email?: string;
}

export interface AdminRow {
  user_id: string;
  nome?: string;
  email?: string;
}

export interface Config {
  id?: string | null;
  nome_app: string | null;
  dominio: string | null;
  dias_aviso_vencimento: number | null;
  dias_devolver_lead: number | null;
  /** Janela de reserva de um lote importado, em horas. */
  horas_reserva_lote: number | null;
  percentual_comissao_padrao: number | null;
  asaas_webhook_url: string | null;
  asaas_ambiente: "producao" | "sandbox" | null;
  asaas_api_key_mascara: string;
  asaas_api_key_definida: boolean;
}

/** Configuração usada enquanto o servidor ainda não tem nenhuma salva. */
export const CONFIG_PADRAO: Config = {
  nome_app: "",
  dominio: "",
  dias_aviso_vencimento: 5,
  dias_devolver_lead: 7,
  horas_reserva_lote: 48,
  percentual_comissao_padrao: 10,
  asaas_webhook_url: "",
  asaas_ambiente: "sandbox",
  asaas_api_key_mascara: "",
  asaas_api_key_definida: false,
};
