/**
 * Catálogo do onboarding do BRAZON (client-safe).
 *
 * Fonte única de conteúdo dos tutoriais guiados, dos resumos de ajuda de cada
 * tela e dos textos de ajuda dos campos de formulário. Os textos citam as
 * telas, abas e rótulos que realmente existem no sistema.
 */

import type { AppRole } from "@/lib/permissions";

export interface PassoTutorial {
  /** Seletor CSS de um elemento marcado com data-tour; ausente = passo centrado. */
  alvo?: string;
  titulo: string;
  corpo: string;
  posicao?: "top" | "bottom" | "left" | "right";
  /** Quando presente, o passo só aparece para quem tem esta permissão. */
  permissao?: string;
}

export interface Tutorial {
  /** 'boas_vindas' ou 'tela:<chave>' */
  chave: string;
  titulo: string;
  papeis: readonly AppRole[];
  /** Rota que dispara o tutorial na primeira visita. */
  rota?: string;
  passos: PassoTutorial[];
}

export const CHAVE_BOAS_VINDAS = "boas_vindas";

/* ------------------------------------------------------------------ */
/* Boas-vindas                                                         */
/* ------------------------------------------------------------------ */

const BOAS_VINDAS_ADMIN: Tutorial = {
  chave: CHAVE_BOAS_VINDAS,
  titulo: "Bem-vindo à administração do BRAZON",
  papeis: ["admin"],
  passos: [
    {
      titulo: "Você administra o sistema todo",
      corpo:
        "Aqui você acompanha as assinaturas, cuida da equipe de vendas e configura as regras de cobrança. Vamos ver os menus em um minuto.",
    },
    {
      alvo: '[data-tour="nav-dashboard"]',
      titulo: "Dashboard",
      corpo:
        "Visão geral do negócio: indicadores do mês, alertas de vencimento, ranking de vendedores e receita mensal (MRR).",
      posicao: "right",
    },
    {
      alvo: '[data-tour="nav-clientes"]',
      titulo: "Clientes",
      corpo:
        "Lista completa de assinantes com status, plano e vencimento. É daqui que você edita um cadastro ou reprocessa a sincronização da cobrança.",
      posicao: "right",
    },
    {
      alvo: '[data-tour="nav-tarefas"]',
      titulo: "Tarefas",
      corpo:
        "Fila de trabalho da equipe. Cada novo cliente gera uma tarefa, e as solicitações enviadas pelos clientes caem aqui também.",
      posicao: "right",
    },
    {
      alvo: '[data-tour="nav-comercial"]',
      titulo: "Comercial",
      corpo:
        "Gestão de leads: funil, reuniões e a fila de follow-up. O número vermelho mostra follow-ups atrasados e de hoje.",
      posicao: "right",
    },
    {
      alvo: '[data-tour="nav-novidades"]',
      titulo: "Novidades",
      corpo:
        "Publique comunicados que aparecem no sino de avisos dos usuários. Bom para avisar sobre manutenção ou recursos novos.",
      posicao: "right",
    },
    {
      alvo: '[data-tour="nav-config"]',
      titulo: "Configurações",
      corpo:
        "Reúne Cupons, Planos, Admins, Vendedores, Permissões, Geral e integrações, Auditoria e Acesso e sessão.",
      posicao: "right",
    },
    {
      alvo: '[data-tour="nav-chat"]',
      titulo: "Chat com a equipe",
      corpo:
        "Conversa interna com vendedores e o suporte aos clientes. O contador mostra mensagens não lidas.",
      posicao: "right",
    },
    {
      alvo: '[data-tour="avisos"]',
      titulo: "Avisos e novidades",
      corpo:
        "O sino junta notificações do sistema (tarefas, mensagens) e os comunicados publicados em Novidades.",
      posicao: "bottom",
    },
    {
      alvo: '[data-tour="nav-conta"]',
      titulo: "Minha conta",
      corpo:
        "Altere seu nome, e-mail e senha. É lá também que fica o botão \"Rever tutoriais\" se você quiser ver tudo de novo.",
      posicao: "right",
    },
  ],
};

