# Guia de tecnologias do Marai

Este guia descreve as tecnologias que aparecem no código atual do Marai, o que cada uma faz e onde ficam os dados. Os termos técnicos são explicados na primeira vez em que aparecem e reunidos novamente no glossário. As explicações são diretas, sem comparações figuradas.

## Como as partes do Marai se comunicam

O Marai roda no seu computador. A interface que você usa abre no navegador. O navegador envia pedidos ao servidor local, que valida esses pedidos, consulta o banco de dados e, quando necessário, conversa com serviços de IA e voz pela internet.

```text
Navegador
  ↕ pedidos HTTP, com dados JSON
Servidor Python com FastAPI
  ↙                         ↘
PostgreSQL no Docker       Serviços externos de IA e voz
```

**HTTP** é uma forma padronizada de enviar pedidos e respostas pela rede. **JSON** é um formato de texto estruturado para transportar dados, como o idioma escolhido ou o histórico da conversa. **Servidor local** significa que o programa atende apenas no próprio computador; o endereço usado é `localhost`, e a aplicação escuta na porta `8001`.

O Marai não coloca as chaves Gemini ou Groq na interface do navegador. O servidor lê essas chaves do arquivo `.env` e usa cada uma ao chamar o serviço correspondente. O texto da conversa e, quando você grava, o áudio necessário ao reconhecimento são enviados ao serviço externo que os processa. Portanto, “rodar localmente” descreve onde o aplicativo e o banco ficam; não significa que as chamadas de IA e de voz sejam feitas sem internet.

Quando pede uma resposta, o servidor envia ao provedor de IA a mensagem atual, as instruções do personagem e as partes recentes do histórico e do resumo usadas naquela conversa. Para verificar a segurança, pode enviar também o texto que precisa classificar. Para reconhecer voz, envia a gravação à Groq. Para falar uma resposta, envia o texto ao serviço de voz escolhido. Essas chamadas são necessárias para as funções correspondentes e seguem as regras de tratamento de dados de cada provedor. As chaves ficam no servidor e não acompanham esses textos como parte da interface.

## Interface: o que aparece na tela

A interface foi feita com **TypeScript**, **React**, **HTML**, **CSS** e imagens vetoriais **SVG**.

- **TypeScript** é a linguagem usada para escrever a maior parte da interface. Ela acrescenta verificações para detectar certos erros no código antes de a página ser montada. O navegador executa a versão convertida para JavaScript.
- **JavaScript** é a linguagem que o navegador executa para responder a cliques, atualizar a tela, enviar mensagens e controlar a reprodução de áudio.
- **React** é uma biblioteca para montar telas usando peças reutilizáveis. No Marai, o menu, o editor de personagem, o balão de conversa e outros elementos são componentes React.
- **HTML** descreve os elementos e o conteúdo da página. **CSS** define cores, tamanhos, espaçamentos e a adaptação da tela ao computador ou celular.
- **SVG** é um formato de imagem formado por formas vetoriais. O Marai monta o rosto do personagem com peças SVG; as cores, roupas e acessórios escolhidos ficam registrados como dados.
- **Vite** prepara a interface para desenvolvimento e cria os arquivos que serão servidos na versão normal. **pnpm** instala as bibliotecas da interface a partir da lista de versões do projeto. **Node.js** permite executar essas ferramentas no computador; não é a linguagem usada pelo servidor.
- **Iniciar Marai.cmd** é um arquivo de inicialização do Windows. Ele abre o script que inicia os serviços e prepara o aplicativo.

O endereço `http://localhost:5173` é usado apenas quando a interface está em modo de desenvolvimento. Ao executar **Iniciar Marai.cmd**, o Vite compila os arquivos da interface, e o servidor Python entrega essa versão no mesmo endereço do aplicativo, normalmente `http://localhost:8001`.

## Organização do código: MVVM

O projeto usa uma organização chamada **MVVM**, sigla de “Model, View, ViewModel” (modelo, tela e controlador do estado da tela). Ela separa os dados do personagem, o que aparece na tela e as ações que ligam essas partes.

