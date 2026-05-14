<script setup lang="ts">
useHead({
  title: 'Política de Privacidade',
  meta: [
    { name: 'description', content: 'Política de Privacidade do Placa Completa, em conformidade com a LGPD (Lei nº 13.709/2018) e com a Portaria SENATRAN nº 139/2025.' },
    { name: 'robots', content: 'noindex, follow' },
  ],
})
</script>

<template>
  <div class="desktop">
    <main>
      <div class="win-window win-window--wide">
      <div class="win-window__titlebar">
        <span>Política de Privacidade</span>
        <div class="win-window__titlebar-buttons">
          <NuxtLink to="/" class="win-window__titlebar-btn">&times;</NuxtLink>
        </div>
      </div>
      <div class="win-window__body">
        <h1 class="legal-title">Política de Privacidade</h1>
        <p class="legal-updated">Última atualização: 14 de maio de 2026</p>

        <div class="legal-content">
          <p>
            Esta Política de Privacidade descreve como o <strong>Placa Completa</strong>
            ("nós", "nosso") coleta, usa, compartilha e protege os dados pessoais dos usuários
            ("você", "titular"), em conformidade com a
            <strong>Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD)</strong>
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
            Cesar Cancado Bhering — e-mail
            <strong>cesarcbhering@gmail.com</strong>.
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
            <li><strong>Endereço de e-mail</strong> — para envio do resultado da consulta;</li>
            <li><strong>Número de telefone</strong> (opcional) — caso informado voluntariamente;</li>
            <li><strong>Placa do veículo</strong> — para identificar o objeto da consulta.</li>
          </ul>

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
            <li><strong>CU-01 — Dados cadastrais (RENAVAM):</strong> identificação e ficha técnica do veículo;</li>
            <li><strong>CU-02 — Restrições e gravames (RENAVAM):</strong> verificação de restrições e risco de comercialização;</li>
            <li><strong>CU-03 — Roubo e furto (RENAVAM / Infoseg):</strong> verificação da situação de ocorrência;</li>
            <li><strong>CU-04 — Débitos, multas e situação fiscal (RENAINF);</strong></li>
            <li><strong>CU-05 — Campanhas de recall (base de recall SENATRAN);</strong></li>
            <li><strong>CU-06 — Restrições judiciais (RENAJUD).</strong></li>
          </ul>

          <h3>3.4 Dados que NÃO são tratados</h3>
          <p>
            O Placa Completa <strong>não trata dados pessoais sensíveis</strong>
            (art. 5º, II, da LGPD), tais como dados biométricos, fotografia do titular,
            informações de saúde, exame toxicológico, dados de origem racial ou étnica,
            convicção religiosa ou orientação sexual.
          </p>

          <h2>4. Finalidades do Tratamento</h2>
          <ul>
            <li><strong>Execução do serviço:</strong> realizar a consulta veicular e enviar o resultado ao e-mail informado;</li>
            <li><strong>Prevenção à fraude e proteção patrimonial:</strong> permitir ao consulente verificar restrições, gravames, roubo/furto, débitos e ônus antes de transações envolvendo o veículo;</li>
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
              <strong>Art. 7º, IX — Legítimo interesse do controlador ou de terceiro
              (base legal principal):</strong> transparência veicular, prevenção à fraude e
              proteção patrimonial do consulente em transações civis e comerciais envolvendo
              veículos;
            </li>
            <li>
              <strong>Art. 7º, X — Proteção do crédito:</strong> para subsidiar a verificação
              de restrições, gravames e ônus que afetem a viabilidade econômica e jurídica de
              operações que envolvam o veículo;
            </li>
            <li>
              <strong>Art. 7º, V — Execução de contrato ou de procedimentos preliminares a
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
            <li><strong>SENATRAN e Serpro</strong> — para supervisão, auditoria e controle do acesso autorizado, nos termos da Portaria 139/2025;</li>
            <li><strong>Resend</strong> — provedor de e-mail transacional, que processa apenas o e-mail e o conteúdo da mensagem com o resultado da consulta;</li>
            <li><strong>Supabase</strong> — provedor de banco de dados utilizado para armazenamento seguro dos registros de consulta;</li>
            <li><strong>Google Analytics</strong> — análise agregada e anonimizada de tráfego.</li>
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
            <li>Após o prazo, os dados são eliminados de forma segura ou anonimizados.</li>
          </ul>

          <h2>10. Direitos do Titular (art. 18 da LGPD)</h2>
          <p>
            Você, como titular dos dados pessoais, tem os seguintes direitos garantidos pela
            LGPD, que podem ser exercidos a qualquer momento:
          </p>
          <ul>
            <li><strong>I</strong> — Confirmação da existência de tratamento;</li>
            <li><strong>II</strong> — Acesso aos seus dados;</li>
            <li><strong>III</strong> — Correção de dados incompletos, inexatos ou desatualizados;</li>
            <li><strong>IV</strong> — Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade;</li>
            <li><strong>V</strong> — Portabilidade dos dados;</li>
            <li><strong>VI</strong> — Eliminação dos dados tratados com consentimento;</li>
            <li><strong>VII</strong> — Informação sobre compartilhamento;</li>
            <li><strong>VIII</strong> — Informação sobre a possibilidade de não fornecer consentimento;</li>
            <li><strong>IX</strong> — Revogação do consentimento, quando aplicável.</li>
          </ul>
          <p>
            Para exercer qualquer desses direitos, entre em contato pelo e-mail
            <strong>contato@placacompleta.com.br</strong> ou diretamente com o Encarregado
            (DPO) em <strong>cesarcbhering@gmail.com</strong>. Responderemos em até 15 dias
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
            CESAR CANCADO BHERING TECNOLOGIA LTDA — CNPJ 62.569.152/0001-67<br>
            Rua Bom Pastor, Sala 03, Ipiranga, São Paulo/SP<br>
            <strong>E-mail geral:</strong> contato@placacompleta.com.br<br>
            <strong>Encarregado (DPO):</strong> Cesar Cancado Bhering — cesarcbhering@gmail.com
          </p>
        </div>

        <div class="text-center mt-md">
          <NuxtLink to="/" class="win-btn">Voltar</NuxtLink>
        </div>
      </div>
    </div>
    </main>
  </div>
</template>

<style lang="scss" scoped>
.legal-title {
  font-family: $font-display;
  font-size: 1.75rem;
  color: $navy-electric;
  text-align: center;
  margin-bottom: $space-xs;
}

.legal-updated {
  font-size: 0.75rem;
  color: $win-dark;
  text-align: center;
  margin-bottom: $space-md;
}

.legal-content {
  font-size: 0.8125rem;
  line-height: 1.7;
  color: $graphite;

  h2 {
    font-family: $font-display;
    font-size: 1.125rem;
    color: $navy-electric;
    margin: $space-lg 0 $space-sm;
  }

  h3 {
    font-family: $font-display;
    font-size: 1rem;
    color: $graphite;
    margin: $space-md 0 $space-xs;
  }

  p { margin-bottom: $space-sm; }

  ul, ol {
    padding-left: $space-lg;
    margin-bottom: $space-sm;
  }

  li { margin-bottom: $space-xs; }

  a {
    color: $smart-blue;
    text-decoration: underline;
  }
}

.legal-quote {
  @include win-border-sunken;
  background: $powder-blue;
  padding: $space-sm $space-md;
  font-style: italic;
  font-size: 0.75rem;
  margin: $space-sm 0 $space-md;
  line-height: 1.6;
}
</style>
