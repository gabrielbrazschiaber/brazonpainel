import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { BrazonLogo } from "@/components/BrazonLogo";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/termos-de-uso")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Brazon" },
      { name: "description", content: "Termos de Uso da plataforma Brazon de gestão de assinaturas." },
      { property: "og:title", content: "Termos de Uso — Brazon" },
      { property: "og:description", content: "Termos de Uso da plataforma Brazon de gestão de assinaturas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermosDeUsoPage,
});

function TermosDeUsoPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-8 md:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-4">
          <Link to="/login">
            <Button variant="ghost" size="sm" className="gap-1 pl-2">
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </Button>
          </Link>
          <BrazonLogo />
        </div>

        <Card className="p-6 md:p-10">
          <article className="prose prose-sm max-w-none text-foreground">
            <h1 className="text-2xl font-bold md:text-3xl">Termos de Uso</h1>
            <p className="text-muted-foreground">
              Última atualização: 29 de julho de 2026
            </p>

            <section className="mt-8">
              <h2 className="text-lg font-semibold">1. Objetivo</h2>
              <p>
                O presente Termo de Uso visa estabelecer as condições e regras gerais para o uso da plataforma Brazon, um serviço de gestão de assinaturas e cobranças recorrentes. Ao utilizar o serviço, o usuário declara ter lido, entendido e aceito as condições abaixo.
              </p>
            </section>

            <section className="mt-6">
              <h2 className="text-lg font-semibold">2. Definições</h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>Serviço:</strong> refere-se ao acesso e uso da plataforma Brazon, incluindo todas as funcionalidades e recursos disponíveis para gestão de assinaturas, clientes, vendedores e pagamentos.
                </li>
                <li>
                  <strong>Usuário:</strong> qualquer pessoa física ou jurídica que utilize o Serviço, seja na condição de cliente, vendedor, administrador ou visitante.
                </li>
                <li>
                  <strong>Contrato:</strong> o acordo entre a Brazon e o Usuário, que inclui as condições deste Termo de Uso, bem como as políticas de privacidade e quaisquer outras diretrizes publicadas pela plataforma.
                </li>
                <li>
                  <strong>Conta:</strong> o conjunto de credenciais e permissões vinculadas a um endereço de e-mail validado na plataforma.
                </li>
              </ul>
            </section>

            <section className="mt-6">
              <h2 className="text-lg font-semibold">3. Condições Gerais</h2>
              <ol className="list-decimal space-y-3 pl-5">
                <li>
                  <strong>Uso do Serviço:</strong> O Usuário pode utilizar o Serviço apenas para fins legítimos, em conformidade com a legislação brasileira vigente. É vedado o uso da plataforma para atividades ilegais, fraudulentas, prejudiciais ou que violem direitos de terceiros.
                </li>
                <li>
                  <strong>Responsabilidade:</strong> O Usuário é responsável por manter a segurança de suas credenciais de login e acesso ao Serviço. A Brazon não se responsabiliza por acessos decorrentes de negligência na guarda de senhas ou dispositivos do Usuário.
                </li>
                <li>
                  <strong>Propriedade Intelectual:</strong> A plataforma Brazon, sua marca, layout, funcionalidades e código são de propriedade exclusiva da Brazon. O Usuário recebe uma licença de uso limitada, não exclusiva e intransferível, vedada a reprodução, modificação ou distribuição sem autorização prévia.
                </li>
                <li>
                  <strong>Limitações de Garantia:</strong> O Serviço é fornecido na forma em que está disponível, dentro dos limites permitidos pela lei. A Brazon não oferece garantias expressas ou implícitas de comercialização, adequação a um propósito específico ou ininterrupta disponibilidade, salvo disposição em contrário formalmente pactuada.
                </li>
                <li>
                  <strong>Alterações:</strong> A Brazon reserva-se o direito de alterar, suspender ou descontinuar funcionalidades do Serviço a qualquer momento, comunicando alterações significadas por meio da plataforma ou do e-mail cadastrado.
                </li>
              </ol>
            </section>

            <section className="mt-6">
              <h2 className="text-lg font-semibold">4. Condições Específicas</h2>
              <ol className="list-decimal space-y-3 pl-5">
                <li>
                  <strong>Assinatura de Planos:</strong> Ao contratar ou gerenciar planos na plataforma, o Usuário concorda em fornecer dados válidos e atualizados, incluindo CPF/CNPJ e informações de pagamento quando exigido. O não pagamento das cobranças pode acarretar suspensão ou cancelamento do acesso.
                </li>
                <li>
                  <strong>Pagamentos e Cobranças:</strong> As cobranças recorrentes são processadas por meio de integração com provedores de pagamento terceirizados. O Usuário reconhece que a Brazon atua como intermediadora tecnológica e que eventuais questões relacionadas à instituição financeira devem ser dirimidas conforme as regras do provedor.
                </li>
                <li>
                  <strong>Responsabilidade por Dados:</strong> O Usuário é responsável pela veracidade e pela legalidade dos dados de clientes, vendedores e planos cadastrados na plataforma. A Brazon poderá suspender contas que utilizem dados falsos ou em desconformidade com a legislação de proteção de dados.
                </li>
                <li>
                  <strong>Manutenção:</strong> A Brazon se reserva o direito de realizar atualizações ou manutenções no Serviço a qualquer momento, podendo haver indisponibilidade temporária sem necessidade de aviso prévio, salvo quando tecnicamente inviável.
                </li>
              </ol>
            </section>

            <section className="mt-6">
              <h2 className="text-lg font-semibold">5. Duração e Cancelamento</h2>
              <ol className="list-decimal space-y-3 pl-5">
                <li>
                  <strong>Duração:</strong> O Contrato começa quando o Usuário cria uma conta na plataforma e termina quando o Usuário cancela sua conta ou quando a Brazon descontinua o Serviço.
                </li>
                <li>
                  <strong>Cancelamento:</strong> O Usuário pode solicitar o cancelamento de sua conta a qualquer momento, mediante solicitação através dos canais disponíveis. Não haverá reembolso de valores referentes a períodos já faturados ou não utilizados, salvo disposição legal em contrário.
                </li>
              </ol>
            </section>

            <section className="mt-6">
              <h2 className="text-lg font-semibold">6. Disputas e Jurisdição</h2>
              <ol className="list-decimal space-y-3 pl-5">
                <li>
                  <strong>Disputas:</strong> Qualquer disputa ou controvérsia relacionada a este Contrato será primeiramente resolvida por meio de negociação amigável entre as partes.
                </li>
                <li>
                  <strong>Jurisdição:</strong> As leis da República Federativa do Brasil aplicam-se a este Contrato. As partes elegem o foro da comarca do domicílio da Brazon, com renúncia a qualquer outro, por mais privilegiado que seja, para dirimir eventuais litígios.
                </li>
              </ol>
            </section>

            <section className="mt-6">
              <h2 className="text-lg font-semibold">7. Alterações ao Termo de Uso</h2>
              <p>
                A Brazon reserva-se o direito de alterar este Termo de Uso a qualquer momento. As alterações entrarão em vigor na data de sua publicação na plataforma ou no prazo indicado. O uso continuado do Serviço após as alterações constituirá aceitação das novas condições.
              </p>
            </section>

            <section className="mt-6">
              <h2 className="text-lg font-semibold">8. Aceite</h2>
              <p>
                Ao criar uma conta na plataforma, o Usuário declara ter lido, entendido e aceitado integralmente as condições deste Termo de Uso.
              </p>
            </section>

            <p className="mt-8 text-sm text-muted-foreground">
              Dúvidas sobre estes Termos de Uso podem ser enviadas através dos canais de suporte disponíveis na plataforma.
            </p>
          </article>
        </Card>
      </div>
    </div>
  );
}
