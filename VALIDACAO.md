# Validação do Marai — 05/11/2026

## Verificações executadas

| Verificação | Resultado |
| --- | --- |
| Compilação React/TypeScript/Vite | Aprovada |
| Testes automatizados do backend | 89 aprovados |
| Testes automatizados do frontend | 16 aprovados |
| Migração Alembic no PostgreSQL 17 real | Aplicada; revisão `001` |
| Comparação dos modelos com as migrações | Nenhuma alteração pendente (`alembic check`) |
| Iniciador Windows `start.ps1 -SetupOnly` | Executado com sucesso: banco, dependências, compilação e migração |
| Integração real inicial, sem respostas simuladas | 32 verificações da versão inicial; detalhes em `.runtime/live-results.json` |
| Proteção das chaves | Nenhuma das duas chaves privadas encontrada na fonte ou compilação do frontend |
| Arquivo `.env` original | Preservado, sem alteração |

## Integrações reais

Os 32 casos desta seção registram a validação inicial. A política estrita posterior e seus resultados estão na seção seguinte.

Foram utilizadas as credenciais já existentes no `.env`, sem incluí-las no código ou nos resultados. O teste real criou uma conta local de controle, salvou um personagem e percorreu:

- Abertura gerada por IA, regeneração e substituição sem duplicar a mensagem.
- Continuidade com uma mensagem do usuário e resposta correspondente, sintetizada em áudio real.
- Encerramento de sessão, novo login e recuperação fiel das mensagens, aparência, cenário e versão.
- Recusa no idioma escolhido para uma investida romântica com tentativa de ignorar as regras.
- Síntese de voz masculina e feminina nos **sete idiomas**, com tempos das palavras: 14 gerações reais.
- Transcrição real pela Groq de áudio sintetizado em **inglês, espanhol, francês, alemão, italiano, português e japonês**. Os resultados mantiveram o idioma original.
- Cinco verificações semânticas: investidas em inglês, português e japonês foram bloqueadas; um relato de assédio pedindo ajuda e uma conversa sobre jogos foram permitidos.
- Inferência diretamente na Groq com a chave de reserva real.

A troca por erro de cota **429** e o intervalo antes de tentar o Gemini novamente foram verificados por testes automatizados de HTTP controlado; não foi necessário esgotar deliberadamente o saldo do usuário. Chamadas reais também obtiveram respostas de ambos os provedores.

## Atualização: política estrita e devolução da vez ao usuário

Foram acrescentadas proibições explícitas de palavrões/insultos, conteúdo sexual, extração/explicação do sistema interno do agente e prompt injection. A política é compartilhada entre geração e moderação; a classificação usa temperatura zero em ambos os provedores. Verificações locais independentes impedem que uma decisão permissiva do modelo libere correspondências óbvias, inclusive grafias disfarçadas e formas comuns de codificação.

Os testes cobrem as sete respostas padrão, ausência de geração para entradas bloqueadas, bloqueio também na saída/perfis/áudio histórico, recarga mantendo a espera pelo usuário, impossibilidade de contornar por regeneração ou mudança de assunto, ocultação da mensagem proibida na transcrição e exclusão dessas tentativas do contexto usado pela IA. Uma pergunta reformulada e permitida retoma a conversa. O frontend mantém microfone e texto disponíveis e desativa as duas ações de geração enquanto aguarda essa reformulação.

A verificação com provedores reais confirmou 14 casos de classificação: tentativas indiretas de extração, mudança de papel, pretexto de pesquisa, insulto, pedido sexual implícito, pedidos internos em alemão/francês/espanhol/italiano/japonês e tentativa em múltiplos turnos; perguntas permitidas sobre música e computação continuaram aceitas. Durante o teste adicional de conversa normal houve uma resposta 429 de cota; a aplicação recusou o processamento com erro 503, sem fabricar uma resposta. Após o intervalo, uma nova tentativa gerou uma resposta normal real e passou pela moderação: **15 de 15 verificações reais aprovadas**. Resultados locais: `.runtime/guardrail-results.json`.

A política anterior permitia alguns relatos e redirecionava a um assunto neutro. Esse comportamento foi substituído: agora o conteúdo proibido recebe **somente a mensagem padrão**, sem novo assunto ou pergunta, e a vez retorna ao usuário. A origem Gemini/Groq não altera essas regras. Não foi necessário alterar o banco de dados nem o `.env`.

## Cobertura automatizada

Os testes cobrem autenticação, sessão e logout; tentativas de acesso entre contas; cópias imutáveis de aparência e identidade; restauração do histórico; regeneração inicial e posterior; repetição idempotente de solicitações; conflitos de versão; mudança de assunto; renomeação e exclusão; limites de entrada e proteção de origem; rejeição de persona e saída impróprias; recusa quando a segurança não pode ser verificada; resumos de contextos longos com preservação das mensagens originais; falhas dos dois provedores; e duas vozes fixas por idioma.

