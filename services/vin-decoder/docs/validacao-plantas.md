# Fabrica pelo VIN: validacao contra a base de leiloes

Base: leiloes-poc-db, tabela leilao_index, 773.888 chassis unicos de 17
caracteres. Metodo: para cada (WMI, posicao 11), levantar os modelos e os anos
que aparecem na base e comparar com a planta candidata. Confirma quando a
amostra tem pelo menos 30 veiculos e menos de 2% contradizem a hipotese
(modelo que aquela fabrica nunca produziu).

## Confirmados (publicar cidade)

| WMI | pos11 | Planta | Amostra | Contradicoes |
|---|---|---|---|---|
| 9BW | T | VW Taubate (SP) | 38.693 | 0,1% |
| 9BW | P | VW Anchieta, Sao Bernardo do Campo (SP) | 30.696 | 0,3% |
| 9BW | 4 | VW Sao Jose dos Pinhais (PR) | 4.454 | 0% |
| 9BD | todos | Fiat Betim (MG) | 70.875 | 0% |
| 988 | K | Stellantis Goiana (PE) | 468 | 0% |
| 9BG | G | GM Gravatai (RS) | 11.622 | 0% |
| 9BF | 8 | Ford Camacari (BA) | 6.547 | 0,03% |
| 9BF | B, D, E, F, G, H, P | Ford Sao Bernardo do Campo (SP), so ate 2001 | 13.000+ | ver ressalva |
| 93H | Z | Honda Sumare (SP) | 2.223 | 0% |
| 93H | K | Honda Itirapina (SP) | 36 | 0% |
| 9C2 | R | Honda Manaus (AM) | 299.056 | 0% |
| 9C6 | 0 | Yamaha Manaus (AM) | 57.484 | 0% |
| 93Y | J | Renault Sao Jose dos Pinhais (PR) | 7.772 | 0% |
| 94D | J | Nissan Sao Jose dos Pinhais (PR) | 230 | 0% |
| 94D | B | Nissan Resende (RJ) | 220 | 0% |
| 9BH | P | Hyundai Piracicaba (SP) | 796 | 0,1% |
| 93X | C | Mitsubishi/HPE Catalao (GO) | 514 | 0% |
| 935 | B | Citroen Porto Real (RJ) | 1.978 | 0% |
| 936 | B | Peugeot Porto Real (RJ) | 4.056 | 0% |
| 93Z | 8 | Iveco Sete Lagoas (MG) | 111 | 0% |
| 9BV | E | Volvo Curitiba (PR) | 203 | 0% |
| 9BM | A | Mercedes-Benz Juiz de Fora (MG) | 523 | 0% |
| 9BM | B | Mercedes-Benz Sao Bernardo do Campo (SP) | 149 | 0% |

Ressalva do Ford Sao Bernardo: os codigos antigos (D, E, F, G, H, P) so tem
modelo daquela fabrica e param nos anos 80 e 90, sem contradicao. O codigo B
tem 5.089 Ka/Fiesta ate 2001 (Sao Bernardo) e 2.093 de 2002 em diante, quando a
producao ja era de Camacari. Por isso o B so publica cidade para veiculo ate
2001; de 2002 em diante ele sai como Ford, Brasil, sem cidade.

## Nao confirmados (publicar so montadora e pais)

- **9BG B e 9BG C (GM)**: os dois misturam modelo de Sao Caetano do Sul (Monza,
  Kadett, Chevette, Classic) com modelo de Sao Jose dos Campos (Vectra, Astra,
  S10, Blazer), em volume grande nos dois lados. Ou a posicao 11 nao e o
  digito de planta na GM, ou as duas fabricas dividiram os mesmos codigos. Nao
  da pra dizer a cidade sem chutar.
- **9BR (Toyota, codigos 8, 2, 5, 0, 4)**: a hipotese Indaiatuba/Sorocaba nao
  passa. O codigo 2, que seria Sorocaba (Etios), tem 113 Corolla; o codigo 8,
  que seria Indaiatuba, tem 31 Yaris. Amostra pequena e contraditoria.
- **9BW B (VW, Logus/Pointer/Apollo)**: modelos da era Autolatina, produzidos
  em mais de uma planta. Sem fonte que separe.
- **9BW R e 9BW D (caminhoes VW)**: Resende (RJ) e plausivel pela data, mas a
  amostra e de 208 e 32 veiculos e os modelos sao chassi de onibus e caminhao
  que a base cadastra de forma inconsistente.
- **9BS 3 (Scania)**: 304 veiculos, nome de modelo quase todo em campo livre.
- **Motos de marca unica (9CD Suzuki/JTA, 95V Dafra, 94J Sundown, 93F
  Kasinski)**: todas montam em Manaus e a base nao traz nada que contradiga,
  mas o teste aqui e fraco (a marca so tem uma fabrica, entao qualquer codigo
  passaria). Prefiro deixar sem cidade ate ter fonte documental por codigo.
- **Sem dado na base**: GWM Iracemapolis, BYD Camacari, Chery/CAOA Anapolis e
  Jacarei, Agrale, Troller, Ford Taubate (motores), VW Sao Carlos (motores),
  Hyundai CAOA Anapolis. Modelos recentes demais ou fora do circuito de leilao.

## Marcas com uma unica fabrica no Brasil (aprovado pelo Cesar em 07/set)

Aqui o argumento nao e a posicao 11, e sim que a marca so tem um lugar onde
montar no pais: a cidade e certa qualquer que seja o codigo. Entram com
confianca `marca_unica_fabrica` e fonte documental.

- 9CD (Suzuki/JTA), 95V (Dafra), 94J (Sundown), 93F (Kasinski): Manaus (AM),
  Polo Industrial de Manaus (SUFRAMA e site das marcas).
- 93Y (Renault), 935 e 936 (Stellantis Porto Real), 93Z (Iveco), 93X
  (Mitsubishi/HPE): reforco, cobrindo os codigos de posicao 11 sem amostra
  para confirmar um a um.

Hyundai fica de fora deste reforco de proposito: a CAOA monta Hyundai em
Anapolis, entao a marca nao tem fabrica unica no Brasil. Vale so o codigo
9BH P, esse sim validado contra a base.

## Para revisitar

| Codigo | Por que ficou sem cidade | O que destravaria |
|---|---|---|
| 9BG B, 9BG C | Misturam Sao Caetano do Sul e Sao Jose dos Campos em volume grande dos dois lados | Documento da GM ligando codigo de posicao 11 a planta, ou uma base com o municipio de emplacamento de origem |
| 9BR (todos) | Hipotese Indaiatuba/Sorocaba derrubada: 37% de contradicao | Amostra maior de Toyota na base, ou decode oficial da montadora |
| 9BW B | Logus, Pointer e Apollo sao da era Autolatina, produzidos em mais de uma planta | Fonte historica da Autolatina |
| 9BW R, 9BW D | Caminhoes e chassis de onibus, amostra de 208 e 32, modelo em campo livre | Mais volume de caminhao na base |
| 9BS 3 | Scania, 304 veiculos com modelo quase todo em campo livre | Normalizacao do modelo de caminhao na base |
| GWM, BYD, Chery/CAOA, Agrale, Troller | Sem dado na base: modelos recentes demais ou fora do circuito de leilao | Reavaliar quando esses veiculos comecarem a aparecer em leilao |
