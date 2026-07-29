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
      configuracoes: {
        Row: {
          asaas_ambiente: Database["public"]["Enums"]["asaas_ambiente"]
          asaas_api_key: string | null
          asaas_webhook_url: string | null
          created_at: string
          cron_token: string
          dias_aviso_vencimento: number
          dominio: string | null
          id: string
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
          dominio?: string | null
          id?: string
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
          dominio?: string | null
          id?: string
          nome_app?: string
          percentual_comissao_padrao?: number
          updated_at?: string
        }
        Relationships: []
      }
      cupom_usos: {
        Row: {
          asaas_payment_id: string | null
          cliente_id: string
          created_at: string
          cupom_id: string
          id: string
          pagamento_id: string | null
          user_id: string | null
          valor_desconto: number
        }
        Insert: {
          asaas_payment_id?: string | null
          cliente_id: string
          created_at?: string
          cupom_id: string
          id?: string
          pagamento_id?: string | null
          user_id?: string | null
          valor_desconto?: number
        }
        Update: {
          asaas_payment_id?: string | null
          cliente_id?: string
          created_at?: string
          cupom_id?: string
          id?: string
          pagamento_id?: string | null
          user_id?: string | null
          valor_desconto?: number
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
        }
        Relationships: []
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
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          nome?: string
          novidades_vistas_em?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string
          novidades_vistas_em?: string | null
          updated_at?: string
        }
        Relationships: []
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
          codigo_indicacao: string
          created_at: string
          id: string
          percentual_comissao: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          codigo_indicacao: string
          created_at?: string
          id?: string
          percentual_comissao?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          codigo_indicacao?: string
          created_at?: string
          id?: string
          percentual_comissao?: number
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
      current_vendedor_id: { Args: never; Returns: string }
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
      cliente_status: "ativo" | "vencido" | "inadimplente" | "cancelado"
      pagamento_status: "pago" | "pendente" | "vencido" | "simulacao"
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
      cliente_status: ["ativo", "vencido", "inadimplente", "cancelado"],
      pagamento_status: ["pago", "pendente", "vencido", "simulacao"],
    },
  },
} as const