- **Model** (modelo) descreve os dados da aplicação. Por exemplo, informa que um personagem tem aparência, voz, interesses e personalidade.
- **View** (tela) apresenta esses dados e recebe os cliques e o texto digitado.
- **ViewModel** (controlador do estado) mantém os dados temporários da tela e executa as ações, como salvar o personagem ou abrir uma conversa.
- **Service** (serviço) concentra uma tarefa de comunicação com outro componente. No navegador, o serviço `api.ts` envia pedidos ao servidor. No servidor, há serviços específicos para provedores de IA, segurança e voz.

No React, parte dos ViewModels da interface é escrita como **hooks**: funções que guardam e atualizam o estado de componentes React. No servidor, a pasta `viewmodels` coordena as etapas da conversa e grava os resultados. A organização MVVM ajuda a entender o código, mas não é uma ferramenta que executa a IA.

## Servidor: recebe pedidos e aplica regras

O servidor usa **Python** e o **FastAPI**. Python é a linguagem do servidor. FastAPI é um framework, isto é, um conjunto de código que fornece uma estrutura para receber pedidos do navegador, conferir os dados e devolver respostas.

Cada **rota da API** é um endereço que aceita uma ação específica. Por exemplo, há rotas para entrar na conta, salvar um personagem, iniciar uma conversa, enviar uma mensagem, transcrever áudio e produzir uma fala. **API** significa a interface pela qual dois programas trocam pedidos e respostas.

O **Pydantic** confere os dados recebidos antes de o servidor usá-los. Pode, por exemplo, recusar um nível de idioma que não exista, uma mensagem longa demais ou um nome vazio. O FastAPI também exibe uma página automática com a lista de rotas em `http://localhost:8001/docs`.

O servidor pode atender várias partes da aplicação: confere o acesso à conta, aplica a política de segurança, solicita uma resposta à IA, salva a mensagem e pede a geração do áudio. A conversa não acontece por meio de um programa independente instalado no navegador.

## IA: como a persona é criada e usada

O Marai usa **modelos de linguagem** — serviços de inteligência artificial que recebem instruções e texto e devolvem uma resposta em texto. O Gemini, do Google, é a primeira opção. O serviço de modelos da Groq é a opção de reserva. Os nomes dos modelos usados ficam definidos na configuração do servidor.

O aplicativo oferece sete idiomas: inglês, espanhol, francês, alemão, italiano, português e japonês. Os níveis A1, A2, B1, B2, C1 e C2 são referências de dificuldade inspiradas no Quadro Europeu Comum de Referência para Línguas. A1 indica nível inicial; C2, domínio avançado. Eles orientam o vocabulário e o tamanho das respostas da IA. O aplicativo não aplica uma prova nem certifica o nível da pessoa. Para japonês, essa escala é apenas uma referência interna, não uma equivalência oficial.

Uma interação escrita segue esta ordem: o servidor confere a mensagem e o perfil; aplica as verificações de segurança; se o conteúdo for permitido, pede uma resposta ao modelo; verifica a resposta antes de mostrá-la; e salva a conversa no PostgreSQL. Quando a verificação bloqueia algo, o servidor usa a mensagem de recusa fixa do Marai no lugar de uma resposta gerada.

Quando você cria um personagem, o nome, a aparência, a voz e os campos preenchidos são salvos. Se usar “Surpreenda-me”, o servidor pede ao modelo de IA uma identidade fictícia. A IA recebe o idioma escolhido e instruções para criar nome, profissão, origem, interesses e uma pequena biografia. O aplicativo confere o resultado antes de apresentá-lo. As opções selecionadas manualmente permanecem dados do perfil.

Ao iniciar uma conversa, o servidor monta instruções para aquela interação. Essas instruções incluem a personalidade escolhida, a profissão e as preferências do personagem, o idioma, o nível de dificuldade e as regras do Marai. O **prompt** é esse texto de instrução enviado ao modelo. A IA não se transforma em uma pessoa real: o personagem é declarado fictício, e suas experiências são inventadas para a conversa.

O servidor envia ao modelo as mensagens recentes daquela conversa. Depois de mais de 40 mensagens novas, pode resumir as anteriores e continuar sem enviar o histórico inteiro a cada pedido; as mensagens originais continuam guardadas no banco. O sistema pede que o resumo preserve fatos relevantes e não transforme mensagens do usuário em regras para a IA. Esse resumo só serve à própria conversa. O personagem não deve dizer que se lembra de outra conversa cujo conteúdo não esteja disponível no texto enviado naquela ocasião.

