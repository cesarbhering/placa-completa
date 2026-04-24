<script setup lang="ts">
useHead({
  title: 'Política de Privacidade',
  meta: [
    { name: 'description', content: 'Política de Privacidade do Placa Completa, em conformidade com a LGPD (Lei nº 13.709/2018).' },
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
        <p class="legal-updated">Última atualização: 24 de abril de 2026</p>

        <div class="legal-content">
          <p>
            Esta Política de Privacidade descreve como o <strong>Placa Completa</strong>
            ("nós", "nosso") coleta, usa e protege os dados pessoais dos usuários ("você",
            "titular"), em conformidade com a
            <strong>Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD)</strong>.
          </p>

          <h2>1. Dados Pessoais Coletados</h2>
          <p>Ao utilizar nosso serviço, coletamos os seguintes dados:</p>

          <h3>1.1 Dados fornecidos por você:</h3>
          <ul>
            <li><strong>Endereço de e-mail</strong> — para envio do resultado da consulta;</li>
            <li><strong>Número de telefone</strong> (opcional) — caso informado voluntariamente;</li>
            <li><strong>Placa do veículo</strong> — para realizar a consulta.</li>
          </ul>

          <h3>1.2 Dados coletados automaticamente:</h3>
          <ul>
            <li><strong>Endereço IP</strong>;</li>
            <li><strong>User-Agent</strong> (tipo de navegador e sistema operacional);</li>
            <li><strong>Tipo de dispositivo</strong> (mobile/desktop);</li>
            <li><strong>Data e hora</strong> da consulta.</li>
          </ul>
          <p class="legal-quote">
            Conforme o <strong>art. 7º, I da LGPD</strong>: "O tratamento de dados pessoais
            somente poderá ser realizado [...] mediante o fornecimento de consentimento pelo
            titular." — Ao submeter o formulário de consulta, você consente com o tratamento
            dos dados aqui descritos para as finalidades indicadas.
          </p>

          <h2>2. Finalidades do Tratamento</h2>
          <p>Utilizamos seus dados pessoais para as seguintes finalidades:</p>
          <ul>
            <li><strong>Execução do serviço:</strong> realizar a consulta veicular e enviar o resultado ao seu e-mail;</li>
            <li><strong>Registro de operações:</strong> manter log das consultas para controle interno e prevenção de abusos;</li>
            <li><strong>Melhoria do serviço:</strong> análise agregada e anônima de uso para aprimoramento da plataforma;</li>
            <li><strong>Cumprimento de obrigação legal:</strong> atender exigências legais e regulatórias quando aplicável.</li>
          </ul>
          <p class="legal-quote">
            Conforme o <strong>art. 6º da LGPD</strong>, o tratamento observa os princípios de
            <em>finalidade</em>, <em>adequação</em>, <em>necessidade</em> e
            <em>transparência</em>, coletando apenas os dados estritamente necessários para a
            prestação do serviço.
          </p>

          <h2>3. Bases Legais para o Tratamento</h2>
          <p>O tratamento dos seus dados se fundamenta nas seguintes bases legais da LGPD:</p>
          <ul>
            <li>
              <strong>Consentimento (art. 7º, I)</strong> — ao preencher e enviar o formulário,
              você consente com o tratamento dos dados para a finalidade específica de consulta
              veicular;
            </li>
            <li>
              <strong>Legítimo interesse (art. 7º, IX)</strong> — para manutenção de registros
              de segurança e prevenção de fraudes;
            </li>
            <li>
              <strong>Cumprimento de obrigação legal (art. 7º, II)</strong> — quando necessário
              para atender exigências legais.
            </li>
          </ul>

          <h2>4. Dados Veiculares</h2>
          <p>
            As informações sobre veículos disponibilizadas pelo Placa Completa são obtidas de
            fontes públicas e licenciadas. Operamos em observância às diretrizes de privacidade
            e uso de dados estabelecidas pela <strong>SERPRO</strong> e pela
            <strong>Secretaria Nacional de Trânsito (SENATRAN)</strong>.
          </p>
          <p>
            Os dados consultados referem-se ao <strong>veículo</strong> (e não ao seu
            proprietário) e podem incluir: dados cadastrais, restrições e gravames,
            situação de roubo/furto, débitos e multas, recall e restrições judiciais.
            O tratamento observa o princípio da necessidade — coletamos apenas os dados
            indispensáveis à finalidade da consulta.
          </p>
          <p>
            Como o usuário que realiza a consulta <strong>não é necessariamente o proprietário
            do veículo consultado</strong>, a base legal aplicável ao acesso a esses dados é o
            <strong>legítimo interesse (art. 7º, IX da LGPD)</strong>, para fins de
            transparência veicular e proteção patrimonial do consulente, e a
            <strong>prevenção à fraude (art. 7º, VII da LGPD)</strong>, para dados de
            restrições e ocorrências.
          </p>
          <p>
            Em caso de incidente de segurança envolvendo dados veiculares, o Placa Completa
            seguirá os procedimentos previstos na LGPD, incluindo notificação à Autoridade
            Nacional de Proteção de Dados (ANPD) quando aplicável.
          </p>
          <p class="legal-quote">
            O uso dos dados veiculares obedece estritamente às finalidades lícitas descritas
            nesta Política. É vedado o uso para marketing, scoring, prospecção comercial ou
            qualquer finalidade diversa das aqui previstas.
          </p>

          <h2>5. Compartilhamento de Dados</h2>
          <p>Seus dados podem ser compartilhados com:</p>
          <ul>
            <li>
              <strong>Provedor de e-mail transacional (Resend)</strong> — para envio do e-mail
              com o resultado da consulta. O Resend processa apenas o endereço de e-mail e o
              conteúdo da mensagem;
            </li>
            <li>
              <strong>Provedor de banco de dados (Supabase)</strong> — para armazenamento
              seguro dos registros de consulta;
            </li>
            <li>
              <strong>Google Analytics</strong> — para análise agregada de tráfego e uso
              (dados anonimizados).
            </li>
          </ul>
          <p>
            Não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros para
            fins de marketing.
          </p>
          <p class="legal-quote">
            Conforme o <strong>art. 7º, §5º da LGPD</strong>: "O controlador que obteve o
            consentimento [...] que necessitar comunicar ou compartilhar dados pessoais com
            outros controladores deverá obter consentimento específico do titular para esse
            fim." — O compartilhamento aqui descrito é estritamente necessário para a execução
            do serviço solicitado por você.
          </p>

          <h2>6. Armazenamento e Segurança</h2>
          <p>
            Seus dados são armazenados em servidores seguros fornecidos pelo Supabase, com
            criptografia em trânsito (TLS/SSL) e em repouso. Adotamos medidas técnicas e
            organizacionais para proteger seus dados contra acesso não autorizado, destruição,
            perda ou alteração.
          </p>
          <p class="legal-quote">
            Conforme o <strong>art. 46 da LGPD</strong>: "Os agentes de tratamento devem adotar
            medidas de segurança, técnicas e administrativas aptas a proteger os dados pessoais
            de acessos não autorizados e de situações acidentais ou ilícitas de destruição,
            perda, alteração, comunicação ou qualquer forma de tratamento inadequado ou ilícito."
          </p>

          <h2>7. Retenção dos Dados</h2>
          <p>
            Os registros de consulta são mantidos pelo período necessário ao cumprimento das
            finalidades descritas nesta Política, ou conforme exigido por obrigação legal.
            Após esse período, os dados são eliminados ou anonimizados.
          </p>
          <p class="legal-quote">
            Conforme o <strong>art. 15 da LGPD</strong>, o término do tratamento ocorrerá quando:
            a finalidade for alcançada; os dados deixarem de ser necessários; houver revogação
            do consentimento; ou por determinação da autoridade nacional.
          </p>

          <h2>8. Direitos do Titular (art. 18 da LGPD)</h2>
          <p>
            Você, como titular dos dados pessoais, tem os seguintes direitos garantidos pela
            LGPD, que podem ser exercidos a qualquer momento:
          </p>
          <ul>
            <li><strong>I</strong> — Confirmação da existência de tratamento;</li>
            <li><strong>II</strong> — Acesso aos seus dados;</li>
            <li><strong>III</strong> — Correção de dados incompletos, inexatos ou desatualizados;</li>
            <li><strong>IV</strong> — Anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos;</li>
            <li><strong>V</strong> — Portabilidade dos dados;</li>
            <li><strong>VI</strong> — Eliminação dos dados tratados com consentimento;</li>
            <li><strong>VII</strong> — Informação sobre compartilhamento de dados;</li>
            <li><strong>VIII</strong> — Informação sobre a possibilidade de não consentir e as consequências;</li>
            <li><strong>IX</strong> — Revogação do consentimento.</li>
          </ul>
          <p class="legal-quote">
            Conforme o <strong>art. 18 da LGPD</strong>: "O titular dos dados pessoais tem
            direito a obter do controlador, em relação aos dados do titular por ele tratados,
            a qualquer momento e mediante requisição [...]"
          </p>
          <p>
            Para exercer qualquer desses direitos, entre em contato conosco pelo e-mail
            <strong>contato@placacompleta.com.br</strong>. Responderemos em até 15 dias úteis,
            conforme previsto no art. 18, §3º da LGPD.
          </p>

          <h2>9. Cookies e Tecnologias de Rastreamento</h2>
          <p>
            Utilizamos o <strong>Google Analytics</strong> para análise de tráfego. O Google
            Analytics pode utilizar cookies para coletar informações de forma agregada e
            anônima sobre o uso do site. Você pode desativar cookies nas configurações do
            seu navegador.
          </p>

          <h2>10. Transferência Internacional de Dados</h2>
          <p>
            Alguns dos nossos prestadores de serviços (Supabase, Resend, Google) podem
            armazenar dados em servidores localizados fora do Brasil. Nesses casos, garantimos
            que a transferência atende ao disposto no art. 33 da LGPD, incluindo a adoção de
            cláusulas contratuais que assegurem nível adequado de proteção.
          </p>

          <h2>11. Menores de Idade</h2>
          <p>
            O Serviço não é direcionado a menores de 18 anos. Não coletamos intencionalmente
            dados de menores. Conforme o <strong>art. 14 da LGPD</strong>, o tratamento de dados
            pessoais de crianças e adolescentes deve ser realizado com consentimento específico
            de pelo menos um dos pais ou responsável legal.
          </p>

          <h2>12. Alterações nesta Política</h2>
          <p>
            Esta Política pode ser atualizada periodicamente. Alterações entram em vigor
            imediatamente após a publicação nesta página. Recomendamos a consulta periódica.
          </p>

          <h2>13. Contato e Encarregado (DPO)</h2>
          <p>
            Para questões relacionadas a esta Política ou ao tratamento dos seus dados pessoais,
            entre em contato:
          </p>
          <ul>
            <li><strong>E-mail:</strong> contato@placacompleta.com.br</li>
          </ul>
          <p class="legal-quote">
            Conforme o <strong>art. 41 da LGPD</strong>: "O controlador deverá indicar
            encarregado pelo tratamento de dados pessoais. [...] A identidade e as informações
            de contato do encarregado deverão ser divulgadas publicamente, de forma clara e
            objetiva, preferencialmente no sítio eletrônico do controlador."
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
