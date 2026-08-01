// Helpers de 2FA (TOTP) usados no navegador.
//
// Decisão de segurança: o único fator aceito é TOTP (app autenticador).
// SMS NÃO é usado como fator — está sujeito a troca de chip (SIM swap) e a
// interceptação. O telefone guardado no perfil serve apenas para o suporte
// confirmar a identidade quando o usuário perde o acesso, nunca para autenticar.

import { supabase } from "@/integrations/supabase/client";

export const MFA_NOME_FATOR = "Brazon TOTP";

export interface FatorTotp {
  id: string;
  nome: string | null;
  verificado: boolean;
}

/** Lista os fatores TOTP do usuário atual. */
export async function listarFatoresTotp(): Promise<FatorTotp[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return (data?.totp ?? []).map((f) => ({
    id: f.id,
    nome: f.friendly_name ?? null,
    verificado: f.status === "verified",
  }));
}

export interface NivelSeguranca {
  atual: "aal1" | "aal2" | null;
  proximo: "aal1" | "aal2" | null;
  /** true quando existe fator verificado e a sessão ainda não passou por ele. */
  precisaSegundoFator: boolean;
}

/** Lê o nível de garantia (AAL) da sessão atual. */
export async function lerNivelSeguranca(): Promise<NivelSeguranca> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  const atual = (data?.currentLevel ?? null) as NivelSeguranca["atual"];
  const proximo = (data?.nextLevel ?? null) as NivelSeguranca["proximo"];
  return { atual, proximo, precisaSegundoFator: proximo === "aal2" && atual !== "aal2" };
}

export interface CadastroTotp {
  factorId: string;
  qrCode: string;
  segredo: string;
  uri: string;
}

/**
 * Inicia o cadastro de um novo fator TOTP. Antes de criar, remove fatores
 * antigos não verificados — tentativas abandonadas ficariam presas no nome.
 */
export async function iniciarCadastroTotp(): Promise<CadastroTotp> {
  const fatores = await listarFatoresTotp();
  for (const f of fatores.filter((x) => !x.verificado)) {
    await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `${MFA_NOME_FATOR} ${Date.now()}`,
  });
  if (error) throw error;
  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    segredo: data.totp.secret,
    uri: data.totp.uri,
  };
}

/** Confirma um código de 6 dígitos para um fator (cadastro ou login). */
export async function verificarCodigoTotp(factorId: string, codigo: string): Promise<void> {
  const { data: desafio, error: erroDesafio } = await supabase.auth.mfa.challenge({ factorId });
  if (erroDesafio) throw erroDesafio;
  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: desafio.id,
    code: codigo.replace(/\D/g, ""),
  });
  if (error) throw error;
}

/** Remove um fator TOTP (desativa a verificação em duas etapas). */
export async function removerFatorTotp(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}

/** Mensagem amigável para os erros mais comuns do fluxo de 2FA. */
export function mensagemErroMfa(erro: unknown): string {
  const msg = erro instanceof Error ? erro.message : String(erro);
  if (/invalid|incorrect|expired/i.test(msg)) {
    return "Código inválido ou expirado. Confira o app autenticador e tente o próximo código.";
  }
  if (/rate|too many/i.test(msg)) {
    return "Muitas tentativas. Aguarde alguns instantes e tente novamente.";
  }
  return "Não foi possível concluir a verificação em duas etapas. Tente novamente.";
}