const BOAS_VINDAS_VENDEDOR: Tutorial = {
  chave: CHAVE_BOAS_VINDAS,
  titulo: "Bem-vindo ao painel do vendedor",
  papeis: ["vendedor"],
  passos: [
    {
      titulo: "Seu painel de vendas",
      corpo:
        "Aqui você prospecta leads, cadastra clientes e acompanha sua carteira e sua comissão estimada.",
    },
    {
      alvo: '[data-tour="acao-principal"]',
      titulo: "Cadastrar cliente",
      corpo:
        "Este é o atalho para criar um cliente com login próprio. O cliente recebe um e-mail para definir a senha dele.",
      posicao: "right",
    },
    {
      alvo: '[data-tour="nav-painel"]',
      titulo: "Painel",
      corpo:
        "Total de clientes, ativos, a vencer e vencidos, além da comissão estimada sobre as assinaturas ativas.",
      posicao: "right",
    },
    {
      alvo: '[data-tour="nav-comercial"]',
      titulo: "Comercial",
      corpo:
        "Sua prospecção: cadastre leads, mova pelo funil (de Contatado até Ganho) e trabalhe a fila de follow-up do dia.",
      posicao: "right",
    },
    {
      alvo: '[data-tour="nav-tarefas"]',
      titulo: "Tarefas",
      corpo:
        "O que precisa da sua ação: contratações novas e solicitações dos seus clientes. Mude o status conforme avança.",
      posicao: "right",
    },
    {
      alvo: '[data-tour="nav-indicacoes"]',
      titulo: "Indicações",
      corpo:
        "Seu link de indicação. Quem se cadastrar por ele já entra vinculado a você, e a comissão conta para a sua carteira.",
      posicao: "right",
    },
    {
      alvo: '[data-tour="nav-cupons"]',
      titulo: "Meus cupons",
      corpo:
        "Cupons de desconto que você pode oferecer. O desconto vale apenas na primeira mensalidade.",
      posicao: "right",
    },
    {
      alvo: '[data-tour="nav-clientes"]',
      titulo: "Meus clientes",
      corpo:
        "Sua carteira, com status e vencimento de cada assinatura. É onde você edita dados e deixa recados para o cliente.",
      posicao: "right",
    },
    {
      alvo: '[data-tour="nav-chat"]',
      titulo: "Chat com a equipe",
      corpo:
        "Fale com a administração e atenda os clientes sem sair do painel.",
      posicao: "right",
    },
  ],
};

