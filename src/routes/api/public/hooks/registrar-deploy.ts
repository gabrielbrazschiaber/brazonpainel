import { createFileRoute } from '@tanstack/react-router';
import { algumSegredoConfere } from '@/lib/token-compare.server';
import { registrarAuditoria } from '@/lib/audit.server';
import { COMMITS_IGNORADOS, calcularVersao, Commit } from '@/lib/changelog';

export const Route = createFileRoute('/api/public/hooks/registrar-deploy')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        
        // 1. Validar Token
        const tokenEnviado = request.headers.get('x-deploy-token') || 
                            request.headers.get('Authorization')?.replace('Bearer ', '');
        
        const { data: cfg } = await supabaseAdmin
          .from('configuracoes')
          .select('id, changelog_token, changelog_ativo, changelog_versao_atual')
          .limit(1)
          .single();

        if (!cfg?.changelog_token) {
          return new Response(JSON.stringify({ error: 'Webhook token not configured' }), { status: 503 });
        }

        if (!tokenEnviado || !algumSegredoConfere(tokenEnviado, [cfg.changelog_token])) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }

        if (!cfg.changelog_ativo) {
          return new Response(JSON.stringify({ ok: true, ignorado: true, motivo: 'Changelog inativo' }));
        }

        // 2. Processar Payload
        const body = await request.json();
        const { sha, branch, commits, arquivos_alterados } = body as { 
          sha: string; 
          branch: string; 
          commits: Commit[]; 
          arquivos_alterados: string[] 
        };

        if (branch !== 'main') {
          return new Response(JSON.stringify({ ok: true, ignorado: true, motivo: 'Branch não é main' }));
        }

        // Idempotência
        const { data: existe } = await supabaseAdmin
          .from('deploys')
          .select('id, status')
          .eq('sha', sha)
          .maybeSingle();

        if (existe) {
          return new Response(JSON.stringify({ ok: true, jaProcessado: true }));
        }

        // Filtrar commits de ruído
        const commitsRelevantes = commits.filter(c => !COMMITS_IGNORADOS.test(c.mensagem));
        
        if (commitsRelevantes.length === 0) {
          await supabaseAdmin.from('deploys').insert({
            sha,
            versao: cfg.changelog_versao_atual,
            commits: commits as any,
            arquivos_alterados,
            status: 'ignorado'
          });
          return new Response(JSON.stringify({ ok: true, ignorado: true, motivo: 'Nenhum commit relevante' }));
        }

        // 3. Registrar e Iniciar Processamento
        const novaVersao = calcularVersao(cfg.changelog_versao_atual, commitsRelevantes);
        
        const { data: deploy, error: errInsert } = await supabaseAdmin
          .from('deploys')
          .insert({
            sha,
            versao: novaVersao,
            commits: commits as any,
            arquivos_alterados,
            status: 'pendente'
          })
          .select()
          .single();

        if (errInsert) {
          return new Response(JSON.stringify({ error: errInsert.message }), { status: 500 });
        }

        // Executar processamento (IA + Publicação)
        // Como o TanStack Start handler precisa responder, mas queremos processar em background
        // Em ambientes serverless (Cloudflare), o processo pode morrer se não esperarmos.
        // Vamos processar e depois responder.
        
        try {
          const { gerarChangelogServer } = await import('@/lib/changelog.server');
          const resultadoIa = await gerarChangelogServer(commitsRelevantes, arquivos_alterados, novaVersao);

          if (!resultadoIa.relevante) {
            await supabaseAdmin
              .from('deploys')
              .update({ status: 'ignorado', resumo_ia: resultadoIa as any })
              .eq('id', deploy.id);
            return new Response(JSON.stringify({ ok: true, ignorado: true, versao: novaVersao }));
          }

          // Janela de agrupamento: 30 minutos
          const trintaMinutosAtras = new Date(Date.now() - 30 * 60 * 1000).toISOString();
          
          let novidadeIdPrincipal = null;
          const publicosAtingidos: string[] = [];

          for (const [pome, config] of Object.entries(resultadoIa.publicos)) {
            if (!config.incluir || config.itens.length === 0) continue;

            publicosAtingidos.push(pome);

            // Tenta encontrar novidade recente para o mesmo público
            const colPublico = `publico_${pome}`;
            const { data: novidadeExistente } = await supabaseAdmin
              .from('novidades')
              .select('id, conteudo')
              .eq(colPublico, true)
              .eq('publico_cliente', pome === 'cliente')
              .eq('publico_vendedor', pome === 'vendedor')
              .eq('publico_admin', pome === 'admin')
              .gt('created_at', trintaMinutosAtras)
              .eq('publicado', true)
              .eq('tipo', 'novidade')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            const novoConteudo = formatarConteudoMarkdown(config.itens);

            if (novidadeExistente) {
              await supabaseAdmin
                .from('novidades')
                .update({
                  conteudo: novidadeExistente.conteudo + '\n\n' + novoConteudo,
                  versao: novaVersao
                })
                .eq('id', novidadeExistente.id);
              if (!novidadeIdPrincipal) novidadeIdPrincipal = novidadeExistente.id;
            } else {
              const { data: novaNovidade } = await supabaseAdmin
                .from('novidades')
                .insert({
                  titulo: resultadoIa.titulo,
                  conteudo: novoConteudo,
                  versao: novaVersao,
                  tipo: 'novidade',
                  publico_cliente: pome === 'cliente',
                  publico_vendedor: pome === 'vendedor',
                  publico_admin: pome === 'admin',
                  publicado: true,
                  data_publicacao: new Date().toISOString()
                })
                .select()
                .single();
              if (novaNovidade && !novidadeIdPrincipal) novidadeIdPrincipal = novaNovidade.id;
            }
          }

          // Finalizar deploy
          await supabaseAdmin
            .from('deploys')
            .update({ 
              status: 'processado', 
              processado_em: new Date().toISOString(),
              novidade_id: novidadeIdPrincipal,
              resumo_ia: resultadoIa as any
            })
            .eq('id', deploy.id);

          // Atualizar versão global
          await supabaseAdmin
            .from('configuracoes')
            .update({ changelog_versao_atual: novaVersao })
            .eq('id', cfg.id);

          await registrarAuditoria({
            acao: 'changelog_publicado_automaticamente',
            entidade: 'deploy',
            entidadeId: deploy.id,
            detalhes: { sha, versao: novaVersao, publicos: publicosAtingidos }
          });

          return new Response(JSON.stringify({ ok: true, versao: novaVersao, publicos: publicosAtingidos }));
        } catch (error) {
          const msgErro = error instanceof Error ? error.message : 'Erro no processamento do changelog';
          await supabaseAdmin
            .from('deploys')
            .update({ status: 'erro', erro: msgErro })
            .eq('id', deploy.id);
          
          return new Response(JSON.stringify({ ok: true, status: 'erro', erro: msgErro }));
        }
      }
    }
  }
});

function formatarConteudoMarkdown(itens: { tipo: string; texto: string }[]): string {
  const grupos: Record<string, string[]> = {
    novidade: [],
    melhoria: [],
    correcao: []
  };

  itens.forEach(i => {
    if (grupos[i.tipo]) grupos[i.tipo].push(i.texto);
  });

  let md = '';
  if (grupos.novidade.length > 0) md += `### Novidades\n${grupos.novidade.map(t => `- ${t}`).join('\n')}\n\n`;
  if (grupos.melhoria.length > 0) md += `### Melhorias\n${grupos.melhoria.map(t => `- ${t}`).join('\n')}\n\n`;
  if (grupos.correcao.length > 0) md += `### Correções\n${grupos.correcao.map(t => `- ${t}`).join('\n')}\n\n`;
  
  return md.trim();
}
