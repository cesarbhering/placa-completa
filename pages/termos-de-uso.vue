<script setup lang="ts">
import { DESCRICOES_EN } from '~/shared/seo-meta-en'
const { emIngles, rota } = useIdioma()

// English twin (Nov 6, 2026): a courtesy translation. The PT text prevails,
// and the page says so at the top. The PT head below is the original one.
if (emIngles.value) {
  useHead({
    title: 'Terms of Use',
    meta: [
      { name: 'description', content: DESCRICOES_EN.termos },
      { name: 'robots', content: 'noindex, follow' },
    ],
  })
} else {
  useHead({
    title: 'Termos de Uso',
    meta: [
      { name: 'description', content: 'Termos de Uso do serviço Placa Completa, em conformidade com a Portaria SENATRAN nº 139/2025 e com a LGPD.' },
      { name: 'robots', content: 'noindex, follow' },
    ],
  })
}
</script>

<template>
  <div class="pc-page">
    <main class="pc-container">
      <template v-if="emIngles">
      <h1 class="legal-title">Terms of Use</h1>
        <p class="legal-updated">Last updated: October 1, 2026</p>
        <p class="legal-updated"><strong>This is a courtesy translation. The <NuxtLink to="/termos-de-uso" hreflang="pt-BR">Portuguese version</NuxtLink> is the binding one and prevails in case of any difference.</strong></p>

        <div class="legal-content">
          <h2>1. Service Provider</h2>
          <p>
            The <strong>Placa Completa</strong> service ("Service"), available at
            placacompleta.com.br, is provided by:
          </p>
          <ul>
            <li><strong>Legal name:</strong> CESAR CANCADO BHERING TECNOLOGIA LTDA</li>
            <li><strong>CNPJ (Brazilian company ID):</strong> 62.569.152/0001-67</li>
            <li><strong>Address:</strong> Rua Bom Pastor, Sala 03, Ipiranga, São Paulo/SP, Brazil</li>
            <li><strong>Contact:</strong> contato@placacompleta.com.br</li>
          </ul>

          <h2>2. Acceptance of the Terms</h2>
          <p>
            By using the Service, you fully agree to these Terms of Use and to the
            <NuxtLink to="/en/politica-de-privacidade">Privacy Policy</NuxtLink>.
            If you do not agree, do not use the Service.
          </p>

          <h2>3. Regulatory Basis</h2>
          <p>
            Placa Completa operates as an accredited entity under
            <strong>Ordinance No. 139 of February 20, 2025, of the Brazilian National Traffic Secretariat</strong>,
            which governs access by authorized third parties to data from the federal vehicle database.
            Data is accessed through the federal online vehicle lookup service operated by
            <strong>Serpro</strong>, the federal data processing company.
          </p>
          <p>
            Under <strong>article 6, item I, of Ordinance 139/2025</strong>, Placa Completa
            operates in the <strong>DIRECT access mode</strong>, integrating directly with the
            federal APIs operated by Serpro, with no third-party intermediation and no resale of
            the data.
          </p>

          <h2>4. Description of the Service</h2>
          <p>
            Placa Completa is a vehicle check service by license plate, aimed at
            <strong>fraud prevention, asset protection and credit protection</strong>.
            The user enters the license plate of a vehicle and receives information about the
            vehicle, including:
          </p>
          <ul>
            <li><strong>Vehicle Information Lookup for Fraud Prevention and Credit Protection:</strong> technical data of the vehicle and indicators of recalls, liens, theft, RENAJUD court restrictions and aggregated outstanding fees;</li>
            <li><strong>Lookup of Traffic Violations Linked to the Vehicle for Fraud Prevention and Credit Protection:</strong> unpaid violations of the vehicle, with ticket number, date, place, city/state, issuing authority, description and amount.</li>
          </ul>
          <p>
            Additional information (e.g. the FIPE price table) may come from other sources and
            is identified separately in the result.
          </p>

          <h2>5. Lawful Purposes of Use</h2>
          <p>The Service is intended only for lawful purposes, such as:</p>
          <ul>
            <li>Checking vehicle data when buying or selling a vehicle;</li>
            <li>Looking up the market value for reference;</li>
            <li>Checking restrictions, liens, outstanding fees, recalls and court status of the vehicle before a transaction;</li>
            <li>Checking recall and vehicle safety campaigns;</li>
            <li>Checking unpaid traffic violations linked to the vehicle, which prevent annual licensing and title transfer (Brazilian Traffic Code, articles 128 and 131);</li>
            <li>Assessing risk in credit, financing, leasing, rental and insurance operations involving the vehicle;</li>
            <li>Checking information for legitimate personal or business purposes.</li>
          </ul>

          <h2>6. Prohibitions Under Ordinance 139/2025</h2>
          <p>
            In compliance with Ordinance No. 139/2025 and the LGPD, the user of the Service is
            <strong>expressly forbidden</strong> to:
          </p>
          <ul>
            <li><strong>Resell, sublicense, redistribute or transfer</strong> the data obtained, in whole or in part, to any third party, whether paid or free of charge;</li>
            <li>Use the data for <strong>any purpose other than</strong> those stated in these Terms and in the Use Cases approved by the federal traffic authority;</li>
            <li>Use the data for <strong>marketing, sales prospecting, telemarketing</strong> or unsolicited communications;</li>
            <li>Perform <strong>scoring, classification, profiling or ranking</strong> of people based on vehicle data;</li>
            <li>Use the data for <strong>unlawful discrimination</strong> of any kind;</li>
            <li>Engage in <strong>illegal, abusive or fraudulent activities</strong>, or activities that violate the rights of third parties;</li>
            <li><strong>Collect data by automated means</strong> (bots, scrapers, scraping) without prior written authorization from Placa Completa;</li>
            <li>Attempt to <strong>bypass security, access control or audit mechanisms</strong> of the platform.</li>
          </ul>
          <p>
            Access to the platform is <strong>monitored and auditable</strong> by the federal
            traffic authority and by Serpro. Misuse may constitute a violation of Brazilian law,
            subjecting the user to the applicable civil, administrative and criminal penalties,
            regardless of prior notice.
          </p>

          <h2>7. Personal Data and the LGPD</h2>
          <p>
            Personal data is processed in accordance with
            <strong>Law No. 13,709/2018 (LGPD, the Brazilian General Data Protection Law)</strong> and
            <strong>Ordinance No. 139/2025</strong>. The applicable legal bases, the rights of the
            data subject and how to exercise them are described in detail in the
            <NuxtLink to="/en/politica-de-privacidade">Privacy Policy</NuxtLink>.
          </p>
          <p>
            In short, Placa Completa bases the processing of vehicle data on
            <strong>legitimate interest (LGPD article 7, IX)</strong>,
            <strong>credit protection (article 7, X)</strong> and the
            <strong>performance of a contract or preliminary procedures (article 7, V)</strong>.
          </p>
          <p>
            The electronic service invoice is issued automatically, after the report is
            delivered, in the name and CPF/CNPJ of the person who made the payment. In case of a
            refund, the invoice is cancelled.
          </p>

          <h2>8. Limitation of Liability</h2>
          <p>
            Vehicle information is obtained from the federal traffic authority, through Serpro,
            and from licensed complementary sources. Placa Completa <strong>does not guarantee</strong>
            the accuracy, completeness or timeliness of the data returned, since it depends on
            updates in the source databases. The Service is provided "as is", without warranties
            of any kind.
          </p>
          <p>
            Placa Completa is not responsible for decisions made by the user based on the
            information provided, including but not limited to decisions to buy, sell, finance
            or contract anything involving vehicles.
          </p>

          <h2>9. Availability</h2>
          <p>
            We do not guarantee that the Service will be available without interruption or free
            of errors. The Service may be suspended, changed or discontinued at any time, without
            prior notice, especially in case of maintenance, technical failure or a decision of
            the federal traffic authority or Serpro.
          </p>

          <h2>10. Intellectual Property</h2>
          <p>
            All content on the site, including the brand, logo, layout, code and organization of
            the information, is owned by Placa Completa and protected by Brazilian intellectual
            property law. Reproduction, distribution or use without prior express authorization
            is prohibited.
          </p>

          <h2>11. Changes to the Terms</h2>
          <p>
            We reserve the right to change these Terms at any time. Changes take effect as soon
            as they are published on this page. Continued use of the Service after changes
            means you accept the new Terms.
          </p>

          <h2>12. Governing Law and Jurisdiction</h2>
          <p>
            These Terms are governed by the laws of the Federative Republic of Brazil,
            especially <strong>Ordinance No. 139/2025</strong>,
            <strong>Law No. 13,709/2018 (LGPD)</strong> and, where applicable, the
            <strong>Consumer Protection Code (Law No. 8,078/1990)</strong>. The courts of the
            user's place of residence are chosen to settle any dispute, under article 101, I,
            of the Consumer Protection Code.
          </p>

          <h2>13. Contact</h2>
          <p>
            CESAR CANCADO BHERING TECNOLOGIA LTDA, CNPJ 62.569.152/0001-67<br>
            Rua Bom Pastor, Sala 03, Ipiranga, São Paulo/SP, Brazil<br>
            <strong>Email:</strong> contato@placacompleta.com.br
          </p>
        </div>

        <div class="pc-cta">
          <NuxtLink :to="rota('/')" class="pc-btn">Back</NuxtLink>
        </div>
      </template>
      <template v-else>
      <h1 class="legal-title">Termos de Uso</h1>
        <p class="legal-updated">Última atualização: 1 de outubro de 2026</p>

        <div class="legal-content">
          <h2>1. Identificação do Prestador</h2>
          <p>
            O serviço <strong>Placa Completa</strong> ("Serviço"), disponível em
            placacompleta.com.br, é fornecido por:
          </p>
          <ul>
            <li><strong>Razão social:</strong> CESAR CANCADO BHERING TECNOLOGIA LTDA</li>
            <li><strong>CNPJ:</strong> 62.569.152/0001-67</li>
            <li><strong>Endereço:</strong> Rua Bom Pastor, Sala 03, Ipiranga, São Paulo/SP</li>
            <li><strong>Contato:</strong> contato@placacompleta.com.br</li>
          </ul>

          <h2>2. Aceitação dos Termos</h2>
          <p>
            Ao utilizar o Serviço, você concorda integralmente com estes Termos de Uso e com a
            <NuxtLink to="/politica-de-privacidade">Política de Privacidade</NuxtLink>.
            Caso não concorde, não utilize o Serviço.
          </p>

          <h2>3. Fundamento Regulatório</h2>
          <p>
            O Placa Completa atua como entidade credenciada nos termos da
            <strong>Portaria SENATRAN nº 139, de 20 de fevereiro de 2025</strong>, que
            regulamenta o acesso a dados da base veicular federal por terceiros autorizados.
            O acesso aos dados ocorre por meio do serviço <em>Consulta Online SENATRAN</em>,
            operado pelo <strong>Serpro</strong>.
          </p>
          <p>
            Em observância ao <strong>art. 6º, inciso I, da Portaria 139/2025</strong>, o Placa
            Completa opera na <strong>modalidade DIRETO</strong> de acesso, integrando-se
            diretamente às APIs do Serpro/SENATRAN, sem intermediação de terceiros e sem
            revenda dos dados.
          </p>

          <h2>4. Descrição do Serviço</h2>
          <p>
            O Placa Completa é um serviço de consulta veicular por placa, voltado à
            <strong>prevenção à fraude, proteção patrimonial e proteção do crédito</strong>.
            O usuário informa a placa de um veículo e recebe informações sobre o veículo,
            incluindo:
          </p>
          <ul>
            <li><strong>Consulta de Informações Veiculares para Prevenção de Fraude e Proteção do Crédito:</strong> dados técnicos do veículo e indicadores de recall, gravame, roubo/furto, RENAJUD e débitos agregados;</li>
            <li><strong>Consulta de Infrações Vinculadas ao Veículo para Prevenção de Fraude e Proteção do Crédito:</strong> infrações em aberto do veículo, com número do auto, data, local, município/UF, órgão autuador, descrição e valor.</li>
          </ul>
          <p>
            Informações complementares (ex.: tabela FIPE) podem ser obtidas de fontes
            adicionais e são identificadas separadamente no resultado.
          </p>

          <h2>5. Finalidades Lícitas de Uso</h2>
          <p>O Serviço destina-se exclusivamente a finalidades lícitas, tais como:</p>
          <ul>
            <li>Verificação de dados de veículos em operações de compra e venda;</li>
            <li>Consulta de valor de mercado para referência;</li>
            <li>Conferência de restrições, gravames, débitos, recall e situação judicial do veículo antes de uma transação;</li>
            <li>Verificação de campanhas de recall e de segurança veicular;</li>
            <li>Conferência de infrações de trânsito em aberto vinculadas ao veículo, que impedem licenciamento e transferência (CTB arts. 128 e 131);</li>
            <li>Avaliação de risco em operações de crédito, financiamento, leasing, locação e seguros que envolvam o veículo;</li>
            <li>Conferência de informações para fins pessoais ou comerciais legítimos.</li>
          </ul>

          <h2>6. Proibições: Vedações da Portaria SENATRAN 139/2025</h2>
          <p>
            Em cumprimento à Portaria SENATRAN nº 139/2025 e à LGPD, é
            <strong>expressamente vedado</strong> ao usuário do Serviço:
          </p>
          <ul>
            <li><strong>Revender, sublicenciar, redistribuir ou ceder</strong> os dados obtidos, no todo ou em parte, a qualquer terceiro, a título oneroso ou gratuito;</li>
            <li>Utilizar os dados para <strong>finalidade diversa</strong> das declaradas nestes Termos e nos Casos de Uso aprovados pela SENATRAN;</li>
            <li>Empregar os dados para <strong>marketing, prospecção comercial, telemarketing</strong> ou envio de comunicações não solicitadas;</li>
            <li>Realizar <strong>scoring, classificação, perfilização ou ranqueamento</strong> de pessoas a partir dos dados veiculares;</li>
            <li>Utilizar os dados para <strong>discriminação ilícita</strong> de qualquer natureza;</li>
            <li>Praticar <strong>atividades ilegais, abusivas ou fraudulentas</strong>, ou que violem direitos de terceiros;</li>
            <li><strong>Coletar dados de forma automatizada</strong> (bots, scrapers, raspagem) sem autorização prévia por escrito do Placa Completa;</li>
            <li>Tentar <strong>burlar mecanismos de segurança, controle de acesso ou de auditoria</strong> da plataforma.</li>
          </ul>
          <p>
            O acesso à plataforma é <strong>monitorado e auditável</strong> pela SENATRAN e
            pelo Serpro. O uso indevido pode configurar violação à legislação brasileira,
            sujeitando o usuário às sanções civis, administrativas e penais cabíveis,
            independentemente de prévia notificação.
          </p>

          <h2>7. Dados Pessoais e LGPD</h2>
          <p>
            O tratamento de dados pessoais observa a
            <strong>Lei nº 13.709/2018 (LGPD)</strong> e a
            <strong>Portaria SENATRAN nº 139/2025</strong>. As bases legais aplicáveis,
            os direitos do titular e os canais de exercício estão descritos em detalhe na
            <NuxtLink to="/politica-de-privacidade">Política de Privacidade</NuxtLink>.
          </p>
          <p>
            Em síntese, o Placa Completa fundamenta o tratamento dos dados veiculares no
            <strong>legítimo interesse (art. 7º, IX da LGPD)</strong>, na
            <strong>proteção do crédito (art. 7º, X)</strong> e na
            <strong>execução de contrato ou procedimentos preliminares (art. 7º, V)</strong>.
          </p>
          <p>
            A nota fiscal de serviço é emitida automaticamente, após a entrega do relatório, no
            nome e CPF/CNPJ de quem efetuou o pagamento. Em caso de estorno, a nota é cancelada.
          </p>

          <h2>8. Limitação de Responsabilidade</h2>
          <p>
            As informações veiculares são obtidas junto à SENATRAN, por meio do Serpro, e
            de fontes complementares licenciadas. O Placa Completa <strong>não garante</strong>
            a exatidão, completude ou atualidade dos dados retornados, uma vez que dependem
            da atualização nas bases de origem. O Serviço é oferecido "como está" (<em>as is</em>),
            sem garantias de qualquer natureza.
          </p>
          <p>
            O Placa Completa não se responsabiliza por decisões tomadas pelo usuário com base
            nas informações fornecidas, incluindo, mas não se limitando a, decisões de compra,
            venda, financiamento ou contratação envolvendo veículos.
          </p>

          <h2>9. Disponibilidade</h2>
          <p>
            Não garantimos que o Serviço estará disponível de forma ininterrupta ou livre de
            erros. O Serviço pode ser suspenso, modificado ou descontinuado a qualquer momento,
            sem aviso prévio, especialmente em caso de manutenção, falha técnica ou
            determinação da SENATRAN/Serpro.
          </p>

          <h2>10. Propriedade Intelectual</h2>
          <p>
            Todo o conteúdo do site, incluindo marca, logotipo, layout, código e organização
            das informações, é de propriedade do Placa Completa e está protegido pela
            legislação brasileira de propriedade intelectual. É proibida a reprodução,
            distribuição ou utilização sem autorização prévia e expressa.
          </p>

          <h2>11. Alterações nos Termos</h2>
          <p>
            Reservamo-nos o direito de alterar estes Termos a qualquer momento. As alterações
            entram em vigor imediatamente após a publicação nesta página. O uso continuado do
            Serviço após alterações constitui aceitação dos novos Termos.
          </p>

          <h2>12. Legislação Aplicável e Foro</h2>
          <p>
            Estes Termos são regidos pelas leis da República Federativa do Brasil,
            especialmente pela <strong>Portaria SENATRAN nº 139/2025</strong>, pela
            <strong>Lei nº 13.709/2018 (LGPD)</strong> e, quando aplicável, pelo
            <strong>Código de Defesa do Consumidor (Lei nº 8.078/1990)</strong>. Fica eleito
            o foro da comarca do domicílio do usuário para dirimir quaisquer litígios,
            conforme o art. 101, I, do CDC.
          </p>

          <h2>13. Contato</h2>
          <p>
            CESAR CANCADO BHERING TECNOLOGIA LTDA, CNPJ 62.569.152/0001-67<br>
            Rua Bom Pastor, Sala 03, Ipiranga, São Paulo/SP<br>
            <strong>E-mail:</strong> contato@placacompleta.com.br
          </p>
        </div>

        <div class="pc-cta">
          <NuxtLink to="/" class="pc-btn">Voltar</NuxtLink>
        </div>
      </template>
    </main>
  </div>
