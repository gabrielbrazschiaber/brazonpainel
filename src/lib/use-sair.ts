import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

/**
 * Hook central de logout.
 *
 * Responsabilidades (nesta ordem, para evitar erros 401 e vazamento de cache):
 * 1. cancela as consultas em andamento;
 * 2. limpa o cache do React Query (dados protegidos);
 * 3. encerra a sessão no backend e limpa o contexto de auth;
 * 4. navega para /login com `replace` (sem recarregar a página e sem deixar a
 *    tela protegida no histórico do navegador).
 *
 * Use sempre este hook (ou o componente <SairButton />) em vez de chamar
 * `signOut()` diretamente, para que o comportamento seja igual em todas as telas.
 */
export function useSair() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saindo, setSaindo] = useState(false);

  const sair = useCallback(async () => {
    if (saindo) return;
    setSaindo(true);
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await signOut();
      toast.success("Você saiu da sua conta.");
    } catch {
      toast.error("Não foi possível encerrar a sessão. Tente novamente.");
    } finally {
      setSaindo(false);
      await navigate({ to: "/login", replace: true });
    }
  }, [saindo, queryClient, signOut, navigate]);

  return { sair, saindo };
}
