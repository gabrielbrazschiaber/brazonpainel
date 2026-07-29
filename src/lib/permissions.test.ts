import { describe, it, expect, vi } from "vitest";
import { ensurePermission, hasPermission } from "@/lib/permissions.guard";
import {
  PERMISSOES_BLOQUEADAS,
  TODAS_PERMISSOES,
  CATALOGO_PERMISSOES,
} from "@/lib/permissions";

function clienteFake(resposta: boolean | null, erro: unknown = null) {
  return {
    rpc: vi.fn().mockResolvedValue({ data: resposta, error: erro }),
  };
}

describe("controle de acesso — cenários de negativa", () => {
  it("recusa quando o usuário não tem a permissão", async () => {
    const sb = clienteFake(false);
    await expect(
      ensurePermission(sb, "user-1", "clientes.excluir"),
    ).rejects.toThrow(/Acesso negado/);
  });

  it("recusa quando a verificação falha (fail-closed)", async () => {
    const sb = clienteFake(null, { message: "boom" });
    await expect(
      ensurePermission(sb, "user-1", "configuracoes.gerenciar"),
    ).rejects.toThrow(/Acesso negado/);
  });

  it("recusa quando o retorno não é exatamente true", async () => {
    for (const valor of [null, undefined, 1, "true", {}] as unknown[]) {
      const sb = { rpc: vi.fn().mockResolvedValue({ data: valor, error: null }) };
      await expect(
        ensurePermission(sb, "user-1", "planos.gerenciar"),
      ).rejects.toThrow(/Acesso negado/);
    }
  });

  it("permite quando a permissão existe", async () => {
    const sb = clienteFake(true);
    await expect(
      ensurePermission(sb, "user-1", "clientes.criar"),
    ).resolves.toBeUndefined();
    expect(sb.rpc).toHaveBeenCalledWith("has_permission", {
      _user_id: "user-1",
      _permission: "clientes.criar",
    });
  });

  it("hasPermission nunca lança e devolve false em erro", async () => {
    const sb = clienteFake(null, { message: "erro" });
    await expect(hasPermission(sb, "u", "auditoria.ler")).resolves.toBe(false);
  });

  it("a verificação usa o id do token, não um id vindo do pedido", async () => {
    const sb = clienteFake(true);
    await ensurePermission(sb, "id-do-token", "clientes.editar");
    const args = sb.rpc.mock.calls[0][1];
    expect(args._user_id).toBe("id-do-token");
  });
});

describe("catálogo de permissões", () => {
  it("admin não pode perder o acesso às configurações", () => {
    expect(PERMISSOES_BLOQUEADAS.admin).toContain("configuracoes.gerenciar");
  });

  it("não há permissões duplicadas no catálogo", () => {
    expect(new Set(TODAS_PERMISSOES).size).toBe(TODAS_PERMISSOES.length);
  });

  it("toda permissão tem rótulo e descrição legíveis", () => {
    for (const grupo of CATALOGO_PERMISSOES) {
      for (const item of grupo.itens) {
        expect(item.label.length).toBeGreaterThan(2);
        expect(item.descricao.length).toBeGreaterThan(5);
      }
    }
  });
});
