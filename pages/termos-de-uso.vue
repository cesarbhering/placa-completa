<script setup lang="ts">
useHead({
  title: 'Termos de Uso - Placa Completa',
  meta: [
    { name: 'description', content: 'Termos de Uso do serviço Placa Completa - consulta veicular gratuita por placa.' },
    { name: 'robots', content: 'noindex, follow' },
  ],
})
</script>

<template>
  <div class="desktop">
    <div class="win-window win-window--wide">
      <div class="win-window__titlebar">
        <span>Termos de Uso</span>
        <div class="win-window__titlebar-buttons">
          <NuxtLink to="/" class="win-window__titlebar-btn">&times;</NuxtLink>
        </div>
      </div>
      <div class="win-window__body">
        <h1 class="legal-title">Termos de Uso</h1>
        <p class="legal-updated">Última atualização: fevereiro de 2026</p>

        <div class="legal-content">
          <h2>1. Aceitação dos Termos</h2>
          <p>
            Ao utilizar o serviço <strong>Placa Completa</strong> ("Serviço"), disponível em
            placacompleta.com.br, você concorda integralmente com estes Termos de Uso. Caso não
            concorde, não utilize o Serviço.
          </p>

          <h2>2. Descrição do Serviço</h2>
          <p>
            O Placa Completa é um serviço gratuito de consulta veicular por placa. O usuário
            informa a placa de um veículo e recebe, por e-mail, os dados públicos disponíveis
            sobre o veículo, incluindo marca, modelo, ano, cor, valor na tabela FIPE,
            município de registro e situação.
          </p>

          <h2>3. Uso Permitido</h2>
          <p>O Serviço destina-se exclusivamente para fins lícitos, tais como:</p>
          <ul>
            <li>Verificação de dados de veículos para compra e venda;</li>
            <li>Consulta de valor FIPE para referência de mercado;</li>
            <li>Conferência de informações para fins pessoais ou comerciais legítimos.</li>
          </ul>
          <p>
            É vedado o uso do Serviço para finalidades ilegais, abusivas, fraudulentas, ou que
            violem direitos de terceiros. O uso automatizado (bots, scrapers) sem autorização
            prévia é proibido.
          </p>

          <h2>4. Dados Pessoais e LGPD</h2>
          <p>
            A coleta e o tratamento dos seus dados pessoais são realizados em conformidade com a
            <strong>Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD)</strong>.
            Para detalhes sobre quais dados coletamos, como os utilizamos e seus direitos como
            titular, consulte nossa
            <NuxtLink to="/politica-de-privacidade">Política de Privacidade</NuxtLink>.
          </p>

          <h2>5. Limitação de Responsabilidade</h2>
          <p>
            As informações veiculares fornecidas pelo Serviço são obtidas de bases de dados
            públicas e de terceiros. O Placa Completa <strong>não garante</strong> a exatidão,
            completude ou atualidade dos dados retornados. O Serviço é oferecido "como está"
            (<em>as is</em>), sem garantias de qualquer natureza.
          </p>
          <p>
            O Placa Completa não se responsabiliza por decisões tomadas com base nas informações
            fornecidas, incluindo, mas não se limitando a, decisões de compra e venda de veículos.
          </p>

          <h2>6. Disponibilidade</h2>
          <p>
            Não garantimos que o Serviço estará disponível de forma ininterrupta ou livre de erros.
            Podemos suspender, modificar ou descontinuar o Serviço a qualquer momento, sem aviso
            prévio.
          </p>

          <h2>7. Propriedade Intelectual</h2>
          <p>
            Todo o conteúdo do site — incluindo marca, logotipo, layout e código — é de
            propriedade do Placa Completa e está protegido pela legislação brasileira de
            propriedade intelectual. É proibida a reprodução sem autorização.
          </p>

          <h2>8. Alterações nos Termos</h2>
          <p>
            Reservamo-nos o direito de alterar estes Termos a qualquer momento. Alterações entram
            em vigor imediatamente após a publicação nesta página. O uso continuado do Serviço
            após alterações constitui aceitação dos novos Termos.
          </p>

          <h2>9. Legislação Aplicável e Foro</h2>
          <p>
            Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o
            foro da comarca do domicílio do usuário para dirimir quaisquer litígios, conforme
            o art. 101, I, do Código de Defesa do Consumidor (Lei nº 8.078/1990).
          </p>

          <h2>10. Contato</h2>
          <p>
            Dúvidas sobre estes Termos podem ser encaminhadas para
            <strong>contato@placacompleta.com.br</strong>.
          </p>
        </div>

        <div class="text-center mt-md">
          <NuxtLink to="/" class="win-btn">Voltar</NuxtLink>
        </div>
      </div>
    </div>
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
</style>
