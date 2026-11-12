<script setup lang="ts">
import { DESCRICOES_EN } from '~/shared/seo-meta-en'
const { emIngles, rota } = useIdioma()

// English twin (Nov 6, 2026): a courtesy translation. The PT text prevails,
// and the page says so at the top. The PT head below is the original one.
if (emIngles.value) {
  useHead({
    title: 'Privacy Policy',
    meta: [
      { name: 'description', content: DESCRICOES_EN.privacidade },
      { name: 'robots', content: 'noindex, follow' },
    ],
  })
} else {
  useHead({
    title: 'Política de Privacidade',
    meta: [
      { name: 'description', content: 'Política de Privacidade do Placa Completa, em conformidade com a LGPD (Lei nº 13.709/2018) e com a Portaria SENATRAN nº 139/2025.' },
      { name: 'robots', content: 'noindex, follow' },
    ],
  })
}
</script>

<template>
  <div class="pc-page">
    <main class="pc-container">
      <template v-if="emIngles">
      <h1 class="legal-title">Privacy Policy</h1>
        <p class="legal-updated">Last updated: October 1, 2026</p>
        <p class="legal-updated"><strong>This is a courtesy translation. The <NuxtLink to="/politica-de-privacidade" hreflang="pt-BR">Portuguese version</NuxtLink> is the binding one and prevails in case of any difference.</strong></p>

        <div class="legal-content">
          <p>
            This Privacy Policy describes how <strong>Placa Completa</strong>
            ("we", "our") collects, uses, shares and protects the personal data of its users
            ("you", "data subject"), in accordance with the
            <strong>Brazilian General Data Protection Law (Law No. 13,709/2018, LGPD)</strong>
            and with <strong>Ordinance No. 139 of February 20, 2025, of the Brazilian National Traffic Secretariat</strong>,
            which governs access to data from the federal vehicle database.
          </p>

          <h2>1. Controller, Processors and Data Protection Officer (DPO)</h2>
          <p>
            The controller of the personal data processed on this platform is:
          </p>
          <ul>
            <li><strong>Legal name:</strong> CESAR CANCADO BHERING TECNOLOGIA LTDA</li>
            <li><strong>CNPJ (Brazilian company ID):</strong> 62.569.152/0001-67</li>
            <li><strong>Address:</strong> Rua Bom Pastor, Sala 03, Ipiranga, São Paulo/SP, Brazil</li>
            <li><strong>Trade name / brand:</strong> Placa Completa</li>
          </ul>
          <p>
            <strong>Data Protection Officer (DPO):</strong>
            Cesar Cancado Bhering, email
            <strong>cesarcbhering@placacompleta.com.br</strong>.
          </p>
          <p>
            For data originating from the federal vehicle database, the original controller is
            the <strong>Brazilian National Traffic Secretariat</strong>, and
            <strong>Serpro</strong> is the technical processor responsible for providing the
            federal online vehicle lookup service. Placa Completa is an accredited user entity
            under Ordinance No. 139/2025.
          </p>

          <h2>2. Access Mode to the Federal Vehicle Database</h2>
          <p>
            Under <strong>article 6, item I, of Ordinance No. 139/2025</strong>,
            Placa Completa operates in the <strong>DIRECT access mode</strong> to data from the
            federal vehicle database. This means that:
          </p>
          <ul>
            <li>Placa Completa integrates directly with the federal APIs operated by Serpro, with no third-party intermediation;</li>
            <li>Data is used only for the purposes stated in the Secure Handling Commitment Term (TCMS) and in the approved Use Cases;</li>
            <li><strong>There is no resale, sublicensing, mass redistribution or transfer of data</strong> to third parties.</li>
          </ul>

          <h2>3. Personal Data Collected</h2>

          <h3>3.1 Data provided by the platform user</h3>
          <ul>
            <li><strong>Email address</strong>: to send the result of the check;</li>
            <li><strong>Phone number</strong> (optional), if voluntarily provided;</li>
            <li><strong>Vehicle license plate</strong>: to identify what is being checked;</li>
            <li><strong>Payer's name and CPF or CNPJ</strong>: received from the payment method (Pix or card) when you pay for a report, to issue the electronic service invoice (NFS-e) in your name and to meet the company's tax obligations.</li>
          </ul>
          <p>
            When you pay for a report, we receive from the payment method (Pix or card) the name
            and the CPF or CNPJ of the person who paid. We keep this data to issue the electronic
            service invoice (NFS-e) in your name and to meet the company's tax obligations. It is
            stored encrypted for the period required by tax law (5 years) and is not used for any
            other purpose.
          </p>

          <h3>3.2 Data collected automatically</h3>
          <ul>
            <li><strong>IP address</strong>;</li>
            <li><strong>User-Agent</strong> (browser type and operating system);</li>
            <li><strong>Device type</strong> (mobile/desktop);</li>
            <li><strong>Date and time</strong> of the check, for operation logging purposes.</li>
          </ul>

          <h3>3.3 Vehicle data obtained from the federal vehicle database (via Serpro)</h3>
          <p>
            The check returns information about the <strong>vehicle</strong> (not about its
            owner), grouped in the following approved Use Cases:
          </p>
          <ul>
            <li><strong>Vehicle Information Lookup for Fraud Prevention and Credit Protection:</strong> technical data of the vehicle and indicators of recalls, liens, theft, RENAJUD court restrictions and aggregated outstanding fees.</li>
            <li><strong>Lookup of Traffic Violations Linked to the Vehicle for Fraud Prevention and Credit Protection:</strong> unpaid violations of the vehicle, with ticket number, date, place, city/state, issuing authority, description and amount.</li>
          </ul>
          <p>
            No data about the offending driver or the owner is processed. Violations already
            paid are discarded and neither shown nor stored.
          </p>

          <h3>3.4 Data that is NOT processed</h3>
          <p>
            Placa Completa <strong>does not process sensitive personal data</strong>
            (LGPD article 5, II), such as biometric data, photographs of the data subject,
            health information, drug test results, data on racial or ethnic origin, religious
            belief or sexual orientation. Nor does it process data about the offending driver,
            driver's license points or readings from enforcement equipment (speed cameras,
            breathalyzers). The payer's CPF or CNPJ is processed only to issue the invoice, as
            described in 3.1.
          </p>

          <h2>4. Purposes of Processing</h2>
          <ul>
            <li><strong>Providing the service:</strong> running the vehicle check and sending the result to the email provided;</li>
            <li><strong>Fraud prevention and asset protection:</strong> allowing the person checking to verify restrictions, liens, theft, outstanding fees and encumbrances, unpaid violations linked to the vehicle and signs of plate cloning before transactions involving the vehicle;</li>
            <li><strong>Credit protection:</strong> supporting risk analysis in deals where the vehicle is collateral or the object of the operation;</li>
            <li><strong>Operation logs:</strong> keeping logs of checks for internal control, auditing by the federal traffic authority and Serpro, and abuse prevention;</li>
            <li><strong>Service improvement:</strong> aggregated and anonymous usage analysis to improve the platform.</li>
          </ul>
          <p>
            Using the data for marketing, sales prospecting, scoring, profiling or discrimination
            against people is <strong>forbidden</strong>.
          </p>

          <h2>5. Legal Bases (LGPD)</h2>
          <p>
            The processing of data by Placa Completa, especially when accessing the federal
            vehicle database, is based on the following grounds of
            <strong>LGPD article 7</strong>:
          </p>
          <ul>
            <li>
              <strong>Article 7, IX: Legitimate interest of the controller or a third party
              (main legal basis):</strong> vehicle transparency, fraud prevention and asset
              protection of the person checking in civil and commercial transactions involving
              vehicles;
            </li>
            <li>
              <strong>Article 7, X, Credit protection:</strong> to support checking restrictions,
              liens and encumbrances that affect the economic and legal viability of operations
              involving the vehicle;
            </li>
            <li>
              <strong>Article 7, V: Performance of a contract or of procedures preliminary to a
              contract:</strong> applicable to purchase and sale, financing, leasing, rental and
              insurance negotiations in which the vehicle check is a natural prior step.
            </li>
          </ul>
          <p>
            Placa Completa <strong>does not use consent (article 7, I) as the main legal
            basis</strong> for accessing vehicle data, since the subject of the vehicle data
            (the owner) is not necessarily the person running the check. For processing the
            platform user's own sign-up data (email, phone), legitimate interest (article 7, IX)
            and performance of a contract (article 7, V) apply.
          </p>

          <h2>6. Access, Authentication and Logs</h2>
          <ul>
            <li>Access to the federal systems operated by Serpro through individual credentials with multi-factor authentication (MFA);</li>
            <li>Communication only over HTTPS/TLS;</li>
            <li>Authentication and check logs recorded and kept for <strong>at least 12 months</strong> (24 months for theft and RENAJUD data);</li>
            <li>An access inventory is available for auditing by the federal traffic authority and by Serpro.</li>
          </ul>

          <h2>7. Data Sharing</h2>
          <p>Your data may be shared with the following parties, only to provide the service:</p>
          <ul>
            <li><strong>The federal traffic authority and Serpro</strong>: for supervision, auditing and control of authorized access, under Ordinance 139/2025;</li>
            <li><strong>Resend</strong>: transactional email provider, which processes only the email address and the content of the message with the result of the check;</li>
            <li><strong>Supabase</strong>: database provider used to securely store check records;</li>
            <li><strong>Google Analytics</strong>: aggregated and anonymized traffic analysis.</li>
          </ul>
          <p>
            Data from the federal vehicle database is <strong>not transferred, resold or
            redistributed</strong> to third parties without the express authorization of the
            federal traffic authority. There is no sale, rental or sharing of data for marketing
            purposes.
          </p>

          <h2>8. Storage and Information Security</h2>
          <ul>
            <li>Encryption in transit (TLS/SSL) and at rest;</li>
            <li>Access control with MFA and the principle of least privilege;</li>
            <li>Firewall and network segmentation (OCI Security Lists);</li>
            <li>Security updates applied within 15 days, and within 48 hours for critical flaws;</li>
            <li>In case of a security incident involving data from the federal vehicle database, immediate notice to the federal traffic authority, Serpro and the <strong>National Data Protection Authority (ANPD)</strong>, following the procedures in Ordinance 139/2025 and the LGPD.</li>
          </ul>
          <p class="legal-quote">
            Under <strong>LGPD article 46</strong>: "Processing agents must adopt security,
            technical and administrative measures able to protect personal data from
            unauthorized access and from accidental or unlawful situations of destruction, loss,
            alteration, communication or any form of improper or unlawful processing."
          </p>

          <h2>9. Retention and Deletion</h2>
          <ul>
            <li>Platform user data: kept for as long as needed to provide the service and to comply with legal obligations;</li>
            <li>Check logs: at least 12 months; 24 months for theft and RENAJUD data;</li>
            <li>Payer's name and CPF or CNPJ, for tax purposes: 5 years, encrypted, as required by tax law;</li>
            <li>After that period, the data is securely deleted or anonymized.</li>
          </ul>

          <h2>10. Rights of the Data Subject (LGPD article 18)</h2>
          <p>
            As the subject of the personal data, you have the following rights under the LGPD,
            which you may exercise at any time:
          </p>
          <ul>
            <li><strong>I</strong>: Confirmation that processing exists;</li>
            <li><strong>II</strong>: Access to your data;</li>
            <li><strong>III</strong>: Correction of incomplete, inaccurate or outdated data;</li>
            <li><strong>IV</strong>: Anonymization, blocking or deletion of unnecessary or excessive data, or data processed in breach of the law;</li>
            <li><strong>V</strong>: Data portability;</li>
            <li><strong>VI</strong>: Deletion of data processed with consent;</li>
            <li><strong>VII</strong>: Information about data sharing;</li>
            <li><strong>VIII</strong>: Information about the possibility of not giving consent;</li>
            <li><strong>IX</strong>: Withdrawal of consent, where applicable.</li>
          </ul>
          <p>
            To exercise any of these rights, write to
            <strong>contato@placacompleta.com.br</strong> or directly to the Data Protection
            Officer at <strong>cesarcbhering@placacompleta.com.br</strong>. We will reply within 15
            business days, under LGPD article 18, paragraph 3.
          </p>
          <p>
            Note: for data from the federal vehicle database, whose controller is the federal
            traffic authority itself, the data subject may also contact that authority directly.
          </p>

          <h2>11. Permanent Channel for Data Subjects (article 22 of Ordinance 139/2025)</h2>
          <p>
            In compliance with <strong>article 22 of Ordinance No. 139/2025</strong>,
            we keep a permanent service channel for data subjects:
          </p>
          <ul>
            <li><strong>Dedicated email:</strong> contato@placacompleta.com.br</li>
            <li><strong>Availability:</strong> 24 hours, with a reply within 15 business days.</li>
          </ul>

          <h2>12. Cookies and Tracking Technologies</h2>
          <p>
            We use <strong>Google Analytics</strong> for traffic analysis. Cookies may be used to
            collect aggregated and anonymous information about how the site is used. You can
            disable cookies in your browser settings.
          </p>

          <h2>13. International Data Transfer</h2>
          <p>
            Some providers (Supabase, Resend, Google) may store data on servers located outside
            Brazil. In these cases, we make sure the transfer complies with LGPD article 33,
            including contractual clauses that ensure an adequate level of protection.
          </p>

          <h2>14. Minors</h2>
          <p>
            The Service is not aimed at people under 18 and we do not knowingly collect data from
            minors. Any such processing will follow LGPD article 14.
          </p>

          <h2>15. Changes to this Policy</h2>
          <p>
            This Policy may be updated from time to time. The current version is always
            published at <strong>https://placacompleta.com.br/politica-de-privacidade</strong>
            with its update date. We recommend checking it regularly.
          </p>

          <h2>16. Contact</h2>
          <p>
            CESAR CANCADO BHERING TECNOLOGIA LTDA, CNPJ 62.569.152/0001-67<br>
            Rua Bom Pastor, Sala 03, Ipiranga, São Paulo/SP, Brazil<br>
            <strong>General email:</strong> contato@placacompleta.com.br<br>
            <strong>Data Protection Officer (DPO):</strong> Cesar Cancado Bhering, cesarcbhering@placacompleta.com.br
          </p>
        </div>

        <div class="pc-cta">
          <NuxtLink :to="rota('/')" class="pc-btn">Back</NuxtLink>
        </div>
      </template>
      <template v-else>
      <h1 class="legal-title">Política de Privacidade</h1>
        <p class="legal-updated">Última atualização: 1 de outubro de 2026</p>

        <div class="legal-content">
          <p>
            Esta Política de Privacidade descreve como o <strong>Placa Completa</strong>
            ("nós", "nosso") coleta, usa, compartilha e protege os dados pessoais dos usuários
            ("você", "titular"), em conformidade com a
            <strong>Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018, LGPD)</strong>
            e com a <strong>Portaria SENATRAN nº 139, de 20 de fevereiro de 2025</strong>, que
            regulamenta o acesso a dados da base veicular federal.
          </p>

          <h2>1. Controlador, Operadores e Encarregado (DPO)</h2>
          <p>
            O controlador dos dados pessoais tratados nesta plataforma é:
          </p>
          <ul>
            <li><strong>Razão social:</strong> CESAR CANCADO BHERING TECNOLOGIA LTDA</li>
            <li><strong>CNPJ:</strong> 62.569.152/0001-67</li>
            <li><strong>Endereço:</strong> Rua Bom Pastor, Sala 03, Ipiranga, São Paulo/SP</li>
            <li><strong>Nome fantasia / marca:</strong> Placa Completa</li>
          </ul>
          <p>
            <strong>Encarregado pelo Tratamento de Dados (DPO):</strong>
            Cesar Cancado Bhering, e-mail
            <strong>cesarcbhering@placacompleta.com.br</strong>.
          </p>
          <p>
            Para os dados de origem da base veicular federal, o controlador originário é a
            <strong>Secretaria Nacional de Trânsito (SENATRAN)</strong>, sendo o
            <strong>Serpro</strong> o operador técnico responsável pela disponibilização do
            serviço <em>Consulta Online SENATRAN</em>. O Placa Completa figura como entidade
            usuária credenciada nos termos da Portaria SENATRAN nº 139/2025.
          </p>

          <h2>2. Modalidade de Acesso à Base SENATRAN</h2>
          <p>
            Em observância ao <strong>art. 6º, inciso I, da Portaria SENATRAN nº 139/2025</strong>,
            o Placa Completa atua na <strong>modalidade DIRETO</strong> de acesso aos dados da
            base veicular federal. Isso significa que:
          </p>
          <ul>
            <li>O Placa Completa integra-se diretamente às APIs do Serpro/SENATRAN, sem intermediação de terceiros;</li>
            <li>Os dados são consumidos exclusivamente para as finalidades declaradas no Termo de Compromisso de Manuseio Seguro (TCMS) e nos Casos de Uso aprovados;</li>
            <li><strong>Não há revenda, sublicenciamento, redistribuição em massa ou cessão de dados</strong> a terceiros.</li>
          </ul>

          <h2>3. Dados Pessoais Coletados</h2>

          <h3>3.1 Dados fornecidos pelo usuário da plataforma</h3>
          <ul>
            <li><strong>Endereço de e-mail</strong>: para envio do resultado da consulta;</li>
            <li><strong>Número de telefone</strong> (opcional), caso informado voluntariamente;</li>
            <li><strong>Placa do veículo</strong>: para identificar o objeto da consulta;</li>
            <li><strong>Nome e CPF ou CNPJ do pagador</strong>: recebidos do meio de pagamento (Pix ou cartão) quando você paga um relatório, para emitir a nota fiscal de serviço (NFS-e) em seu nome e cumprir as obrigações fiscais da empresa.</li>
          </ul>
          <p>
            Ao pagar um relatório, recebemos do meio de pagamento (Pix ou cartão) o nome e o CPF
            ou CNPJ de quem pagou. Guardamos esses dados para emitir a nota fiscal de serviço
            (NFS-e) em seu nome e para cumprir as obrigações fiscais da empresa. Eles ficam
            armazenados de forma cifrada pelo prazo exigido pela legislação tributária (5 anos)
            e não são usados para nenhuma outra finalidade.
          </p>

          <h3>3.2 Dados coletados automaticamente</h3>
          <ul>
            <li><strong>Endereço IP</strong>;</li>
            <li><strong>User-Agent</strong> (tipo de navegador e sistema operacional);</li>
            <li><strong>Tipo de dispositivo</strong> (mobile/desktop);</li>
            <li><strong>Data e hora</strong> da consulta, para fins de registro de operações.</li>
          </ul>

          <h3>3.3 Dados veiculares obtidos da SENATRAN (via Serpro)</h3>
          <p>
            A consulta retorna informações sobre o <strong>veículo</strong> (não sobre o seu
            proprietário), distribuídas nos seguintes Casos de Uso aprovados:
          </p>
          <ul>
            <li><strong>Consulta de Informações Veiculares para Prevenção de Fraude e Proteção do Crédito:</strong> dados técnicos do veículo e indicadores de recall, gravame, roubo/furto, RENAJUD e débitos agregados.</li>
            <li><strong>Consulta de Infrações Vinculadas ao Veículo para Prevenção de Fraude e Proteção do Crédito:</strong> infrações em aberto do veículo, com número do auto, data, local, município/UF, órgão autuador, descrição e valor.</li>
          </ul>
          <p>
            Não são tratados dados do condutor infrator nem do proprietário. Infrações já
            pagas são descartadas e não são exibidas nem armazenadas.
          </p>

          <h3>3.4 Dados que NÃO são tratados</h3>
          <p>
            O Placa Completa <strong>não trata dados pessoais sensíveis</strong>
            (art. 5º, II, da LGPD), tais como dados biométricos, fotografia do titular,
            informações de saúde, exame toxicológico, dados de origem racial ou étnica,
            convicção religiosa ou orientação sexual. Também não são tratados dados do
            condutor infrator, pontuação de CNH e medições de equipamentos de fiscalização
            (velocidade, etilômetro). O CPF ou CNPJ do pagador é tratado apenas para a emissão
            da nota fiscal, como descrito em 3.1.
          </p>

          <h2>4. Finalidades do Tratamento</h2>
          <ul>
            <li><strong>Execução do serviço:</strong> realizar a consulta veicular e enviar o resultado ao e-mail informado;</li>
            <li><strong>Prevenção à fraude e proteção patrimonial:</strong> permitir ao consulente verificar restrições, gravames, roubo/furto, débitos e ônus, infrações em aberto vinculadas ao veículo e indícios de clonagem de placa antes de transações envolvendo o veículo;</li>
            <li><strong>Proteção ao crédito:</strong> subsidiar análises de risco em negociações que envolvam o veículo como garantia ou objeto da operação;</li>
            <li><strong>Registro de operações:</strong> manter logs de consultas para controle interno, auditabilidade pela SENATRAN/Serpro e prevenção de abusos;</li>
            <li><strong>Melhoria do serviço:</strong> análise agregada e anônima de uso para aprimoramento da plataforma.</li>
          </ul>
          <p>
            É <strong>vedado</strong> o uso dos dados para marketing, prospecção comercial,
            scoring, perfilização ou discriminação de pessoas.
          </p>

          <h2>5. Bases Legais (LGPD)</h2>
          <p>
            O tratamento dos dados realizados pelo Placa Completa, em especial no acesso à base
            veicular SENATRAN, fundamenta-se nas seguintes hipóteses do
            <strong>art. 7º da LGPD</strong>:
          </p>
          <ul>
            <li>
              <strong>Art. 7º, IX: Legítimo interesse do controlador ou de terceiro
              (base legal principal):</strong> transparência veicular, prevenção à fraude e
              proteção patrimonial do consulente em transações civis e comerciais envolvendo
              veículos;
            </li>
            <li>
              <strong>Art. 7º, X, Proteção do crédito:</strong> para subsidiar a verificação
              de restrições, gravames e ônus que afetem a viabilidade econômica e jurídica de
              operações que envolvam o veículo;
            </li>
            <li>
              <strong>Art. 7º, V: Execução de contrato ou de procedimentos preliminares a
              contrato:</strong> aplicável às negociações de compra e venda, financiamento,
              leasing, locação e seguros em que a consulta veicular é etapa prévia natural.
            </li>
          </ul>
          <p>
            O Placa Completa <strong>não utiliza consentimento (art. 7º, I) como base legal
            principal</strong> para o acesso aos dados veiculares, dado que o titular dos dados
            do veículo (proprietário) não é, necessariamente, a pessoa que realiza a consulta.
            Para o tratamento dos dados de cadastro do próprio usuário da plataforma
            (e-mail, telefone) prevalecem o legítimo interesse (art. 7º, IX) e a execução
            contratual (art. 7º, V).
          </p>

          <h2>6. Acesso, Autenticação e Registros</h2>
          <ul>
            <li>Acesso aos sistemas SENATRAN/Serpro mediante credenciais individuais com autenticação multifator (MFA);</li>
            <li>Comunicação exclusivamente por HTTPS/TLS;</li>
            <li>Logs de autenticação e de consultas registrados e guardados por <strong>no mínimo 12 meses</strong> (24 meses para dados de roubo/furto e RENAJUD);</li>
            <li>Inventário de acessos disponível para auditoria pela SENATRAN e pelo Serpro.</li>
          </ul>

          <h2>7. Compartilhamento de Dados</h2>
          <p>Seus dados podem ser compartilhados com os seguintes agentes, exclusivamente para a execução do serviço:</p>
          <ul>
            <li><strong>SENATRAN e Serpro</strong>: para supervisão, auditoria e controle do acesso autorizado, nos termos da Portaria 139/2025;</li>
            <li><strong>Resend</strong>: provedor de e-mail transacional, que processa apenas o e-mail e o conteúdo da mensagem com o resultado da consulta;</li>
            <li><strong>Supabase</strong>: provedor de banco de dados utilizado para armazenamento seguro dos registros de consulta;</li>
            <li><strong>Google Analytics</strong>: análise agregada e anonimizada de tráfego.</li>
          </ul>
          <p>
            Os dados de origem SENATRAN <strong>não são cedidos, revendidos ou
            redistribuídos</strong> a terceiros sem autorização expressa da SENATRAN. Não há
            venda, aluguel ou compartilhamento de dados para fins de marketing.
          </p>

          <h2>8. Armazenamento e Segurança da Informação</h2>
          <ul>
            <li>Criptografia em trânsito (TLS/SSL) e em repouso;</li>
            <li>Controle de acesso com MFA e princípio do menor privilégio;</li>
            <li>Firewall e segmentação de rede (OCI Security Lists);</li>
            <li>Atualizações de segurança aplicadas em até 15 dias, e em até 48 horas para falhas críticas;</li>
            <li>Em caso de incidente de segurança envolvendo dados SENATRAN, notificação imediata à SENATRAN/Serpro e à <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong>, conforme procedimentos previstos na Portaria 139/2025 e na LGPD.</li>
          </ul>
          <p class="legal-quote">
            Conforme o <strong>art. 46 da LGPD</strong>: "Os agentes de tratamento devem adotar
            medidas de segurança, técnicas e administrativas aptas a proteger os dados pessoais
            de acessos não autorizados e de situações acidentais ou ilícitas de destruição,
            perda, alteração, comunicação ou qualquer forma de tratamento inadequado ou ilícito."
          </p>

          <h2>9. Retenção e Eliminação</h2>
          <ul>
            <li>Dados do usuário da plataforma: retidos pelo período necessário à prestação do serviço e ao cumprimento de obrigações legais;</li>
            <li>Logs de consulta: mínimo 12 meses; 24 meses para dados de roubo/furto e RENAJUD;</li>
            <li>Nome e CPF ou CNPJ do pagador, para fins fiscais: 5 anos, cifrados, conforme a legislação tributária;</li>
            <li>Após o prazo, os dados são eliminados de forma segura ou anonimizados.</li>
          </ul>

          <h2>10. Direitos do Titular (art. 18 da LGPD)</h2>
          <p>
            Você, como titular dos dados pessoais, tem os seguintes direitos garantidos pela
            LGPD, que podem ser exercidos a qualquer momento:
          </p>
          <ul>
            <li><strong>I</strong>: Confirmação da existência de tratamento;</li>
            <li><strong>II</strong>: Acesso aos seus dados;</li>
            <li><strong>III</strong>: Correção de dados incompletos, inexatos ou desatualizados;</li>
            <li><strong>IV</strong>: Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade;</li>
            <li><strong>V</strong>: Portabilidade dos dados;</li>
            <li><strong>VI</strong>: Eliminação dos dados tratados com consentimento;</li>
            <li><strong>VII</strong>: Informação sobre compartilhamento;</li>
            <li><strong>VIII</strong>: Informação sobre a possibilidade de não fornecer consentimento;</li>
            <li><strong>IX</strong>: Revogação do consentimento, quando aplicável.</li>
          </ul>
          <p>
            Para exercer qualquer desses direitos, entre em contato pelo e-mail
            <strong>contato@placacompleta.com.br</strong> ou diretamente com o Encarregado
            (DPO) em <strong>cesarcbhering@placacompleta.com.br</strong>. Responderemos em até 15 dias
            úteis, conforme art. 18, §3º da LGPD.
          </p>
          <p>
            Observação: para os dados de origem SENATRAN, cujo controlador é a própria
            SENATRAN, o titular também pode se dirigir diretamente àquele órgão.
          </p>

          <h2>11. Canal Permanente ao Titular (art. 22 da Portaria 139/2025)</h2>
          <p>
            Em cumprimento ao <strong>art. 22 da Portaria SENATRAN nº 139/2025</strong>,
            mantemos canal permanente de atendimento ao titular dos dados:
          </p>
          <ul>
            <li><strong>E-mail dedicado:</strong> contato@placacompleta.com.br</li>
            <li><strong>Disponibilidade:</strong> 24 horas, com resposta em até 15 dias úteis.</li>
          </ul>

          <h2>12. Cookies e Tecnologias de Rastreamento</h2>
          <p>
            Utilizamos o <strong>Google Analytics</strong> para análise de tráfego. Cookies
            podem ser usados para coletar informações de forma agregada e anônima sobre o uso
            do site. Você pode desativar cookies nas configurações do seu navegador.
          </p>

          <h2>13. Transferência Internacional de Dados</h2>
          <p>
            Alguns prestadores (Supabase, Resend, Google) podem armazenar dados em servidores
            localizados fora do Brasil. Nesses casos, asseguramos que a transferência atende
            ao disposto no art. 33 da LGPD, incluindo cláusulas contratuais que garantam
            nível adequado de proteção.
          </p>

          <h2>14. Menores de Idade</h2>
          <p>
            O Serviço não é direcionado a menores de 18 anos e não coletamos intencionalmente
            dados de menores. O tratamento eventual observará o art. 14 da LGPD.
          </p>

          <h2>15. Alterações nesta Política</h2>
          <p>
            Esta Política pode ser atualizada periodicamente. A versão vigente é sempre
            publicada em <strong>https://placacompleta.com.br/politica-de-privacidade</strong>
            com a respectiva data de atualização. Recomendamos consulta periódica.
          </p>

          <h2>16. Contato</h2>
          <p>
            CESAR CANCADO BHERING TECNOLOGIA LTDA, CNPJ 62.569.152/0001-67<br>
            Rua Bom Pastor, Sala 03, Ipiranga, São Paulo/SP<br>
            <strong>E-mail geral:</strong> contato@placacompleta.com.br<br>
            <strong>Encarregado (DPO):</strong> Cesar Cancado Bhering, cesarcbhering@placacompleta.com.br
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

.legal-quote {
  background: var(--pc-cloud);
  border: 1px solid var(--pc-hairline);
  border-left: 3px solid var(--pc-blue);
  border-radius: 12px;
  padding: 12px 16px;
  font-style: italic;
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--pc-charcoal);
  margin: 12px 0 16px;
}
</style>