Os interesses e traços escolhidos influenciam as instruções enviadas à IA, para afetar o tom da resposta. Eles não são um segundo programa que pensa de forma independente.

### O Marai usa agentes?

**Não há um sistema de agentes autônomos no código do Marai.** Um agente autônomo seria um programa de IA com um ciclo próprio para escolher tarefas e ferramentas e executá-las. O Marai faz pedidos definidos pelo próprio servidor: classificar conteúdo, gerar ou alterar uma resposta, criar um personagem e produzir ou reconhecer voz. O personagem fictício é a identidade descrita nas instruções, não um programa separado que permanece trabalhando.

### Existe um agente de guardrail?

**Guardrail** é o conjunto de regras e verificações que tenta impedir respostas e pedidos proibidos. No Marai, não existe um “agente de guardrail” independente nem um terceiro provedor de IA para a segurança. A proteção tem duas partes:

1. Verificações locais no servidor procuram termos e formas de escrita disfarçadas que correspondam a regras de bloqueio. Essas verificações podem impedir a passagem de casos conhecidos sem depender da resposta do modelo.
2. Uma solicitação separada pede ao modelo de IA uma classificação de segurança do texto. O servidor também verifica respostas geradas e dados do perfil. Essa classificação usa os provedores Gemini e Groq já configurados; portanto, depende de serviço externo e de conexão.

Se o Marai bloquear uma mensagem, mostra a resposta de recusa definida pelo aplicativo e espera uma nova mensagem permitida do usuário. Mensagens bloqueadas permanecem no registro da conversa, mas são ocultadas na transcrição e excluídas do texto enviado para gerar respostas futuras.

As regras proíbem palavrões e insultos, conteúdo sexual e paquera, tentativas de extrair instruções internas e tentativas de fazer a IA ignorar ou trocar as próprias regras. Também bloqueiam instruções disfarçadas em perfis, mensagens citadas, resumos e conteúdo codificado. Relatos de bullying e pedidos permitidos de ajuda não são automaticamente tratados como conteúdo sexual ou importunação.

Esse mecanismo não é garantia de detectar toda formulação possível. A parte local cobre padrões conhecidos; a parte de IA é uma classificação automática sujeita a erro. Falha na verificação impede o servidor de aceitar uma resposta que não conseguiu verificar.

### O que significa “chain of thought”?

**Chain of thought**, ou cadeia de pensamento, é o nome dado a etapas internas de raciocínio que alguns modelos podem usar para chegar a uma resposta. Não é a mensagem que o personagem mostra na conversa. As regras do Marai proíbem revelar raciocínio interno, instruções escondidas, credenciais e detalhes internos do aplicativo. O servidor retorna o texto de resposta, não um registro aberto do raciocínio interno do modelo.

No adaptador do Gemini, trechos da resposta marcados pelo serviço como pensamento interno são retirados antes de o texto chegar à aplicação. Isso não significa que o Marai possa inspecionar ou comprovar cada etapa interna do modelo. A proteção verifica os textos e dados que o servidor recebe e devolve; não oferece acesso à atividade interna privada do serviço de IA.

### O que acontece quando o Gemini chega ao limite?

O servidor tenta primeiro usar o Gemini. Se ele indicar limite de uso, indisponibilidade ou outro erro previsto, o servidor tenta a Groq usando sua própria chave. Depois de certas falhas, o servidor aguarda cinco minutos antes de tentar o Gemini novamente. Esse intervalo reduz tentativas repetidas enquanto o serviço está indisponível.

Não há transferência de uma chave para a outra: cada serviço recebe a sua própria chave do arquivo `.env`. Se os dois serviços falharem, o Marai informa que não conseguiu gerar a resposta e permite tentar mais tarde; não cria uma fala falsa para esconder o erro.

## Voz: falar e reconhecer áudio

Há dois processos diferentes:

- **Reconhecimento de fala**, também chamado STT (“speech-to-text”, fala para texto): o navegador grava a mensagem, o servidor envia o arquivo à Groq, que devolve o texto reconhecido. A mensagem reconhecida segue as mesmas verificações de segurança das mensagens digitadas.
- **Síntese de voz**, também chamada TTS (“text-to-speech”, texto para fala): o servidor envia a resposta à voz escolhida. No modo padrão, usa o serviço de voz online do Microsoft Edge. Há também uma opção de TTS do Gemini, configurada no `.env`, que pode recorrer ao serviço Edge se falhar.