No frontend, há testes para sincronização por tempos e por duração, japonês sem espaços, metadados de áudio ainda indisponíveis, início/fim da gravação com dois cliques, recusa de permissão, descarte de gravação ao sair, repetição do mesmo áudio após falha de transcrição e descarte de eventos do reprodutor anterior ao iniciar outra interação.

Os substitutos de IA, microfone e banco usados nos testes isolados ficam exclusivamente nos testes. A aplicação não utiliza esses substitutos.

## Revisão no navegador

Revisão de cadastro, início, editor em camadas, criação automática real, limite de três traços, seleção de cenário e conversa real por texto e áudio em formato de computador. A revisão detectou e corrigiu a seleção de traços gerados fora do catálogo e um evento de erro de um áudio descartado que podia interferir no estado de uma nova interação.

Também foram verificados no navegador a restauração após recarregar, a pausa/retomada do áudio, a regeneração durante a reprodução, os nomes acessíveis dos controles e a versão em tela de 390 × 844, com abertura e fechamento do histórico por toque. As prévias reais estão em `artifacts/marai-desktop.jpg` e `artifacts/marai-mobile.jpg`. As contas usadas nessa revisão são descartáveis e não são contas do usuário.

## Atualização: criação por idioma e reprodução sincronizada

O fluxo agora começa por idioma, nível e cenário, seguido de aparência e personalidade/identidade. Os testes verificam avanço/retorno com rolagem ao topo, opções e placeholders em francês, preservação dos identificadores dos interesses e traços, e história de vida em japonês sem tradução. Há cobertura da geração automática nos sete idiomas e da preservação da biografia durante a complementação das preferências. Uma chamada real também gerou profissão, origem, biografia e preferências em francês.

Os controles de pausar, continuar e reiniciar usam o mesmo reprodutor e sincronizam o texto com o tempo do áudio. O teste automatizado verifica pausa em 1,4 segundo, retomada nesse mesmo ponto e reinício em zero, sem solicitar outra síntese. No navegador, um áudio real foi pausado em 59%: posição e texto permaneceram estáveis; o reinício voltou a zero.

A revisão em computador e em celular de 390 × 844 confirmou respostas completas em um único balão, com fonte adaptativa (20 px e 17 px no exemplo), sem rolagem interna ou transbordamento horizontal. Um texto de controle de 1.316 caracteres confirmou que respostas extensas expandem a página, mantendo a fonte legível e o conteúdo inteiro. O conteúdo fixo desse teste serviu apenas à revisão visual; a reprodução foi sintetizada pelo serviço real. Prévias: `artifacts/marai-editor-fr.jpg`, `artifacts/marai-controles-desktop.jpg` e `artifacts/marai-controles-mobile.jpg`.

## Atualização: inicialização do Docker no Windows (09/11/2026)

A consulta de disponibilidade do Docker captura stdout/stderr fora do tratamento de erros nativos do PowerShell e limita cada consulta a dez segundos. Foram verificados no Windows PowerShell 5.1 três processos de controle: sucesso com diagnóstico em stderr, indisponibilidade com stderr e processo sem resposta (interrompido em dez segundos). O tratamento de erros do restante do iniciador continua estrito.

A execução real de `start.ps1 -SetupOnly` abriu o Docker Desktop, iniciou o PostgreSQL, verificou as dependências, compilou a interface e aplicou/verificou as migrações, terminando com sucesso. O projeto Compose agora tem a identidade fixa `bilingua`, reutilizando o volume original `bilingua_marai_data` após a pasta ter sido renomeada para `marai`. O `.env` foi preservado.

## Limites da verificação

- **Microfone físico:** não foi gravada a voz nem o ambiente do usuário. O comportamento de dois cliques e falhas foi testado de forma automatizada. A transcrição real foi validada com áudio sintetizado; a permissão e a captura física dependem do navegador/dispositivo no uso real.
- **Google OAuth:** implementação preparada e erro de configuração verificado. Não houve login Google externo, pois `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` não foram fornecidos. O login por e-mail/senha foi testado de ponta a ponta.
- **Gemini TTS opcional:** implementação preparada, mas a validação de áudio usou o padrão Edge. O modo Gemini exige cota/permissão específica do modelo TTS e pode recorrer ao Edge.
- **Segurança semântica:** os casos descritos passaram; um classificador de linguagem não constitui garantia absoluta de bloqueio de toda formulação possível.
- **Serviços externos:** a disponibilidade futura depende das cotas, permissões e conectividade dos provedores. O aplicativo mostra erros e permite repetir; não inventa falas para esconder falhas.
- **Publicação:** não realizada. A instalação e as verificações são locais, em um servidor de um processo.

As duas advertências de descontinuação de `httpx` emitidas por dependências não impediram os testes. As versões efetivamente instaladas estão fixadas em `backend/requirements.lock` e `frontend/pnpm-lock.yaml`.

## Atualização: cabelos, personalização visual e cenários estáticos (10/11/2026)

