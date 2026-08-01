export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      asaas_sync_queue: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          max_tentativas: number
          proxima_tentativa_em: string
          status: string
          tentativas: number
          tipo: string
          ultimo_erro: string | null
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          max_tentativas?: number
          proxima_tentativa_em?: string
          status?: string
          tentativas?: number
          tipo?: string
          ultimo_erro?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          max_tentativas?: number
          proxima_tentativa_em?: string
          status?: string
          tentativas?: number
          tipo?: string
          ultimo_erro?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asaas_sync_queue_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_webhook_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event: string | null
          id: string
          payload: Json | null
          payment_id: string | null
          processing_result: string
          status: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event?: string | null
          id?: string
          payload?: Json | null
          payment_id?: string | null
          processing_result?: string
          status?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event?: string | null
          id?: string
          payload?: Json | null
          payment_id?: string | null
          processing_result?: string
          status?: string | null
        }
        Relationships: []
      }
      auditoria: {
        Row: {
          acao: string
          actor_email: string | null
          actor_id: string | null
          actor_role: string | null
          created_at: string
          detalhes: Json | null
          entidade: string
          entidade_id: string | null
          id: string
        }
        Insert: {
          acao: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          detalhes?: Json | null
          entidade: string
          entidade_id?: string | null
          id?: string
        }
        Update: {
          acao?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          detalhes?: Json | null
          entidade?: string
          entidade_id?: string | null
          id?: string
        }
        Relationships: []
      }
      auth_telemetria: {
        Row: {
          app_version: string
          created_at: string
          duracao_ms: number | null
          erro: string | null
          id: string
          motivo: string | null
          papel: string | null
          rota: string | null
          tipo: string
          trace_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          app_version?: string
          created_at?: string
          duracao_ms?: number | null
          erro?: string | null
          id?: string
          motivo?: string | null
          papel?: string | null
          rota?: string | null
          tipo: string
          trace_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          app_version?: string
          created_at?: string
          duracao_ms?: number | null
          erro?: string | null
          id?: string
          motivo?: string | null
          papel?: string | null
          rota?: string | null
          tipo?: string
          trace_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      banco_leads: {
        Row: {
          bloqueado_ate: string | null
          cargo: string | null
          cidade: string | null
          cnae_codigo: string | null
          cnae_descricao: string | null
          cnpj: string | null
          created_at: string
          criado_por_id: string
          data_abertura: string | null
          email: string | null
          empresa: string | null
          estado: string | null
          id: string
          lead_id: string | null
          lote_id: string | null
          nome_contato: string
          nome_fantasia: string | null
          observacoes: string | null
          origem: Database["public"]["Enums"]["lead_origem"]
          porte: string | null
          puxado_em: string | null
          puxado_por: string | null
          razao_social: string | null
          reservado_cnae: string | null
          reservado_estado: string | null
          reservado_segmento: string | null
          segmento: string | null
          socios: string | null
          status: Database["public"]["Enums"]["banco_lead_status"]
          telefone: string
          updated_at: string
          vezes_devolvido: number
        }
        Insert: {
          bloqueado_ate?: string | null
          cargo?: string | null
          cidade?: string | null
          cnae_codigo?: string | null
          cnae_descricao?: string | null
          cnpj?: string | null
          created_at?: string
          criado_por_id: string
          data_abertura?: string | null
          email?: string | null
          empresa?: string | null
          estado?: string | null
          id?: string
          lead_id?: string | null
          lote_id?: string | null
          nome_contato: string
          nome_fantasia?: string | null
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["lead_origem"]
          porte?: string | null
          puxado_em?: string | null
          puxado_por?: string | null
          razao_social?: string | null
          reservado_cnae?: string | null
          reservado_estado?: string | null
          reservado_segmento?: string | null
          segmento?: string | null
          socios?: string | null
          status?: Database["public"]["Enums"]["banco_lead_status"]
          telefone: string
          updated_at?: string
          vezes_devolvido?: number
        }
        Update: {
          bloqueado_ate?: string | null
          cargo?: string | null
          cidade?: string | null
          cnae_codigo?: string | null
          cnae_descricao?: string | null
          cnpj?: string | null
          created_at?: string
          criado_por_id?: string
          data_abertura?: string | null
          email?: string | null
          empresa?: string | null
          estado?: string | null
          id?: string
          lead_id?: string | null
          lote_id?: string | null
          nome_contato?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["lead_origem"]
          porte?: string | null
          puxado_em?: string | null
          puxado_por?: string | null
          razao_social?: string | null
          reservado_cnae?: string | null
          reservado_estado?: string | null
          reservado_segmento?: string | null
          segmento?: string | null
          socios?: string | null
          status?: Database["public"]["Enums"]["banco_lead_status"]
          telefone?: string
          updated_at?: string
          vezes_devolvido?: number
        }
        Relationships: [
          {
            foreignKeyName: "banco_leads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banco_leads_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "banco_leads_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banco_leads_puxado_por_fkey"
            columns: ["puxado_por"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      banco_leads_lotes: {
        Row: {
          arquivo_nome: string
          autor_id: string
          created_at: string
          fonte: string | null
          horas_reserva: number | null
          id: string
          ignorados: number
          importados: number
          reservado_cnae: string | null
          reservado_estado: string | null
          reservado_segmento: string | null
          total_linhas: number
        }
        Insert: {
          arquivo_nome: string
          autor_id: string
          created_at?: string
          fonte?: string | null
          horas_reserva?: number | null
          id?: string
          ignorados?: number
          importados?: number
          reservado_cnae?: string | null
          reservado_estado?: string | null
          reservado_segmento?: string | null
          total_linhas?: number
        }
        Update: {
          arquivo_nome?: string
          autor_id?: string
          created_at?: string
          fonte?: string | null
          horas_reserva?: number | null
          id?: string
          ignorados?: number
          importados?: number
          reservado_cnae?: string | null
          reservado_estado?: string | null
          reservado_segmento?: string | null
          total_linhas?: number
        }
        Relationships: []
      }
      clientes: {
        Row: {
          anotacoes: string | null
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          cpf_cnpj: string | null
          created_at: string
          cupom_pendente_id: string | null
          data_vencimento: string | null
          id: string
          mensagem_vendedor: string | null
          plano_id: string | null
          servico_extra: string | null
          servico_extra_valor: number
          status: Database["public"]["Enums"]["cliente_status"]
          telefone: string | null
          updated_at: string
          user_id: string
          vendedor_id: string | null
          via_link: boolean
        }
        Insert: {
          anotacoes?: string | null
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          cupom_pendente_id?: string | null
          data_vencimento?: string | null
          id?: string
          mensagem_vendedor?: string | null
          plano_id?: string | null
          servico_extra?: string | null
          servico_extra_valor?: number
          status?: Database["public"]["Enums"]["cliente_status"]
          telefone?: string | null
          updated_at?: string
          user_id: string
          vendedor_id?: string | null
          via_link?: boolean
        }
        Update: {
          anotacoes?: string | null
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          cupom_pendente_id?: string | null
          data_vencimento?: string | null
          id?: string
          mensagem_vendedor?: string | null
          plano_id?: string | null
          servico_extra?: string | null
          servico_extra_valor?: number
          status?: Database["public"]["Enums"]["cliente_status"]
          telefone?: string | null
          updated_at?: string
          user_id?: string
          vendedor_id?: string | null
          via_link?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "clientes_cupom_pendente_id_fkey"
            columns: ["cupom_pendente_id"]
            isOneToOne: false
            referencedRelation: "cupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      cnaes: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string | null
          id: string
          segmento_sugerido: string | null
          total_leads: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao?: string | null
          id?: string
          segmento_sugerido?: string | null
          total_leads?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          segmento_sugerido?: string | null
          total_leads?: number
          updated_at?: string
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          asaas_ambiente: Database["public"]["Enums"]["asaas_ambiente"]
          asaas_api_key: string | null
          asaas_webhook_url: string | null
          created_at: string
          cron_token: string
          dias_aviso_vencimento: number
          dias_devolver_lead: number
          dominio: string | null
          horas_reserva_lote: number
          id: string
          mfa_obrigatorio_admin: boolean
          mfa_obrigatorio_vendedor: boolean
          nome_app: string
          percentual_comissao_padrao: number
          updated_at: string
        }
        Insert: {
          asaas_ambiente?: Database["public"]["Enums"]["asaas_ambiente"]
          asaas_api_key?: string | null
          asaas_webhook_url?: string | null
          created_at?: string
          cron_token?: string
          dias_aviso_vencimento?: number
          dias_devolver_lead?: number
          dominio?: string | null
          horas_reserva_lote?: number
          id?: string
          mfa_obrigatorio_admin?: boolean
          mfa_obrigatorio_vendedor?: boolean
          nome_app?: string
          percentual_comissao_padrao?: number
          updated_at?: string
        }
        Update: {
          asaas_ambiente?: Database["public"]["Enums"]["asaas_ambiente"]
          asaas_api_key?: string | null
          asaas_webhook_url?: string | null
          created_at?: string
          cron_token?: string
          dias_aviso_vencimento?: number
          dias_devolver_lead?: number
          dominio?: string | null
          horas_reserva_lote?: number
          id?: string
          mfa_obrigatorio_admin?: boolean
          mfa_obrigatorio_vendedor?: boolean
          nome_app?: string
          percentual_comissao_padrao?: number
          updated_at?: string
        }
        Relationships: []
      }
      conversa_mensagens: {
        Row: {
          autor_id: string
          conversa_id: string
          corpo: string
          created_at: string
          id: string
          sistema: boolean
          updated_at: string
        }
        Insert: {
          autor_id: string
          conversa_id: string
          corpo: string
          created_at?: string
          id?: string
          sistema?: boolean
          updated_at?: string
        }
        Update: {
          autor_id?: string
          conversa_id?: string
          corpo?: string
          created_at?: string
          id?: string
          sistema?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversa_mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      conversa_participantes: {
        Row: {
          conversa_id: string
          created_at: string
          id: string
          lido_em: string | null
          user_id: string
        }
        Insert: {
          conversa_id: string
          created_at?: string
          id?: string
          lido_em?: string | null
          user_id: string
        }
        Update: {
          conversa_id?: string
          created_at?: string
          id?: string
          lido_em?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversa_participantes_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      conversas: {
        Row: {
          arquivada: boolean
          cliente_id: string | null
          created_at: string
          criado_por_id: string
          id: string
          tipo: Database["public"]["Enums"]["conversa_tipo"]
          titulo: string | null
          ultima_mensagem_em: string
          updated_at: string
          vendedor_id: string | null
        }
        Insert: {
          arquivada?: boolean
          cliente_id?: string | null
          created_at?: string
          criado_por_id: string
          id?: string
          tipo: Database["public"]["Enums"]["conversa_tipo"]
          titulo?: string | null
          ultima_mensagem_em?: string
          updated_at?: string
          vendedor_id?: string | null
        }
        Update: {
          arquivada?: boolean
          cliente_id?: string | null
          created_at?: string
          criado_por_id?: string
          id?: string
          tipo?: Database["public"]["Enums"]["conversa_tipo"]
          titulo?: string | null
          ultima_mensagem_em?: string
          updated_at?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      cupom_usos: {
        Row: {
          asaas_payment_id: string | null
          asaas_subscription_id: string | null
          cliente_id: string
          codigo: string | null
          created_at: string
          cupom_id: string
          id: string
          origem: string
          pagamento_id: string | null
          pago_em: string | null
          plano_id: string | null
          user_id: string | null
          valor_desconto: number
          valor_final: number
          valor_original: number
          vendedor_id: string | null
        }
        Insert: {
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          cliente_id: string
          codigo?: string | null
          created_at?: string
          cupom_id: string
          id?: string
          origem?: string
          pagamento_id?: string | null
          pago_em?: string | null
          plano_id?: string | null
          user_id?: string | null
          valor_desconto?: number
          valor_final?: number
          valor_original?: number
          vendedor_id?: string | null
        }
        Update: {
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          cliente_id?: string
          codigo?: string | null
          created_at?: string
          cupom_id?: string
          id?: string
          origem?: string
          pagamento_id?: string | null
          pago_em?: string | null
          plano_id?: string | null
          user_id?: string | null
          valor_desconto?: number
          valor_final?: number
          valor_original?: number
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cupom_usos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cupom_usos_cupom_id_fkey"
            columns: ["cupom_id"]
            isOneToOne: false
            referencedRelation: "cupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cupom_usos_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cupom_usos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      cupons: {
        Row: {
          apenas_primeira_mensalidade: boolean
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string | null
          id: string
          max_usos: number | null
          tipo: string
          updated_at: string
          usos: number
          validade: string | null
          valor_desconto: number
          vendedor_id: string | null
        }
        Insert: {
          apenas_primeira_mensalidade?: boolean
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao?: string | null
          id?: string
          max_usos?: number | null
          tipo?: string
          updated_at?: string
          usos?: number
          validade?: string | null
          valor_desconto?: number
          vendedor_id?: string | null
        }
        Update: {
          apenas_primeira_mensalidade?: boolean
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          max_usos?: number | null
          tipo?: string
          updated_at?: string
          usos?: number
          validade?: string | null
          valor_desconto?: number
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cupons_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_atividades: {
        Row: {
          autor_id: string
          corpo: string | null
          created_at: string
          de: string | null
          id: string
          lead_id: string
          para: string | null
          tipo: string
        }
        Insert: {
          autor_id: string
          corpo?: string | null
          created_at?: string
          de?: string | null
          id?: string
          lead_id: string
          para?: string | null
          tipo: string
        }
        Update: {
          autor_id?: string
          corpo?: string | null
          created_at?: string
          de?: string | null
          id?: string
          lead_id?: string
          para?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_atividades_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_importacoes: {
        Row: {
          arquivo_nome: string
          atualizados: number
          autor_id: string
          created_at: string
          id: string
          ignorados: number
          importados: number
          total_linhas: number
          vendedor_id: string
        }
        Insert: {
          arquivo_nome: string
          atualizados?: number
          autor_id: string
          created_at?: string
          id?: string
          ignorados?: number
          importados?: number
          total_linhas?: number
          vendedor_id: string
        }
        Update: {
          arquivo_nome?: string
          atualizados?: number
          autor_id?: string
          created_at?: string
          id?: string
          ignorados?: number
          importados?: number
          total_linhas?: number
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_importacoes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_reunioes: {
        Row: {
          agendada_para: string
          created_at: string
          id: string
          lead_id: string
          notas: string | null
          remarcada_de: string | null
          status: Database["public"]["Enums"]["reuniao_status"]
          updated_at: string
          vendedor_id: string
        }
        Insert: {
          agendada_para: string
          created_at?: string
          id?: string
          lead_id: string
          notas?: string | null
          remarcada_de?: string | null
          status?: Database["public"]["Enums"]["reuniao_status"]
          updated_at?: string
          vendedor_id: string
        }
        Update: {
          agendada_para?: string
          created_at?: string
          id?: string
          lead_id?: string
          notas?: string | null
          remarcada_de?: string | null
          status?: Database["public"]["Enums"]["reuniao_status"]
          updated_at?: string
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_reunioes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_reunioes_remarcada_de_fkey"
            columns: ["remarcada_de"]
            isOneToOne: false
            referencedRelation: "lead_reunioes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_reunioes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          banco_lead_id: string | null
          cadencia_encerrada: boolean
          cargo: string | null
          cliente_id: string | null
          completude: number | null
          contatado_em: string
          created_at: string
          email: string | null
          empresa: string | null
          estagio: Database["public"]["Enums"]["lead_estagio"]
          fechado_em: string | null
          follow_ups_feitos: number
          id: string
          importacao_id: string | null
          motivo_perda: string | null
          nome_contato: string
          observacoes: string | null
          origem: Database["public"]["Enums"]["lead_origem"]
          proximo_contato: string | null
          segmento: string | null
          telefone: string
          ultimo_contato_em: string | null
          updated_at: string
          valor_estimado: number
          vendedor_id: string
        }
        Insert: {
          banco_lead_id?: string | null
          cadencia_encerrada?: boolean
          cargo?: string | null
          cliente_id?: string | null
          completude?: number | null
          contatado_em?: string
          created_at?: string
          email?: string | null
          empresa?: string | null
          estagio?: Database["public"]["Enums"]["lead_estagio"]
          fechado_em?: string | null
          follow_ups_feitos?: number
          id?: string
          importacao_id?: string | null
          motivo_perda?: string | null
          nome_contato: string
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["lead_origem"]
          proximo_contato?: string | null
          segmento?: string | null
          telefone: string
          ultimo_contato_em?: string | null
          updated_at?: string
          valor_estimado?: number
          vendedor_id: string
        }
        Update: {
          banco_lead_id?: string | null
          cadencia_encerrada?: boolean
          cargo?: string | null
          cliente_id?: string | null
          completude?: number | null
          contatado_em?: string
          created_at?: string
          email?: string | null
          empresa?: string | null
          estagio?: Database["public"]["Enums"]["lead_estagio"]
          fechado_em?: string | null
          follow_ups_feitos?: number
          id?: string
          importacao_id?: string | null
          motivo_perda?: string | null
          nome_contato?: string
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["lead_origem"]
          proximo_contato?: string | null
          segmento?: string | null
          telefone?: string
          ultimo_contato_em?: string | null
          updated_at?: string
          valor_estimado?: number
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_banco_lead_id_fkey"
            columns: ["banco_lead_id"]
            isOneToOne: false
            referencedRelation: "banco_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "lead_importacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      lembretes_vencimento: {
        Row: {
          cliente_id: string
          created_at: string
          dias_restantes: number
          id: string
          lido_em: string | null
          mensagem: string
          updated_at: string
          user_id: string | null
          vencimento: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          dias_restantes?: number
          id?: string
          lido_em?: string | null
          mensagem?: string
          updated_at?: string
          user_id?: string | null
          vencimento: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          dias_restantes?: number
          id?: string
          lido_em?: string | null
          mensagem?: string
          updated_at?: string
          user_id?: string | null
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "lembretes_vencimento_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_codigos_recuperacao: {
        Row: {
          codigo_hash: string
          created_at: string
          id: string
          updated_at: string
          usado_em: string | null
          user_id: string
        }
        Insert: {
          codigo_hash: string
          created_at?: string
          id?: string
          updated_at?: string
          usado_em?: string | null
          user_id: string
        }
        Update: {
          codigo_hash?: string
          created_at?: string
          id?: string
          updated_at?: string
          usado_em?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          created_at: string
          id: string
          lida_em: string | null
          link: string | null
          mensagem: string | null
          tarefa_id: string | null
          tipo: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida_em?: string | null
          link?: string | null
          mensagem?: string | null
          tarefa_id?: string | null
          tipo?: string
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida_em?: string | null
          link?: string | null
          mensagem?: string | null
          tarefa_id?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      novidades: {
        Row: {
          conteudo: string
          created_at: string
          criado_por_id: string | null
          data_publicacao: string | null
          id: string
          publicado: boolean
          publico_admin: boolean
          publico_cliente: boolean
          publico_vendedor: boolean
          tipo: string
          titulo: string
          updated_at: string
          versao: string | null
        }
        Insert: {
          conteudo: string
          created_at?: string
          criado_por_id?: string | null
          data_publicacao?: string | null
          id?: string
          publicado?: boolean
          publico_admin?: boolean
          publico_cliente?: boolean
          publico_vendedor?: boolean
          tipo?: string
          titulo: string
          updated_at?: string
          versao?: string | null
        }
        Update: {
          conteudo?: string
          created_at?: string
          criado_por_id?: string | null
          data_publicacao?: string | null
          id?: string
          publicado?: boolean
          publico_admin?: boolean
          publico_cliente?: boolean
          publico_vendedor?: boolean
          tipo?: string
          titulo?: string
          updated_at?: string
          versao?: string | null
        }
        Relationships: []
      }
      onboarding_progresso: {
        Row: {
          chave: string
          created_at: string
          id: string
          passo_parou: number | null
          status: string
          user_id: string
        }
        Insert: {
          chave: string
          created_at?: string
          id?: string
          passo_parou?: number | null
          status?: string
          user_id: string
        }
        Update: {
          chave?: string
          created_at?: string
          id?: string
          passo_parou?: number | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      pagamentos: {
        Row: {
          asaas_payment_id: string | null
          asaas_subscription_id: string | null
          cliente_id: string
          created_at: string
          data_pagamento: string | null
          id: string
          invoice_url: string | null
          status: Database["public"]["Enums"]["pagamento_status"]
          updated_at: string
          valor: number
        }
        Insert: {
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          cliente_id: string
          created_at?: string
          data_pagamento?: string | null
          id?: string
          invoice_url?: string | null
          status?: Database["public"]["Enums"]["pagamento_status"]
          updated_at?: string
          valor?: number
        }
        Update: {
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          cliente_id?: string
          created_at?: string
          data_pagamento?: string | null
          id?: string
          invoice_url?: string | null
          status?: Database["public"]["Enums"]["pagamento_status"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      planos: {
        Row: {
          asaas_subscription_id: string | null
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
          valor: number
        }
        Insert: {
          asaas_subscription_id?: string | null
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
          valor?: number
        }
        Update: {
          asaas_subscription_id?: string | null
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          nome: string
          novidades_vistas_em: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          nome?: string
          novidades_vistas_em?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string
          novidades_vistas_em?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      referral_visitas: {
        Row: {
          codigo: string
          created_at: string
          id: string
          session_id: string
          vendedor_id: string
        }
        Insert: {
          codigo: string
          created_at?: string
          id?: string
          session_id: string
          vendedor_id: string
        }
        Update: {
          codigo?: string
          created_at?: string
          id?: string
          session_id?: string
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_visitas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      tarefa_anexos: {
        Row: {
          autor_id: string
          comentario_id: string
          created_at: string
          id: string
          mime: string
          nome: string
          path: string
          tamanho: number
          tarefa_id: string
        }
        Insert: {
          autor_id: string
          comentario_id: string
          created_at?: string
          id?: string
          mime?: string
          nome: string
          path: string
          tamanho: number
          tarefa_id: string
        }
        Update: {
          autor_id?: string
          comentario_id?: string
          created_at?: string
          id?: string
          mime?: string
          nome?: string
          path?: string
          tamanho?: number
          tarefa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_anexos_comentario_id_fkey"
            columns: ["comentario_id"]
            isOneToOne: false
            referencedRelation: "tarefa_comentarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_anexos_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefa_comentarios: {
        Row: {
          autor_id: string
          corpo: string
          created_at: string
          id: string
          interno: boolean
          tarefa_id: string
          updated_at: string
        }
        Insert: {
          autor_id: string
          corpo: string
          created_at?: string
          id?: string
          interno?: boolean
          tarefa_id: string
          updated_at?: string
        }
        Update: {
          autor_id?: string
          corpo?: string
          created_at?: string
          id?: string
          interno?: boolean
          tarefa_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_comentarios_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          categoria: string | null
          cliente_id: string | null
          cliente_user_id: string | null
          concluida_em: string | null
          created_at: string
          criado_por_id: string | null
          dados: Json | null
          descricao: string | null
          id: string
          origem: Database["public"]["Enums"]["tarefa_origem"]
          plano_id: string | null
          prazo: string | null
          prioridade: Database["public"]["Enums"]["tarefa_prioridade"]
          responsavel_id: string | null
          status: Database["public"]["Enums"]["tarefa_status"]
          titulo: string
          updated_at: string
          vendedor_id: string | null
        }
        Insert: {
          categoria?: string | null
          cliente_id?: string | null
          cliente_user_id?: string | null
          concluida_em?: string | null
          created_at?: string
          criado_por_id?: string | null
          dados?: Json | null
          descricao?: string | null
          id?: string
          origem?: Database["public"]["Enums"]["tarefa_origem"]
          plano_id?: string | null
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["tarefa_prioridade"]
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["tarefa_status"]
          titulo: string
          updated_at?: string
          vendedor_id?: string | null
        }
        Update: {
          categoria?: string | null
          cliente_id?: string | null
          cliente_user_id?: string | null
          concluida_em?: string | null
          created_at?: string
          criado_por_id?: string | null
          dados?: Json | null
          descricao?: string | null
          id?: string
          origem?: Database["public"]["Enums"]["tarefa_origem"]
          plano_id?: string | null
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["tarefa_prioridade"]
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["tarefa_status"]
          titulo?: string
          updated_at?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      termos_aceites: {
        Row: {
          aceito_em: string
          created_at: string
          email: string | null
          id: string
          origem: string
          texto: string
          user_id: string
          versao: string
        }
        Insert: {
          aceito_em?: string
          created_at?: string
          email?: string | null
          id?: string
          origem?: string
          texto: string
          user_id: string
          versao: string
        }
        Update: {
          aceito_em?: string
          created_at?: string
          email?: string | null
          id?: string
          origem?: string
          texto?: string
          user_id?: string
          versao?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendedores: {
        Row: {
          ativo: boolean
          cnaes: string[]
          codigo_indicacao: string
          created_at: string
          estados: string[]
          id: string
          percentual_comissao: number
          segmentos: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          cnaes?: string[]
          codigo_indicacao: string
          created_at?: string
          estados?: string[]
          id?: string
          percentual_comissao?: number
          segmentos?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          cnaes?: string[]
          codigo_indicacao?: string
          created_at?: string
          estados?: string[]
          id?: string
          percentual_comissao?: number
          segmentos?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_telemetria_alertas: {
        Args: {
          _base_horas?: number
          _janela_horas?: number
          _minimo_incidentes?: number
        }
        Returns: {
          app_version: string
          eventos_base: number
          eventos_janela: number
          fator: number
          incidentes_base: number
          incidentes_janela: number
          rota: string
          severidade: string
          taxa_base: number
          taxa_janela: number
          ultima: string
          ultimo_erro: string
        }[]
      }
      auth_telemetria_resumo: {
        Args: { _dias?: number }
        Returns: {
          app_version: string
          erros: number
          p50_ms: number
          p95_ms: number
          rota: string
          sem_papel: number
          tipo: string
          total: number
          ultima: string
        }[]
      }
      auth_telemetria_trace: {
        Args: { _trace_id: string }
        Returns: {
          app_version: string
          created_at: string
          duracao_ms: number
          erro: string
          id: string
          motivo: string
          papel: string
          rota: string
          tipo: string
          user_id: string
        }[]
      }
      avisar_leads_a_devolver: { Args: { _dias?: number }; Returns: number }
      current_vendedor_id: { Args: never; Returns: string }
      devolver_banco_lead: {
        Args: { _automatico?: boolean; _id: string }
        Returns: string
      }
      devolver_leads_abandonados: { Args: { _dias?: number }; Returns: number }
      has_permission: {
        Args: {
          _permission: Database["public"]["Enums"]["app_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      lead_proximo_follow_up: {
        Args: {
          _base?: string
          _estagio: Database["public"]["Enums"]["lead_estagio"]
          _tentativas: number
        }
        Returns: string
      }
      pode_ver_banco_lead: {
        Args: {
          _reservado_cnae: string
          _reservado_estado: string
          _reservado_segmento: string
        }
        Returns: boolean
      }
      pode_ver_conversa: { Args: { _conversa_id: string }; Returns: boolean }
      puxar_banco_leads: {
        Args: { _ids: string[] }
        Returns: {
          banco_lead_id: string
          lead_id: string
          resultado: string
        }[]
      }
      saldo_puxadas: {
        Args: never
        Returns: {
          limite: number
          renova_em: string
          restante: number
        }[]
      }
    }
    Enums: {
      app_permission:
        | "clientes.ler"
        | "clientes.criar"
        | "clientes.editar"
        | "clientes.excluir"
        | "vendedores.ler"
        | "vendedores.criar"
        | "vendedores.editar"
        | "vendedores.excluir"
        | "planos.gerenciar"
        | "pagamentos.ler"
        | "pagamentos.editar_status"
        | "configuracoes.gerenciar"
        | "asaas.sincronizar"
        | "novidades.gerenciar"
        | "auditoria.ler"
        | "cupons.gerenciar"
      app_role: "cliente" | "vendedor" | "admin"
      asaas_ambiente: "producao" | "sandbox"
      banco_lead_status: "disponivel" | "puxado" | "arquivado"
      cliente_status: "ativo" | "vencido" | "inadimplente" | "cancelado"
      conversa_tipo: "equipe" | "atendimento"
      lead_estagio:
        | "contatado"
        | "interessado"
        | "nao_interessado"
        | "em_negociacao"
        | "ganho"
        | "perdido"
      lead_origem:
        | "prospeccao_ativa"
        | "indicacao"
        | "inbound"
        | "evento"
        | "rede_social"
        | "outro"
      pagamento_status: "pago" | "pendente" | "vencido" | "simulacao"
      reuniao_status:
        | "marcada"
        | "realizada"
        | "remarcada"
        | "no_show"
        | "cancelada"
      tarefa_origem: "plano" | "solicitacao_cliente" | "manual"
      tarefa_prioridade: "baixa" | "media" | "alta"
      tarefa_status:
        | "aberta"
        | "em_andamento"
        | "concluida"
        | "cancelada"
        | "aguardando_cliente"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_permission: [
        "clientes.ler",
        "clientes.criar",
        "clientes.editar",
        "clientes.excluir",
        "vendedores.ler",
        "vendedores.criar",
        "vendedores.editar",
        "vendedores.excluir",
        "planos.gerenciar",
        "pagamentos.ler",
        "pagamentos.editar_status",
        "configuracoes.gerenciar",
        "asaas.sincronizar",
        "novidades.gerenciar",
        "auditoria.ler",
        "cupons.gerenciar",
      ],
      app_role: ["cliente", "vendedor", "admin"],
      asaas_ambiente: ["producao", "sandbox"],
      banco_lead_status: ["disponivel", "puxado", "arquivado"],
      cliente_status: ["ativo", "vencido", "inadimplente", "cancelado"],
      conversa_tipo: ["equipe", "atendimento"],
      lead_estagio: [
        "contatado",
        "interessado",
        "nao_interessado",
        "em_negociacao",
        "ganho",
        "perdido",
      ],
      lead_origem: [
        "prospeccao_ativa",
        "indicacao",
        "inbound",
        "evento",
        "rede_social",
        "outro",
      ],
      pagamento_status: ["pago", "pendente", "vencido", "simulacao"],
      reuniao_status: [
        "marcada",
        "realizada",
        "remarcada",
        "no_show",
        "cancelada",
      ],
      tarefa_origem: ["plano", "solicitacao_cliente", "manual"],
      tarefa_prioridade: ["baixa", "media", "alta"],
      tarefa_status: [
        "aberta",
        "em_andamento",
        "concluida",
        "cancelada",
        "aguardando_cliente",
      ],
    },
  },
} as const