</template>


<style lang="scss" scoped>
// Pagina legal no design novo (tokens --pc-*). SO o visual muda; o texto
// juridico fica intacto.
.legal-title {
  font-family: var(--pc-font);
  font-size: clamp(1.5rem, 4vw, 2rem);
  font-weight: 600;
  color: var(--pc-ink);
  text-align: center;
  margin-bottom: 6px;
}

.legal-updated {
  font-size: 0.8125rem;
  color: var(--pc-graphite);
  text-align: center;
  margin-bottom: 24px;
}

.legal-content {
  font-size: 0.9375rem;
  line-height: 1.7;
  color: var(--pc-charcoal);

  h2 {
    font-family: var(--pc-font);
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--pc-ink);
    margin: 28px 0 10px;
  }

  h3 {
    font-family: var(--pc-font);
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--pc-ink);
    margin: 18px 0 8px;
  }

  p { margin-bottom: 12px; }
  ul, ol { padding-left: 22px; margin-bottom: 12px; }
  li { margin-bottom: 6px; }
  strong { color: var(--pc-ink); font-weight: 600; }

  a {
    color: var(--pc-blue);
    text-decoration: none;
    border-bottom: 1px solid rgba(31, 111, 235, 0.35);
    &:hover { border-bottom-color: var(--pc-blue); }
  }
}
</style>