As opções de voz masculina e feminina são fixas para cada idioma. No modo Edge, o serviço retorna marcações de tempo das palavras; a interface usa essas marcações para revelar o texto enquanto o áudio toca. Os arquivos de áudio não ficam salvos no banco do Marai. A gravação temporária passa pelo navegador, servidor e serviço de reconhecimento; o áudio falado é recebido pelo navegador para reprodução.

Como esses serviços de voz são externos, eles precisam de internet. Isso também vale para a IA. Se a internet ou o provedor estiver fora do ar, a função correspondente pode falhar mesmo que a página e o banco local ainda estejam funcionando.

## Como o código é conferido

O projeto contém **testes automatizados**, isto é, verificações executadas por programas para conferir se as regras de certas partes do Marai continuam corretas após alterações. **pytest** executa verificações do servidor Python. **Vitest** executa verificações da interface. O ambiente **Happy DOM** fornece a esses testes uma estrutura simples de página de navegador, sem abrir uma janela gráfica.

Os testes do servidor usam **SQLite**, um banco separado e temporário, em vez do PostgreSQL que guarda as conversas reais. Algumas respostas de IA são substituídas dentro dos próprios testes para que uma verificação não dependa de internet ou de consumir a cota de serviço. Isso vale para os testes, não para a conversa normal no Marai. O arquivo `VALIDACAO.md` registra verificações adicionais executadas com o banco e os serviços reais.

## Onde os dados ficam

O Marai usa **PostgreSQL**, um sistema de banco de dados que organiza informações em tabelas e as mantém gravadas no computador. Entre as informações guardadas estão:

| Informação | O que fica guardado |
| --- | --- |
| Conta | Nome, endereço de e-mail e verificador da senha |
| Sessão de acesso | Um resumo criptográfico do código de sessão e a validade |
| Personagem | Nome, aparência, voz e personalidade |
| Conversa | Idioma, nível, cenário e cópia dos dados do personagem naquela conversa |
| Mensagens | Texto ordenado de cada conversa, inclusive registros de mensagens bloqueadas |
| Continuidade | Resumo interno usado para continuar conversas compridas |

**SQLAlchemy** é uma biblioteca Python que liga o código do servidor ao banco. Ela representa os registros do banco como objetos no código. **Alembic** aplica alterações organizadas na estrutura do banco, chamadas **migrações**, sem recriar o banco a cada inicialização.

O servidor usa **Argon2id** para guardar uma verificação segura da senha; ele não precisa gravar a senha original. O navegador recebe um **cookie HttpOnly**, um pequeno código de sessão que o JavaScript da página não pode ler. No banco fica somente o resumo criptográfico desse código. O cookie expira depois do período configurado e pode ser revogado ao sair da conta.

Os dados do PostgreSQL ficam num **volume nomeado do Docker**, identificado neste projeto como `bilingua_marai_data`. Volume é a área de armazenamento persistente associada ao Docker. Ela permanece separada do container do banco: parar ou substituir o container não apaga automaticamente o conteúdo do volume. Não remova esse volume se quiser manter contas e conversas. O arquivo `.env`, com as chaves dos provedores, fica separado na pasta do projeto e não deve ser compartilhado.

O navegador guarda localmente uma preferência de movimento reduzido. O áudio gravado não fica guardado como arquivo de conversa no PostgreSQL. Os registros de mensagens e os arquivos de áudio têm destinos e durações diferentes, conforme descrito acima.

O login normal usa e-mail e senha. O login Google é opcional e requer credenciais próprias de login Google; as chaves Gemini e Groq não ativam esse recurso.

## O que é o Docker e por que precisa estar aberto

O aplicativo usa um programa de banco chamado PostgreSQL. Para não exigir a instalação e configuração manual desse banco no Windows, o Marai o inicia no **Docker**. Docker é um programa que executa aplicações isoladas e reúne os arquivos de que elas precisam.

O **Docker Desktop** é o aplicativo do Windows que inicia e controla o Docker. O **container** é a execução do PostgreSQL gerenciada por ele. A configuração atual do Marai põe o banco dentro do container; o servidor Python e o navegador continuam fora dele, no Windows. Por isso, o Docker Desktop precisa estar aberto para iniciar ou acessar o banco. O script tenta abrir o Docker Desktop e aguarda o banco ficar acessível.

