// Fonte única do Termo de Uso: a página /termos-de-uso e o registro de aceite
// no banco usam exatamente este mesmo conteúdo.

export const TERMOS_VERSAO = "2026-07-29";
export const TERMOS_ATUALIZADO_EM = "29 de julho de 2026";

export interface TermoItem {
  titulo?: string;
  texto: string;
}

export interface TermoSecao {
  titulo: string;
  paragrafo?: string;
  lista?: TermoItem[];
  ordenada?: boolean;
}

export const TERMOS_SECOES: TermoSecao[] = [
  {
    titulo: "1. Objetivo",
    paragrafo:
      "O presente Termo de Uso visa estabelecer as condições e regras gerais para o uso da plataforma Brazon, um serviço de gestão de assinaturas e cobranças recorrentes. Ao utilizar o serviço, o usuário declara ter lido, entendido e aceito as condições abaixo.",
  },
  {
    titulo: "2. Definições",
    lista: [
      {
        titulo: "Serviço",
        texto:
          "refere-se ao acesso e uso da plataforma Brazon, incluindo todas as funcionalidades e recursos disponíveis para gestão de assinaturas, clientes, vendedores e pagamentos.",
      },
      {
        titulo: "Usuário",
        texto:
          "qualquer pessoa física ou jurídica que utilize o Serviço, seja na condição de cliente, vendedor, administrador ou visitante.",
      },
      {
        titulo: "Contrato",
        texto:
          "o acordo entre a Brazon e o Usuário, que inclui as condições deste Termo de Uso, bem como as políticas de privacidade e quaisquer outras diretrizes publicadas pela plataforma.",
      },
      {
        titulo: "Conta",
        texto:
          "o conjunto de credenciais e permissões vinculadas a um endereço de e-mail validado na plataforma.",
      },
    ],
  },
  {
    titulo: "3. Condições Gerais",
    ordenada: true,
    lista: [
      {
        titulo: "Uso do Serviço",
        texto:
          "O Usuário pode utilizar o Serviço apenas para fins legítimos, em conformidade com a legislação brasileira vigente. É vedado o uso da plataforma para atividades ilegais, fraudulentas, prejudiciais ou que violem direitos de terceiros.",
      },
      {
        titulo: "Responsabilidade",
        texto:
          "O Usuário é responsável por manter a segurança de suas credenciais de login e acesso ao Serviço. A Brazon não se responsabiliza por acessos decorrentes de negligência na guarda de senhas ou dispositivos do Usuário.",
      },
      {
        titulo: "Propriedade Intelectual",
        texto:
          "A plataforma Brazon, sua marca, layout, funcionalidades e código são de propriedade exclusiva da Brazon. O Usuário recebe uma licença de uso limitada, não exclusiva e intransferível, vedada a reprodução, modificação ou distribuição sem autorização prévia.",
      },
      {
        titulo: "Limitações de Garantia",
        texto:
          "O Serviço é fornecido na forma em que está disponível, dentro dos limites permitidos pela lei. A Brazon não oferece garantias expressas ou implícitas de comercialização, adequação a um propósito específico ou ininterrupta disponibilidade, salvo disposição em contrário formalmente pactuada.",
      },
      {
        titulo: "Alterações",
        texto:
          "A Brazon reserva-se o direito de alterar, suspender ou descontinuar funcionalidades do Serviço a qualquer momento, comunicando alterações significativas por meio da plataforma ou do e-mail cadastrado.",
      },
    ],
  },
  {
    titulo: "4. Condições Específicas",
    ordenada: true,
    lista: [
      {
        titulo: "Assinatura de Planos",
        texto:
          "Ao contratar ou gerenciar planos na plataforma, o Usuário concorda em fornecer dados válidos e atualizados, incluindo CPF/CNPJ e informações de pagamento quando exigido. O não pagamento das cobranças pode acarretar suspensão ou cancelamento do acesso.",
      },
      {
        titulo: "Pagamentos e Cobranças",
        texto:
          "As cobranças recorrentes são processadas por meio de integração com provedores de pagamento terceirizados. O Usuário reconhece que a Brazon atua como intermediadora tecnológica e que eventuais questões relacionadas à instituição financeira devem ser dirimidas conforme as regras do provedor.",
      },
      {
        titulo: "Responsabilidade por Dados",
        texto:
          "O Usuário é responsável pela veracidade e pela legalidade dos dados de clientes, vendedores e planos cadastrados na plataforma. A Brazon poderá suspender contas que utilizem dados falsos ou em desconformidade com a legislação de proteção de dados.",
      },
      {
        titulo: "Manutenção",
        texto:
          "A Brazon se reserva o direito de realizar atualizações ou manutenções no Serviço a qualquer momento, podendo haver indisponibilidade temporária sem necessidade de aviso prévio, salvo quando tecnicamente inviável.",
      },
    ],
  },
  {
    titulo: "5. Duração e Cancelamento",
    ordenada: true,
    lista: [
      {
        titulo: "Duração",
        texto:
          "O Contrato começa quando o Usuário cria uma conta na plataforma e termina quando o Usuário cancela sua conta ou quando a Brazon descontinua o Serviço.",
      },
      {
        titulo: "Cancelamento",
        texto:
          "O Usuário pode solicitar o cancelamento de sua conta a qualquer momento, mediante solicitação através dos canais disponíveis. Não haverá reembolso de valores referentes a períodos já faturados ou não utilizados, salvo disposição legal em contrário.",
      },
    ],
  },
  {
    titulo: "6. Disputas e Jurisdição",
    ordenada: true,
    lista: [
      {
        titulo: "Disputas",
        texto:
          "Qualquer disputa ou controvérsia relacionada a este Contrato será primeiramente resolvida por meio de negociação amigável entre as partes.",
      },
      {
        titulo: "Jurisdição",
        texto:
          "As leis da República Federativa do Brasil aplicam-se a este Contrato. As partes elegem o foro da comarca do domicílio da Brazon, com renúncia a qualquer outro, por mais privilegiado que seja, para dirimir eventuais litígios.",
      },
    ],
  },
  {
    titulo: "7. Alterações ao Termo de Uso",
    paragrafo:
      "A Brazon reserva-se o direito de alterar este Termo de Uso a qualquer momento. As alterações entrarão em vigor na data de sua publicação na plataforma ou no prazo indicado. O uso continuado do Serviço após as alterações constituirá aceitação das novas condições.",
  },
  {
    titulo: "8. Aceite",
    paragrafo:
      "Ao criar uma conta na plataforma, o Usuário declara ter lido, entendido e aceitado integralmente as condições deste Termo de Uso.",
  },
];

export const TERMOS_RODAPE =
  "Dúvidas sobre estes Termos de Uso podem ser enviadas através dos canais de suporte disponíveis na plataforma.";

/** Versão em texto puro do termo — é exatamente isto que fica registrado no banco. */
export function montarTextoTermos(): string {
  const linhas: string[] = [
    "TERMOS DE USO — BRAZON",
    `Versão: ${TERMOS_VERSAO} (última atualização: ${TERMOS_ATUALIZADO_EM})`,
    "",
  ];
  for (const secao of TERMOS_SECOES) {
    linhas.push(secao.titulo);
    if (secao.paragrafo) linhas.push(secao.paragrafo);
    secao.lista?.forEach((item, i) => {
      const marcador = secao.ordenada ? `${i + 1}. ` : "- ";
      linhas.push(`${marcador}${item.titulo ? `${item.titulo}: ` : ""}${item.texto}`);
    });
    linhas.push("");
  }
  linhas.push(TERMOS_RODAPE);
  return linhas.join("\n");
}

export const TERMOS_TEXTO = montarTextoTermos();