const BOAS_VINDAS_CLIENTE: Tutorial = {
  chave: CHAVE_BOAS_VINDAS,
  titulo: "Bem-vindo à sua área de assinatura",
  papeis: ["cliente"],
  passos: [
    {
      titulo: "Sua assinatura em um lugar só",
      corpo:
        "Nesta área você vê o status da sua assinatura, paga as faturas e pede o que precisar para a nossa equipe.",
    },
    {
      alvo: '[data-tour="nav-assinatura"]',
      titulo: "Minha assinatura",
      corpo:
        "Status, plano contratado, próximo vencimento e o histórico de faturas com o link de pagamento.",
      posicao: "right",
    },
    {
      alvo: '[data-tour="nav-solicitacoes"]',
      titulo: "Solicitações",
      corpo:
        "Precisa mudar de plano, alterar o vencimento ou pedir a segunda via? É por aqui, e a equipe recebe na hora.",
      posicao: "right",
    },
    {
      alvo: '[data-tour="nav-aceites"]',
      titulo: "Meus aceites",
      corpo:
        "Histórico das versões do Termo de Uso que você aceitou, com data e hora.",
      posicao: "right",
    },
    {
      alvo: '[data-tour="nav-chat"]',
      titulo: "Chat",
      corpo: "Fale direto com o suporte quando tiver alguma dúvida rápida.",
      posicao: "right",
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Tours por tela                                                      */
/* ------------------------------------------------------------------ */

const TELA_ADMIN_DASHBOARD: Tutorial = {
  chave: "tela:admin-dashboard",
  titulo: "Dashboard da administração",
  papeis: ["admin"],
  passos: [
    {
      alvo: '[data-tour="dash-kpis"]',
      titulo: "Indicadores do período",
      corpo:
        "Assinaturas ativas, receita mensal, novos clientes e churn. Use o seletor de período para comparar meses.",
      posicao: "bottom",
    },
    {
      alvo: '[data-tour="dash-alertas"]',
      titulo: "Alertas e ações urgentes",
      corpo:
        "Vencimentos próximos, inadimplência e falhas de sincronização. Trate primeiro o que está aqui.",
      posicao: "bottom",
    },
    {
      alvo: '[data-tour="dash-ranking"]',
      titulo: "Ranking de vendedores",
      corpo:
        "Quem trouxe mais clientes no período. Serve para acompanhar a equipe e revisar comissões.",
      posicao: "left",
    },
    {
      alvo: '[data-tour="dash-graficos"]',
      titulo: "Receita mensal e clientes por status",
      corpo:
        "Os gráficos mostram a evolução do MRR e a distribuição entre ativos, a vencer e vencidos.",
      posicao: "top",
    },
    {
      alvo: '[data-tour="dash-webhooks"]',
      titulo: "Logs de webhook Asaas",
      corpo:
        "Registro do que a plataforma de pagamento envia de volta. Se um pagamento não apareceu, comece a investigação aqui.",
      posicao: "top",
    },
  ],
};

const TELA_ADMIN_CLIENTES: Tutorial = {
  chave: "tela:admin-clientes",
  titulo: "Clientes",
  papeis: ["admin"],
  passos: [
    {
      alvo: '[data-tour="clientes-filtros"]',
      titulo: "Busca e filtros",
      corpo:
        "Filtre por nome, e-mail, status ou vendedor responsável para achar um cadastro rápido.",
      posicao: "bottom",
    },
    {
      alvo: '[data-tour="clientes-lista"]',
      titulo: "O que cada status significa",
      corpo:
        "Ativo: em dia. Vencendo: perto do vencimento. Vencido e inadimplente: cobrança em aberto e acesso em risco.",
      posicao: "top",
    },
    {
      alvo: '[data-tour="clientes-lista"]',
      titulo: "Editar cadastro",
      corpo:
        "Ao editar plano, serviço extra ou valor, a assinatura recorrente é atualizada na plataforma de pagamento.",
      posicao: "top",
    },
    {
      alvo: '[data-tour="clientes-lista"]',
      titulo: "Reprocessar sincronização",
      corpo:
        "Use quando a assinatura ficou dessincronizada: o sistema tenta de novo, com novas tentativas automáticas em caso de falha.",
      posicao: "top",
    },
    {
      titulo: "Excluir é irreversível",
      corpo:
        "Excluir apaga o cadastro e o login do cliente. Só faça isso quando tiver certeza — não há como desfazer.",
    },
  ],
};

const TELA_ADMIN_CONFIG: Tutorial = {
  chave: "tela:admin-configuracoes",
  titulo: "Configurações",
  papeis: ["admin"],
  passos: [
    {
      alvo: '[data-tour="config-secoes"]',
      titulo: "As seções de Configurações",
      corpo:
        "Cada card abre uma área diferente. Você mexe aqui pouco e com cuidado: quase tudo afeta cobrança ou acesso.",
      posicao: "bottom",
    },
    {
      alvo: '[data-tour="config-secao-cupons"]',
      permissao: "cupons.gerenciar",
      titulo: "Cupons",
      corpo:
        "Crie e bloqueie descontos e veja o histórico de uso. O desconto vale só na primeira mensalidade.",
      posicao: "bottom",
    },
    {
      alvo: '[data-tour="config-secao-planos"]',
      permissao: "planos.gerenciar",
      titulo: "Planos",
      corpo:
        "Valores e disponibilidade. Mudar o valor de um plano muda a cobrança recorrente de quem o assina.",
      posicao: "bottom",
    },
    {
      alvo: '[data-tour="config-secao-admins"]',
      permissao: "vendedores.ler",
      titulo: "Admins",
      corpo: "Quem tem acesso administrativo. Mexa aqui só ao dar ou tirar acesso total.",
      posicao: "bottom",
    },
    {
      alvo: '[data-tour="config-secao-vendedores"]',
      permissao: "vendedores.ler",
      titulo: "Vendedores",
      corpo:
        "Cadastre a equipe de vendas, ajuste comissão e veja quem já concluiu o tutorial do sistema.",
      posicao: "bottom",
    },
    {
      alvo: '[data-tour="config-secao-permissoes"]',
      permissao: "configuracoes.gerenciar",
      titulo: "Permissões",
      corpo:
        "Define o que cada papel pode fazer. Use quando um vendedor precisar (ou deixar de precisar) de algo.",
      posicao: "bottom",
    },
    {
      alvo: '[data-tour="config-secao-geral"]',
      permissao: "configuracoes.gerenciar",
      titulo: "Geral e integrações",
      corpo:
        "Dados do app, dias de aviso de vencimento, chave do Asaas e URL do webhook. Chave errada derruba a cobrança.",
      posicao: "bottom",
    },
    {
      alvo: '[data-tour="config-secao-auditoria"]',
      permissao: "auditoria.ler",
      titulo: "Auditoria",
      corpo:
        "Histórico de alterações sensíveis: quem mudou o quê e quando. Consulte ao investigar um problema.",
      posicao: "bottom",
    },
    {
      alvo: '[data-tour="config-secao-telemetria"]',
      permissao: "auditoria.ler",
      titulo: "Acesso e sessão",
      corpo:
        "Métricas de login e de resolução de papel, por versão e rota. Serve para identificar regressões.",
      posicao: "bottom",
    },
  ],
};

const TELA_COMERCIAL: Tutorial = {
  chave: "tela:comercial",
  titulo: "Gestão comercial",
  papeis: ["admin", "vendedor"],
  passos: [
    {
      alvo: '[data-tour="comercial-funil"]',
      titulo: "O funil",
      corpo:
        "Os estágios são Contatado, Interessado, Em negociação, Ganho, Perdido e Não interessado. Perdido e Não interessado pedem o motivo.",
      posicao: "bottom",
    },
    {
      alvo: '[data-tour="comercial-novo-lead"]',
      titulo: "Cadastrar lead",
      corpo:
        "Registre nome, contato, segmento, origem e valor estimado. O primeiro follow-up já é agendado automaticamente.",
      posicao: "bottom",
    },
    {
      alvo: '[data-tour="comercial-importar"]',
      titulo: "Importar planilha",
      corpo:
        "Cole ou envie a lista, revise o que o sistema entendeu e confirme. Dá para desfazer a importação em até 24 horas.",
      posicao: "bottom",
    },
    {
      alvo: '[data-tour="comercial-followups"]',
      titulo: "Fila de follow-up e régua de cadência",
      corpo:
        "A régua reagenda o próximo contato em 2, 4, 7 e 15 dias. Registre o resultado de cada tentativa para a fila avançar.",
      posicao: "top",
    },
    {
      alvo: '[data-tour="comercial-reunioes"]',
      titulo: "Reuniões",
      corpo:
        "Agende e feche cada reunião como Realizada, Remarcada, No-show ou Cancelada — isso alimenta o seu desempenho.",
      posicao: "top",
    },
    {
      alvo: '[data-tour="comercial-incompletos"]',
      titulo: "Leads incompletos",
      corpo:
        "Leads que entraram sem telefone ou e-mail. Complete o contato aqui para poder trabalhá-los.",
      posicao: "top",
    },
  ],
};

const TELA_TAREFAS: Tutorial = {
  chave: "tela:tarefas",
  titulo: "Tarefas",
  papeis: ["admin", "vendedor"],
  passos: [
    {
      alvo: '[data-tour="tarefas-filtros"]',
      titulo: "Filtros da fila",
      corpo:
        "Filtre por status, responsável ou origem para focar no que é seu e no que está atrasado.",
      posicao: "bottom",
    },
    {
      alvo: '[data-tour="tarefas-lista"]',
      titulo: "Status e transições",
      corpo:
        "A tarefa avança por etapas encadeadas. Se um passo não for permitido, o sistema explica qual é o próximo válido.",
      posicao: "top",
    },
    {
      alvo: '[data-tour="tarefas-lista"]',
      titulo: "Prioridade e responsável",
      corpo:
        "A prioridade (baixa, média, alta) ordena a fila; o responsável é quem precisa agir. Sem responsável, ninguém age.",
      posicao: "top",
    },
    {
      alvo: '[data-tour="tarefas-lista"]',
      titulo: "Comentários e anexos",
      corpo:
        "Registre o andamento na própria tarefa. Só os participantes da tarefa veem os anexos.",
      posicao: "top",
    },
    {
      titulo: "Tarefa da equipe x solicitação do cliente",
      corpo:
        "Contratação de plano e Tarefa interna nascem dentro da equipe. Solicitação do cliente vem da tela Solicitações e alguém precisa responder.",
    },
  ],
};

const TELA_VENDEDOR: Tutorial = {
  chave: "tela:vendedor",
  titulo: "Painel do vendedor",
  papeis: ["vendedor"],
  passos: [
    {
      alvo: '[data-tour="vend-metricas"]',
      titulo: "Suas métricas",
      corpo:
        "Total de clientes, ativos, a vencer e vencidos. É o retrato da saúde da sua carteira.",
      posicao: "bottom",
    },
    {
      alvo: '[data-tour="vend-comissao"]',
      titulo: "Comissão estimada",
      corpo:
        "Cálculo sobre as assinaturas ativas com o seu percentual. É uma estimativa, não um extrato de pagamento.",
      posicao: "bottom",
    },
    {
      alvo: '[data-tour="secao-indicacoes"]',
      titulo: "Link de indicação",
      corpo:
        "Compartilhe o link ou o código de afiliado: quem se cadastrar por ele já entra vinculado a você.",
      posicao: "top",
    },
    {
      alvo: '[data-tour="secao-cupons"]',
      titulo: "Meus cupons",
      corpo:
        "Ofereça um cupom para fechar a venda. O desconto se aplica somente à primeira mensalidade.",
      posicao: "top",
    },
    {
      alvo: '[data-tour="secao-clientes"]',
      titulo: "Meus clientes",
      corpo:
        "Sua carteira com status e vencimento. Aqui você edita o cadastro e deixa uma mensagem para o cliente.",
      posicao: "top",
    },
  ],
};

const TELA_CLIENTE: Tutorial = {
  chave: "tela:cliente",
  titulo: "Minha assinatura",
  papeis: ["cliente"],
  passos: [
    {
      alvo: '[data-tour="cli-status"]',
      titulo: "Status e vencimento",
      corpo:
        "Mostra se você está em dia e quantos dias faltam para a próxima cobrança mensal.",
      posicao: "bottom",
    },
    {
      alvo: '[data-tour="cli-plano"]',
      titulo: "Seu plano",
      corpo:
        "O plano que você assina hoje, com serviço extra se houver. A cobrança é mensal e automática.",
      posicao: "bottom",
    },
    {
      alvo: '[data-tour="cli-historico"]',
      titulo: "Faturas e histórico",
      corpo:
        "Em faturas pendentes use \"Abrir fatura\" para pagar por PIX, boleto ou cartão — o link continua válido se você fechar a janela.",
      posicao: "top",
    },
    {
      alvo: '[data-tour="nav-solicitacoes"]',
      titulo: "Precisa de algo?",
      corpo:
        "Em Solicitações você pede alteração de plano, mudança de vencimento ou segunda via, sem precisar ligar.",
      posicao: "right",
    },
  ],
};

const TELA_SOLICITACOES: Tutorial = {
  chave: "tela:solicitacoes",
  titulo: "Solicitações",
  papeis: ["cliente"],
  passos: [
    {
      alvo: '[data-tour="solic-catalogo"]',
      titulo: "Escolha o tipo de pedido",
      corpo:
        "Alterar plano, Serviço adicional, Segunda via de cobrança, Alterar vencimento, Atualizar meus dados, Cancelar assinatura ou Outra solicitação.",
      posicao: "bottom",
    },
    {
      alvo: '[data-tour="solic-catalogo"]',
      titulo: "Cada tipo pede o essencial",
      corpo:
        "O formulário muda conforme o pedido: em Alterar vencimento, por exemplo, você escolhe um dia entre 1 e 28.",
      posicao: "bottom",
    },
    {
      titulo: "Atenção ao cancelamento",
      corpo:
        "Ao cancelar, o acesso vai até o fim do período já pago e não há reembolso de valores já faturados.",
    },
    {
      alvo: '[data-tour="solic-lista"]',
      titulo: "Depois de enviar",
      corpo:
        "Seu pedido vira uma tarefa para a equipe e você acompanha o andamento nesta lista.",
      posicao: "top",
    },
    {
      titulo: "Renovação é automática",
      corpo:
        "Você não precisa pedir renovação: a assinatura é mensal e a cobrança é gerada sozinha todo mês.",
    },
  ],
};

export const TUTORIAIS: readonly Tutorial[] = [
  BOAS_VINDAS_ADMIN,
  BOAS_VINDAS_VENDEDOR,
  BOAS_VINDAS_CLIENTE,
  TELA_ADMIN_DASHBOARD,
  TELA_ADMIN_CLIENTES,
  TELA_ADMIN_CONFIG,
  TELA_COMERCIAL,
  TELA_TAREFAS,
  TELA_VENDEDOR,
  TELA_CLIENTE,
  TELA_SOLICITACOES,
];

export function tutorialPara(chave: string, papel: AppRole | null): Tutorial | undefined {
  if (!papel) return undefined;
  return TUTORIAIS.find((t) => t.chave === chave && t.papeis.includes(papel));
}

export function tutoriaisDoPapel(papel: AppRole | null): readonly Tutorial[] {
  if (!papel) return [];
  return TUTORIAIS.filter((t) => t.papeis.includes(papel));
}

/** Função de checagem de permissão (o `can` do useAuth). */
export type PodePermissao = (permissao: string) => boolean;

/**
 * Remove os passos que exigem uma permissão que o usuário não tem.
 * Sem isso o tour apontaria para seções de Configurações que aquele usuário
 * nem vê, e o balão ficaria explicando algo inacessível.
 */
export function passosVisiveis(tutorial: Tutorial, pode: PodePermissao): PassoTutorial[] {
  return tutorial.passos.filter((p) => !p.permissao || pode(p.permissao));
}

/**
 * Tutorial já ajustado ao papel E às permissões do usuário.
 * Devolve `undefined` quando não sobra nenhum passo — assim nada é reiniciado
 * nem disparado à toa.
 */
export function tutorialVisivel(
  chave: string,
  papel: AppRole | null,
  pode: PodePermissao,
): Tutorial | undefined {
  const base = tutorialPara(chave, papel);
  if (!base) return undefined;
  const passos = passosVisiveis(base, pode);
  if (passos.length === 0) return undefined;
  return passos.length === base.passos.length ? base : { ...base, passos };
}

/** Tutoriais que este usuário realmente pode rever (papel + permissões). */
export function tutoriaisVisiveis(
  papel: AppRole | null,
  pode: PodePermissao,
): readonly Tutorial[] {
  return tutoriaisDoPapel(papel)
    .map((t) => tutorialVisivel(t.chave, papel, pode))
    .filter((t): t is Tutorial => Boolean(t));
}

/* ------------------------------------------------------------------ */
/* Ajuda permanente por tela                                           */
/* ------------------------------------------------------------------ */

export interface ResumoTela {
  titulo: string;
  resumo: string;
  topicos: string[];
}

export const RESUMOS_TELA: Record<string, ResumoTela> = {
  "tela:admin-dashboard": {
    titulo: "Dashboard da administração",
    resumo:
      "Retrato do negócio no período escolhido, com o que precisa de ação em destaque.",
    topicos: [
      "Indicadores: assinaturas ativas, receita mensal, novos clientes e churn.",
      "Alertas e ações urgentes: vencimentos próximos e falhas de cobrança.",
      "Ranking de vendedores e gráficos de MRR e clientes por status.",
      "Logs de webhook Asaas: use quando um pagamento não apareceu.",
    ],
  },
  "tela:admin-clientes": {
    titulo: "Clientes",
    resumo: "Todos os assinantes, com status, plano, vencimento e vendedor.",
    topicos: [
      "Ativo está em dia; vencendo está perto do vencimento; vencido e inadimplente têm cobrança em aberto.",
      "Editar plano, valor ou serviço extra atualiza a assinatura recorrente na plataforma de pagamento.",
      "Reprocessar sincronização tenta de novo quando a cobrança ficou dessincronizada.",
      "Excluir apaga o cadastro e o login do cliente e não pode ser desfeito.",
    ],
  },
  "tela:admin-configuracoes": {
    titulo: "Configurações",
    resumo:
      "Cupons, Planos, Admins, Vendedores, Permissões, Geral e integrações, Auditoria e Acesso e sessão.",
    topicos: [
      "Planos e Cupons afetam diretamente o valor cobrado.",
      "Geral e integrações guarda a chave do Asaas e a URL do webhook.",
      "Permissões define o que cada papel pode fazer — a checagem real acontece no servidor.",
      "Auditoria e Acesso e sessão são para investigar o que aconteceu.",
    ],
  },
  "tela:comercial": {
    titulo: "Gestão comercial",
    resumo: "Funil de leads, fila de follow-up, reuniões e desempenho.",
    topicos: [
      "Estágios: Contatado, Interessado, Em negociação, Ganho, Perdido e Não interessado.",
      "A régua de cadência reagenda o próximo contato em 2, 4, 7 e 15 dias.",
      "Importar planilha permite revisar antes de confirmar e desfazer em até 24 horas.",
      "Leads incompletos são os que entraram sem telefone ou e-mail.",
    ],
  },
  "tela:tarefas": {
    titulo: "Tarefas",
    resumo: "Fila de trabalho da equipe, com status, prioridade e responsável.",
    topicos: [
      "As transições de status são encadeadas; o sistema avisa quando um passo não é permitido.",
      "Contratação de plano e Tarefa interna nascem na equipe.",
      "Solicitação do cliente vem da tela Solicitações e precisa de resposta.",
      "Comentários e anexos ficam visíveis só para os participantes da tarefa.",
    ],
  },
  "tela:vendedor": {
    titulo: "Painel do vendedor",
    resumo: "Sua carteira, sua comissão estimada e suas ferramentas de venda.",
    topicos: [
      "Métricas: total de clientes, ativos, a vencer e vencidos.",
      "A comissão estimada usa as assinaturas ativas e o seu percentual.",
      "Link de indicação vincula automaticamente quem se cadastrar por ele.",
      "Cupons dão desconto apenas na primeira mensalidade.",
    ],
  },
  "tela:cliente": {
    titulo: "Minha assinatura",
    resumo: "Status, plano, próximo vencimento e histórico de faturas.",
    topicos: [
      "A cobrança é mensal e automática — não é preciso pedir renovação.",
      "Em faturas pendentes, \"Abrir fatura\" reabre o link de pagamento a qualquer momento.",
      "Pagamento por PIX, boleto ou cartão.",
      "Para mudar plano ou vencimento, use Solicitações.",
    ],
  },
  "tela:solicitacoes": {
    titulo: "Solicitações",
    resumo: "Canal para pedir alterações na sua assinatura.",
    topicos: [
      "Escolha o tipo, preencha o essencial e envie.",
      "Seu pedido vira uma tarefa para a equipe e você acompanha o andamento na lista.",
      "Cancelamento: o acesso vai até o fim do período pago, sem reembolso.",
      "Segunda via: se já existe fatura em aberto, o link está na sua área do cliente.",
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Ajuda dos campos de formulário                                      */
/* ------------------------------------------------------------------ */

export const AJUDA_CAMPOS: Record<string, string> = {
  // Cadastro de cliente
  "cliente.cpf_cnpj":
    "Obrigatório porque a plataforma de pagamento exige o documento do pagador para emitir PIX, boleto ou cartão.",
  "cliente.telefone":
    "Usado para contato e também exigido pela plataforma de pagamento na criação da cobrança.",
  "cliente.plano":
    "Define o valor da assinatura mensal recorrente. Trocar o plano depois atualiza a cobrança.",
  "cliente.servico_extra":
    "Serviço combinado fora do plano. Descreva o que é e informe o valor: ele soma à mensalidade.",
  "cliente.servico_extra_valor":
    "Valor que será somado ao plano na cobrança recorrente de todo mês.",
  "cliente.primeiro_vencimento":
    "Dia da primeira cobrança. Esse dia vira a âncora das próximas mensalidades, mesmo em meses mais curtos.",
  "cliente.cupom":
    "Desconto aplicado apenas na primeira mensalidade. As seguintes voltam ao valor cheio.",
  "cliente.anotacoes":
    "Observações internas sobre o cliente. O cliente não vê este campo.",

  // Lead
  "lead.segmento": "Ramo de atuação do lead. Ajuda a priorizar quem tem mais chance de fechar.",
  "lead.valor_estimado":
    "Quanto essa venda deve valer por mês. Alimenta o pipeline e a prioridade da fila de follow-up.",
  "lead.estagio":
    "Onde o lead está: Contatado, Interessado, Em negociação, Ganho, Perdido ou Não interessado. Perdido e Não interessado pedem o motivo.",
  "lead.origem":
    "Como o lead chegou: Prospecção ativa, Indicação, Inbound, Evento, Rede social ou Outro.",

  // Cupom
  "cupom.codigo": "Código que o cliente digita. Evite espaços e acentos.",
  "cupom.desconto":
    "Vale somente para a primeira mensalidade — a partir da segunda o valor volta ao normal.",
  "cupom.limite_usos": "Quantas vezes o cupom pode ser usado no total. Ao atingir o limite, ele para de valer.",
  "cupom.validade": "Depois desta data o cupom deixa de ser aceito no cadastro.",

  // Permissões
  "permissoes.matriz":
    "Marcar aqui muda o que o papel pode fazer. A checagem real acontece no servidor, então a alteração vale de verdade.",

  // Plano
  "plano.valor":
    "Este valor entra na cobrança recorrente mensal de quem assina o plano. Alterar afeta os próximos ciclos.",
  "plano.ativo": "Planos inativos deixam de aparecer no cadastro de novos clientes.",
};