**Docker Compose** lê o arquivo `compose.yaml` e inicia o serviço descrito nele. Neste caso, ele inicia uma versão definida do PostgreSQL, publica o acesso local na porta `5433` e conecta o banco ao volume persistente. A identidade Compose foi fixada como `bilingua`, para que mudar o nome da pasta do projeto para `marai` não faça o aplicativo começar a usar outro banco.

O container de banco não contém Gemini, Groq nem o servidor FastAPI. O container guarda e executa o PostgreSQL. A aplicação continua no Windows, e seus pedidos de IA e voz seguem pela internet.

## Termos técnicos em uma frase

| Termo | Significado neste projeto |
| --- | --- |
| Agente autônomo | Programa de IA que escolhe e executa tarefas e ferramentas sem receber cada ação pronta do aplicativo. O Marai não usa esse tipo de agente. |
| Alembic | Ferramenta que aplica mudanças planejadas nas tabelas do banco. |
| API | Sigla de “interface de programação de aplicações”: endereços e regras usados por programas para trocar pedidos e respostas. |
| API key ou chave de API | Código secreto que autoriza o servidor a chamar um provedor. No Marai, as chaves Gemini e Groq ficam no `.env`. |
| Argon2id | Método usado para produzir a verificação da senha antes de guardá-la no banco. |
| Backend | Parte do programa executada no servidor, que aplica regras e acessa dados e serviços. |
| Banco de dados | Programa e estrutura onde os dados da aplicação são organizados e guardados. |
| Chain of thought | Expressão em inglês para passos internos de raciocínio de um modelo; não é a fala mostrada ao usuário. |
| Classificação semântica | Avaliação que pede à IA para considerar o sentido de um texto, além de procurar palavras conhecidas. Pode errar e por isso é combinada com outras verificações. |
| Componente | Peça separada da interface, como o balão de fala, que pode ser usada na montagem da tela. |
| Cookie | Pequeno valor que o navegador envia ao servidor, neste caso para reconhecer uma sessão de acesso. |
| CSS | Sigla de “folhas de estilo em cascata”: linguagem que determina a aparência e a disposição dos elementos da página. |
| Docker | Programa que executa aplicações em containers isolados. |
| Docker Compose | Recurso que inicia os serviços definidos em `compose.yaml`. |
| Docker Desktop | Aplicativo do Windows que inicia e controla o Docker. |
| Endpoint | Endereço de uma API destinado a uma operação específica. |
| FastAPI | Framework Python usado para criar e atender os pedidos ao servidor. |
| Fallback | Termo em inglês para a opção de reserva usada quando o serviço principal falha ou atinge o limite. No Marai, a Groq pode assumir essa função para a IA de texto. |
| Framework | Estrutura de código pronta que organiza tarefas comuns de uma aplicação. |
| Frontend | Parte visível com a qual a pessoa usa o aplicativo. |
| Guardrail | Regras e verificações que bloqueiam certos pedidos e respostas. |
| HTML | Sigla de “linguagem de marcação de hipertexto”: linguagem que organiza os elementos e o conteúdo de uma página. |
| HTTP | Sigla de “protocolo de transferência de hipertexto”: padrão de comunicação usado para enviar pedidos e respostas pela rede. |
| HttpOnly | Opção de cookie que impede o código JavaScript da página de ler o valor da sessão. |
| JSON | Sigla de “notação de objetos JavaScript”: formato estruturado usado para representar e enviar dados. |
| Migração | Mudança planejada na estrutura do banco, como criar ou atualizar uma tabela. |
| Modelo de linguagem | Serviço de IA treinado para receber texto e produzir texto. “Modelo” também pode significar uma forma de organizar dados no código; o contexto explica qual sentido está em uso. |
| MVVM | Sigla para modelo, tela e controlador do estado da tela; organização usada para separar partes do programa. |
| ORM | Ferramenta que relaciona os registros do banco com objetos usados no código. SQLAlchemy é o ORM do servidor. |
| Pydantic | Biblioteca que confere e limita os dados recebidos pelo servidor. |
| PostgreSQL | Programa de banco de dados usado pelo Marai. |
| Prompt | Instruções e dados que o servidor envia ao modelo de IA para pedir uma resposta. |
| Prompt injection | Tentativa de colocar instruções dentro de uma mensagem para fazer a IA ignorar as regras do aplicativo. |
| Provedor | Empresa ou serviço que fornece IA ou voz pela internet. Gemini, Groq e o serviço de voz Edge têm funções distintas no Marai. |
| Python | Linguagem de programação usada pelo servidor. |
| pytest | Ferramenta que executa os testes do código Python. |
| React | Biblioteca JavaScript usada para montar e atualizar as telas. |
| Rota | Caminho da API que atende uma operação, como salvar um personagem. |
| Resumo criptográfico | Resultado curto de um cálculo feito sobre um código; o Marai guarda esse resultado da sessão em vez do código original. Não é o resumo da conversa. |
| Service | “Serviço”: parte do código que executa uma tarefa específica, por exemplo enviar um pedido ao servidor ou gerar áudio. |
| Sessão | Período em que o aplicativo reconhece que a pessoa já entrou na conta. |
| SQL | Sigla de “linguagem de consulta estruturada”: linguagem usada para consultar e atualizar informações em bancos como o PostgreSQL. |
| SQLAlchemy | Biblioteca que permite ao servidor Python consultar e atualizar o PostgreSQL. |
| STT | Sigla de “fala para texto”: serviço que reconhece palavras em uma gravação. |
| SVG | Sigla de “gráficos vetoriais escaláveis”: formato usado para desenhar os personagens por meio de formas. |
| Síntese de voz | Produção de áudio falado a partir de um texto. |
| TTS | Sigla de “texto para fala”: serviço que produz áudio usando um texto. |
| TypeScript | Linguagem usada para escrever a interface; é convertida em JavaScript para o navegador. |
| Vitest | Ferramenta que executa os testes da interface. |
| Node.js | Programa que executa ferramentas JavaScript no computador; neste projeto, ajuda a preparar a interface. |
| pnpm | Programa que instala as bibliotecas usadas pela interface. |
| URL | Sigla de “localizador uniforme de recurso”: endereço completo de uma página ou serviço, como `http://localhost:8001`. |
| Happy DOM | Programa de testes que fornece uma página de navegador simplificada dentro de um teste, sem abrir uma janela. |
| SQLite | Programa de banco de dados usado nos testes automatizados, separado do PostgreSQL do aplicativo. |
| Jailbreak | Nome informal de uma tentativa de fazer a IA deixar de obedecer às regras do aplicativo. |
| Vite | Ferramenta que inicia a interface durante o desenvolvimento e prepara os arquivos finais. |
| Volume | Área persistente do Docker usada neste projeto para guardar os dados do banco. |
| View | Parte de MVVM que mostra os dados e recebe interações da pessoa. |
| ViewModel | Parte de MVVM que organiza o estado da tela e as ações solicitadas. |
| Whisper | Modelo de reconhecimento de fala oferecido pela Groq e usado pelo Marai. |
| `localhost` | Endereço que significa “este mesmo computador”. |
| Porta | Número que identifica qual serviço local deve receber uma conexão, por exemplo `8001` para o aplicativo e `5433` para o banco. |
| `.env` | Arquivo local com configurações privadas, inclusive as chaves dos serviços de IA. |

## Respostas rápidas

- **Quais linguagens?** Python no servidor; TypeScript, convertido para JavaScript, na interface; HTML e CSS na página e SVG nos desenhos.
- **Quais frameworks e bibliotecas?** FastAPI organiza o servidor; React monta a interface; SQLAlchemy liga o servidor ao banco; Pydantic valida os dados; Alembic controla mudanças no banco.
- **Onde ficam as conversas?** No PostgreSQL local, cujo conteúdo persiste no volume `bilingua_marai_data` do Docker.
- **A IA é um conjunto de agentes?** Não. O servidor faz chamadas específicas ao Gemini ou à Groq quando precisa gerar, verificar ou reconhecer conteúdo.
- **Há um guardrail independente?** Não. A proteção combina verificações locais com classificações enviadas a esses mesmos provedores.
- **Por que o Docker tem de estar aberto?** Porque ele executa o PostgreSQL de que o servidor precisa para acessar contas, personagens e conversas.
- **O que precisa de internet?** A geração de texto, a classificação semântica, o reconhecimento de áudio e a voz padrão. A interface e o banco são locais.
- **As chaves aparecem no navegador?** Não. O `.env` é lido pelo servidor, que envia a chave certa diretamente ao provedor correspondente.

