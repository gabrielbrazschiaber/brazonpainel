import type { Sb } from "@/lib/leads-base.server";

export async function listarMensagensRapidasServer(supabase: Sb) {
  const { data, error } = await supabase
    .from("mensagens_rapidas")
    .select("*")
    .order("ordem", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function salvarMensagemRapidaServer(supabase: Sb, dados: { id?: string; texto: string; ordem: number }) {
  const payload = {
    texto: dados.texto,
    ordem: dados.ordem,
  };

  if (dados.id) {
    const { data, error } = await supabase
      .from("mensagens_rapidas")
      .update(payload)
      .eq("id", dados.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  } else {
    const { data, error } = await supabase
      .from("mensagens_rapidas")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }
}

export async function excluirMensagemRapidaServer(supabase: Sb, id: string) {
  const { error } = await supabase
    .from("mensagens_rapidas")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}