Os modelos de cabelo foram redesenhados e ampliados para 16 opções. As seis opções anteriores mantêm seus identificadores, preservando personagens já salvos. O editor organiza rosto, cabelo, roupas, acessórios e voz em cinco abas, com miniaturas, filtros de comprimento, cores e prévia. Os chapéus recortam as camadas de cabelo, e as miniaturas usam identificadores SVG exclusivos para não interferirem umas nas outras.

As imagens fornecidas foram copiadas sem alterações: Paris, jardim japonês e ilha de doces substituem as respectivas ilustrações; Camp Nou é um cenário adicional. Os outros três cenários foram preservados. Os sete cenários não possuem animações, e a configuração manual de animações foi removida. A preferência de acessibilidade do sistema operacional continua sendo respeitada pelos demais elementos da interface.

| Verificação desta atualização | Resultado |
| --- | --- |
| Testes completos do backend | 118 aprovados |
| Testes completos do frontend | 33 aprovados |
| TypeScript e compilação de produção | Aprovados |
| Revisão no navegador | 1440 × 1000, 1024 × 900, 390 × 844 e 320 × 760 |
| Carregamento e ausência de animação dos cenários | Sete aprovados, sem depender da preferência de redução de movimento |
| Preservação das quatro imagens de referência | Arquivos idênticos aos originais, conferidos por SHA-256 |

Os testes do backend verificam os 16 cabelos com os três formatos de rosto e os três estados de chapéu, a persistência das novas opções, a preservação das cópias dos personagens nas conversas e a rejeição de valores desconhecidos. A revisão no navegador percorreu a seleção de idioma/cenário, as cinco abas e a prévia; em computador e celular, também percorreu o salvamento e a criação de conversa com todas as escolhas preservadas. Não houve transbordamento horizontal nas quatro larguras.

Nesta atualização, a revisão do navegador usou respostas de API controladas, e os testes de persistência usaram o banco de testes. Não foram criadas contas, conversas ou alterações no banco Aiven do usuário, nem feitas chamadas pagas de IA. As capturas locais estão em `.runtime/editor-new-desktop.png`, `.runtime/editor-new-tablet.png`, `.runtime/editor-new-mobile.png`, `.runtime/editor-new-small.png`, `.runtime/hairstyles-new.png` e `.runtime/scenes-static.png`.

## Atualização: gênero e voz vinculados (10/11/2026)

A primeira aba da aparência agora é **Gênero e voz**, seguida por **Rosto**, **Cabelo**, **Roupas** e **Acessórios**. Há somente masculino e feminino. A escolha define simultaneamente a voz e a apresentação visual; a aba Rosto não possui um seletor independente de apresentação. Cabelos, roupas, cores e acessórios são preservados ao trocar o gênero.

A API também mantém esse vínculo ao salvar. Personagens antigos com apresentação neutra ou divergente são apresentados de acordo com a voz que já tinham salva, sem exigir migração de banco. As conversas anteriores continuam usando sua própria voz e cópia do personagem.

Foram aprovados **125 testes do backend e 33 do frontend**, além da verificação TypeScript e da compilação de produção. Os testes incluem dados antigos, seleção nos dois sentidos, persistência após reabertura e preservação das conversas anteriores. A revisão no navegador passou nas larguras de 1440, 1024, 390 e 320 px, verificando ordem das abas, duas opções, atualização imediata da prévia, ausência de transbordamento horizontal e salvamento. A revisão usou API controlada; a persistência foi verificada no banco de testes. Prévias: `.runtime/editor-gender-desktop.png`, `.runtime/editor-gender-tablet.png`, `.runtime/editor-gender-mobile.png` e `.runtime/editor-gender-small.png`.

## Atualização: Disney e quatro novos cenários (10/11/2026)

O cenário Parque dos sonhos foi substituído pela imagem da Disney, mantendo o identificador `theme` para continuar funcionando nas conversas existentes. Foram adicionados Oktoberfest (`oktoberfest`), Londres (`london`), Rio de Janeiro (`rio`) e Veneza (`venice`). São 11 cenários, todos estáticos. As cinco novas imagens foram copiadas para `frontend/public/scenes` sem alterações, com igualdade de SHA-256 em relação aos originais.

Passaram os **16 testes de personalização e cenários do backend**, os **33 testes completos do frontend**, a verificação TypeScript e a compilação de produção. Os testes de API verificaram criação, listagem e reabertura dos novos cenários no banco de testes. A revisão no navegador confirmou o carregamento dos 11 cenários, ausência de animações, seleção e prévia das cinco imagens em computador e celular, e criação de conversa com Disney e Veneza, sem transbordamento horizontal. O navegador utilizou API controlada; nenhuma conversa foi criada no Aiven. Capturas: `.runtime/scenes-eleven.png`, `.runtime/new-scene-conversation-desktop.png` e `.runtime/new-scene-conversation-mobile.png`.
