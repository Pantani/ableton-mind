# Seu primeiro set no Live

Quando o servidor MCP estiver conectado e o Remote Script estiver ativo no Live, comece pequeno e verificavel. O melhor primeiro prompt pede um resultado musical e tambem pede para o assistente ler o set de volta.

## 1. Confirme a bridge

Peca no seu cliente MCP:

> "Verifique se o ableton-mind consegue acessar o Live. Leia as informacoes da sessao, liste as tracks e me diga tempo, escala e quantidade de tracks antes de mudar qualquer coisa."

O assistente deve usar `session_get_info` e `track_list`. Se nao conseguir acessar o Live, va para [Troubleshooting](./troubleshooting).

## 2. Crie um loop pequeno

Experimente:

> "Crie um loop tech-house de 128 BPM com quatro tracks: Kick, Bass, Hats e Chords. Use um loop de 4 compassos na Session View, aplique `drums/tech-house-kick`, adicione um bass rolling, deixe tudo com nomes claros e verifique as tracks e clips criados."

Voce deve ver o Live mudar enquanto o assistente cria tracks e clips. A resposta deve incluir o que foi criado e o que foi verificado.

## 3. Modele o som

Depois itere em linguagem natural:

- "Deixe o bass mais escuro e mais curto."
- "Adicione sidechain pumping do kick para o bass."
- "Abra o filtro ao longo de 16 compassos ate o drop."
- "Adicione um return de reverb e deixe o kick seco."
- "Tire um snapshot da sessao e mostre o diff desde o passo anterior."

## 4. Use recipe starters

Recipes ajudam quando voce quer um padrao conhecido primeiro e uma passada criativa depois:

> "Liste as embedded recipes e aplique `racks/sidechain-rack` na track de bass. Depois de aplicar, verifique que o rack existe e me diga quais macros eu devo performar."

## 5. Pare quando o set estiver legivel

Antes de continuar empilhando coisas, peca:

> "Audite o set por nomes, ordem de tracks, clips vazios e erros obvios de routing. Nao crie nada novo a menos que encontre um problema especifico; relate os fixes antes."

Esse habito mantem sessoes geradas por IA compreensiveis.
