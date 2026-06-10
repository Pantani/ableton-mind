# Prompt cookbook

Copie estes prompts, altere os detalhes e adapte ao seu som. Bons prompts descrevem resultado musical, restricoes e a verificacao esperada. Voce nao precisa nomear toda tool, mas nomear uma recipe ajuda quando quer um ponto de partida conhecido.

## Como escrever

Use este formato:

> "Crie [resultado musical] em [tempo/key] com [tracks/devices/arranjo]. Use recipes existentes onde fizer sentido. Leia o Live set primeiro, mantenha nomes claros e verifique o estado final com snapshot/diff."

Peca verificacao sempre que o prompt alterar o set. Essa e a diferenca principal entre um assistente util dentro do Live e um gerador de texto.

## Recipe starters

Estes prompts partem de recipes JSON embutidas e depois pedem uma camada criativa.

> "Liste as drum recipes embutidas, aplique `drums/tech-house-kick`, coloque o tempo em 128 BPM, nomeie a track como `Kick - Tech House` e verifique o tamanho do clip e o nome da track."

Um starter limpo de kick four-on-the-floor para house e techno.

> "Aplique `drums/jungle-break` a 170 BPM, depois crie uma segunda variacao de clip com menos snares e mais sensacao de ghost note. Verifique os nomes e duracoes dos dois clips."

Um sketch DnB/jungle que parte da recipe conhecida e adiciona variacao.

> "Aplique `drums/lofi-kit`, depois crie uma batida dusty de 90 BPM com pequena variacao de velocity. Adicione `Vinyl Distortion` leve se o schema do device estiver disponivel, depois verifique device e clip."

Um prompt de beat lo-fi que manda o assistente consultar a knowledge base antes de mexer em parametros.

> "Aplique `bass/reese` e deixe escuro, detunado e controlado. Mantenha o bass no registro grave, adicione um clip MIDI de 4 compassos e verifique a faixa de notas antes do playback."

Base Reese para DnB, neurofunk ou sketches eletronicos escuros.

> "Aplique `bass/sub-808`, escreva um padrao trap de oito compassos em F minor, deixe espaco para o kick e verifique que as notas ficam abaixo de C3."

Starter de sub-bass com restricao explicita de registro.

> "Aplique `chords/neo-soul-progressions`, coloque em D minor, use voicings estendidos e crie um segundo clip com turnaround mais esparso."

Prompt de harmonia para sessao de composicao.

> "Aplique `chords/lofi-jazz`, deixe a track de acordes quente e levemente filtrada, depois adicione uma melodia curta em uma track MIDI separada."

Sketch para lo-fi hip-hop e beat-making.

## Sketches completos

> "Crie um starter tech-house de 128 BPM com Kick, Bass, Hats, Percussion e Chords. Use `drums/tech-house-kick`, use `bass/reese` so se fizer sentido com intensidade reduzida, e coloque `racks/sidechain-rack` no bass. Verifique ordem das tracks, tamanho dos clips e tempo."

Bom para primeiro draft de musica dance quando estrutura importa mais que sound design minucioso.

> "Crie um loop lo-fi late-night a 86 BPM: drums dusty, acordes jazz, sub bass, camada de ruido estilo vinyl e hook melodico curto. Use `drums/lofi-kit`, `chords/lofi-jazz` e `mixing/master-bus`, depois tire snapshot do set."

Usa varias recipes, mas mantem a intencao musical clara.

> "Monte uma ideia jungle de 170 BPM: breakbeat, Reese bass, um pad atmosferico e um plano de markers para 16 compassos. Mantenha a primeira versao simples e diga o que devo audition manualmente."

Util quando voce quer popular o Live rapido sem superproduzir o primeiro passo.

> "Faca uma cama ambient techno de oito compassos: kick abafado, pad evolutivo com Drift, ruido filtrado, return de delay e automacao lenta de filtro. Leia os schemas de devices antes de setar parametros."

Este prompt prioriza sound design schema-aware.

## Sound design

> "Crie uma track MIDI chamada `Drift Pad`, carregue Drift se disponivel, faca um pad poly quente e verifique os nomes exatos de parametros antes de configurar filtro, envelope e LFO."

A parte importante e pedir inspecao de parametros antes.

> "Na track de bass, adicione Roar e EQ Eight. Mantenha o sub limpo, adicione grit no medio e relate todo parametro alterado pelo nome."

Bom para sound design controlado porque deixa trilha de auditoria.

> "Crie um instrumento de vocal chop em uma track estilo Simpler. Mantenha nao-destrutivo: duplique ou crie uma nova track antes de editar, depois verifique que a original nao mudou."

Use esse formato quando o material fonte importa.

## Arranjo e automacao

> "Aplique `arrangements/tech-house-7min` como scaffold de planejamento. Crie locators ou nomes de scenes para intro, primeiro drop, break, segundo drop e outro, depois verifique os nomes das secoes."

Um prompt de planejamento antes de comprometer clips detalhados.

> "Escreva uma abertura de filtro de 16 compassos na track de chords. Use automation points em vez de mudanca estatica de parametro, depois leia o envelope de volta e resuma a curva."

Para automacao, sempre peca leitura do envelope depois.

> "Transforme este loop de quatro compassos em um sketch de performance de 32 compassos: duplique clips principais em secoes, mute elementos na intro, traga o bass depois de 8 compassos e verifique que nenhuma scene vazia sera disparada."

Bom para sair do loop para arranjo sem precisar criar uma estrutura completa de sete minutos.

## Mix e performance

> "Aplique `mixing/bass-glue` no grupo de bass, mantenha o peak conservador e verifique os devices alterados antes de tocar."

> "Aplique `mixing/vocal-chain` na track de vocal, mas primeiro tire snapshot dos devices atuais da track. Depois de aplicar, reporte a lista before/after de devices."

> "Aplique `mixing/master-bus` de forma leve apenas para monitoramento. Nao limite demais; use ceiling conservador e verifique a chain do master."

> "Aplique `live_performance/launchpad-rig`, crie nomes claros de scenes para secoes A/B/C e verifique estado de clip launch sem iniciar playback."

## Prompts para devs e QA

Estes sao para trabalhar no proprio ableton-mind ou checar uma sessao com mais precisao.

> "Leia `live://session/state`, liste todas as tracks e clips, depois chame `session_snapshot`. Nao altere o Live. Resuma nomes ausentes, clips vazios e track types inesperados."

> "Use `list_resources` e `list_prompts` para mostrar o que este servidor expoe. Depois explique qual resource ou prompt ajudaria a construir um loop house."

> "Use `list_recipes` filtrado por `mixing`, escolha a recipe mais segura para um rough master bus e explique por que antes de chamar `apply_recipe`."

> "Antes de mudar qualquer parametro de device, chame `device_get_parameters` para o device alvo e so altere parametros cujo nome esteja presente no schema."

> "Rode um loop create -> verify -> diff: tire snapshot do set, faca a menor mudanca solicitada, tire novo snapshot e explique o diff em linguagem simples."

## Prompts de reparo

> "Audite o set atual por bagunca criada por IA: nomes duplicados de tracks, clips MIDI vazios, devices nao verificados e tracks sem clips. Pergunte antes de deletar qualquer coisa."

> "Algo mudou mas nao sei o que. Compare o snapshot mais recente com um `session_snapshot` novo e resuma apenas diferencas reais."

> "A bridge parece desconectada. Verifique reachability do Live, timeout settings e ativacao do Remote Script. Nao reinstale ate relatar qual check falhou."
