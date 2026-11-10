# Marai

Plataforma local de conversação em sete idiomas, com amigos fictícios 2D personalizáveis. Interface em português, identidade azul e verde e experiência centrada no personagem e na voz. Público: adolescentes.

## Começar no Windows

Pré-requisitos: **Docker Desktop**, **Python 3.12+** (ou **uv**) e **Node.js LTS** com npm ou pnpm. O iniciador também reconhece os runtimes já instalados pelo Codex neste computador.

1. Preserve o `.env` existente na raiz com `GEMINI_API_KEY` e `GROQ_API_KEY`. Para uma instalação nova, copie `.env.example` para `.env` e preencha as duas chaves.
2. Execute **Iniciar Marai.cmd**. Ele inicia o PostgreSQL, instala dependências, compila a interface, aplica migrações e inicia o servidor.
3. Abra **http://localhost:8001**, de preferência no Chrome ou Edge. Crie sua própria conta.
4. Mantenha a janela aberta durante o uso. Encerre o servidor com `Ctrl+C`. Os dados permanecem no volume do PostgreSQL.

Se o Docker Desktop estiver fechado, o iniciador tenta abri-lo e aguarda até dois minutos antes de preparar o banco. Na primeira execução, conclua qualquer configuração solicitada pelo próprio Docker Desktop e execute o Marai novamente.

O projeto Docker usa o nome fixo `bilingua` para preservar o banco original mesmo após renomear a pasta para `marai`.

A porta 8000 já pertence a outro projeto neste computador; o Marai usa **8001**, e o PostgreSQL usa **5433**. Para outro servidor local: `powershell -File .\start.ps1 -Port 8002`. Se configurar o Google, ajuste também a URL de retorno. Para preparar tudo sem iniciar o servidor: `powershell -File .\start.ps1 -SetupOnly`.

O servidor escuta somente na interface local. Não foi feita publicação externa.

## Migrar o PostgreSQL local para o Aiven

O projeto pode usar um PostgreSQL remoto sem iniciar o container local. Para transferir os dados existentes, mantenha o `.env` apontando para o banco local e:

1. Encerre o servidor do Marai com `Ctrl+C` e mantenha o container do banco local ligado.
2. Abra **Migrar para Aiven.cmd**. Host, porta, banco `marai` e usuário `avnadmin` já estão preenchidos com os dados informados para este serviço.
3. Digite somente a senha do Aiven quando o programa pedir. Ela não aparecerá na tela nem deve ser enviada por mensagem.
4. Aguarde **CONCLUÍDO** e abra **Iniciar Marai.cmd**.

O certificado já baixado é localizado em `ca.pem` na raiz, `marai-ca.pem` na pasta do usuário ou `.runtime/ca.pem`. O programa mantém uma cópia dentro do projeto e salva seu caminho relativo na configuração. O conteúdo é lido diretamente pelo Python, inclusive em pastas com espaços e acentos, e a identidade do servidor é verificada por TLS. Se um caminho absoluto antigo deixar de existir, a conexão procura o certificado `ca.pem` da pasta do Marai automaticamente. Mantenha esse certificado no projeto. O migrador aplica o esquema atual, copia os registros em uma transação, compara as quantidades e o conteúdo completo antes de concluir e então atualiza `DATABASE_URL` no `.env`. Se a cópia falhar, os registros inseridos nessa transação são desfeitos; tabelas vazias podem permanecer e ser reutilizadas na tentativa seguinte. Dados diferentes já existentes no Aiven impedem a migração; dados idênticos permitem retomar a configuração sem duplicar registros. O banco local é preservado. O serviço Aiven usa PostgreSQL 16 e o container local usa PostgreSQL 17; a transferência de registros evita depender de um arquivo de despejo entre versões diferentes. Depois da migração, o iniciador detecta o endereço remoto e não inicia o container local.

Para conferir o banco local e a conexão TLS sem migrar ou pedir senha: `.venv\Scripts\python.exe scripts\migrate_to_aiven.py --check`. Para outro serviço, os parâmetros `--host`, `--port`, `--database`, `--username` e `--ca` permitem alterar os valores. Um comprovante sem senha é salvo em `.runtime/migration-aiven.json` após a conclusão.

A conexão com o Aiven usa o driver Python `pg8000` e um contexto TLS com certificado e nome do servidor verificados. A configuração é compartilhada pela aplicação, pelo Alembic e pelo migrador. Essa escolha evita os erros de caminho Unicode e de endereço IPv6 no certificado encontrados na biblioteca nativa do Windows. O banco local continua usando `psycopg`.

Se a conexão falhar, confira no painel do Aiven se o serviço está ativo, se o acesso público/firewall permite a conexão do seu endereço de internet e se host, porta, usuário, banco e certificado correspondem ao mesmo serviço. Não compartilhe senha, chaves de API ou a linha completa de `DATABASE_URL`.

## Fluxo

- **1. Conversação:** primeiro escolha entre os sete idiomas, níveis A1–C2 e seis cenários: parque, sala acolhedora, ilha de doces, Paris, parque temático original e Kyoto. Cenários possuem movimentos discretos e suporte a redução de movimento.
- **2. Aparência:** nome, apresentação visual, pele, rosto, olhos, sobrancelhas, nariz, sorriso estático, seis cabelos, roupas, cores, óculos, boné/gorro, brincos, colar, barba e sardas. As camadas SVG são combináveis, independentes e salvas como dados.
- **3. Personalidade e identidade:** até três características, profissão, idade fictícia, origem, interesses, estilo de conversa, biografia e preferências específicas persistentes. Esses campos são opcionais. “Surpreenda-me” usa uma IA real; a aparência também varia.
- Ao avançar, voltar ou trocar de etapa pela navegação, a página retorna ao topo. As descrições, opções, sugestões de profissão e placeholders acompanham o idioma escolhido, assim como a identidade gerada pela IA. Navegação geral permanece em português. **A história de vida aceita qualquer idioma e é preservada sem tradução automática.** O idioma descritivo fica salvo no JSON do personagem; identificadores de traços/interesses permanecem compatíveis com os personagens existentes.
- Escolha começar pelo microfone, por texto ou deixar o amigo iniciar. **Gravar resposta** inicia uma tentativa local. Use **Pausar**, **Continuar** ou **Reiniciar** para regravar desde o zero. **Finalizar gravação** prepara uma prévia para ouvir; somente **Enviar áudio** envia para transcrição e conversa. **Descartar** abandona a tentativa. As pausas não contam no tempo gravado; os limites de dois minutos e 8 MB finalizam a tentativa para revisão, sem envio automático. As tentativas descartadas não são enviadas ao servidor.
- A resposta é falada e o balão revela o texto usando os tempos das palavras do serviço de voz. **Pausar** congela áudio/texto, **Continuar** mantém exatamente a posição, e **Reiniciar** volta ao começo usando o mesmo áudio já carregado, inclusive após pausa ou término. Ao terminar, o texto completo permanece.
- O balão mede a resposta completa para ajustar a fonte e reservar o espaço antes da revelação. O texto não é cortado nem resumido. Respostas excepcionalmente extensas fazem a página crescer, mantendo a fonte legível e evitando uma barra de rolagem dentro do balão.
- “Outra resposta” substitui a última mensagem e seu áudio. Na abertura, solicita outro assunto. “Trocar assunto” continua a conversa com uma nova temática. Não há sincronização labial.
- O painel de transcrição permite consultar as mensagens e ouvi-las novamente. O histórico lateral abre com hover, foco ou clique; no celular abre por toque. Permite retomar, renomear e excluir mediante confirmação.
- O cartão do amigo, no início, permite editar personalidade e aparência. As alterações valem para novas conversas. **Conversas anteriores preservam sua própria cópia da identidade e aparência**, além das mensagens.

## IA, cotas e voz

As chamadas privadas são feitas exclusivamente pelo backend. O `.env` nunca é enviado à interface.

| Etapa | Serviço |
| --- | --- |
| Conversa, identidade e verificação semântica | Gemini como principal; Groq como reserva |
| Reconhecimento de fala | Whisper multilíngue real, pela Groq, no endpoint de **transcrição**, sem tradução |
| Voz padrão | Serviço online Microsoft Edge via `edge-tts`, sem terceira chave |
| Voz opcional | Gemini TTS, ativado por `TTS_PROVIDER=gemini`, com fallback para Edge |

O esgotamento de cota e os erros 429 do Gemini acionam automaticamente a Groq, usando a mesma política de segurança, personalidade e contexto. Erros de conexão, indisponibilidade ou modelo inacessível também acionam a reserva. Um circuito de cinco minutos evita repetir chamadas ao Gemini indisponível; após esse intervalo, ele pode ser tentado novamente. Isso **não muda a chave** de um serviço para outro: cada provedor usa sua própria chave. Se ambos falharem, a interface mostra o erro e permite repetir sem inventar respostas nem duplicar mensagens.

A Groq atualmente oferece TTS apenas em inglês e árabe, portanto não é uma substituição multilíngue completa para a voz do Gemini. Por isso o padrão é Edge, com duas opções visíveis: **masculina e feminina**. Cada idioma possui um par fixo; idade, profissão e aparência não escolhem outra voz. A voz permanece consistente entre as respostas. O ritmo é mais lento em A1/A2.

`edge-tts` usa um serviço online de terceiros, via um cliente independente; não é uma API Azure contratada nem possui garantia de disponibilidade. O áudio e o texto são reais e correspondentes. Se o serviço falhar, o texto permanece salvo e o usuário pode repetir a reprodução. `TTS_PROVIDER=gemini` usa a mesma voz multilíngue Charon/Kore; uma falha desse modo pode alterar o timbre ao recorrer ao Edge. Sem temporização disponível, o balão usa uma aproximação pela duração do áudio.

Os modelos são configuráveis no `.env`; os identificadores padrão foram conferidos nas APIs disponíveis nesta instalação. Fontes: [modelos Gemini](https://ai.google.dev/gemini-api/docs/models), [modelos Groq](https://console.groq.com/docs/models), [transcrição Groq](https://console.groq.com/docs/speech-to-text), [voz Groq](https://console.groq.com/docs/text-to-speech), [Gemini TTS](https://ai.google.dev/gemini-api/docs/speech-generation), [cliente Edge TTS](https://github.com/rany2/edge-tts).

## Tradutor integrado

O ícone **Languages**, à direita do histórico dentro da conversa, abre o tradutor do MyMemory sem sair do Marai. O destino inicial acompanha o idioma da conversa; a origem inicial é português do Brasil (inglês quando a conversa está em português). Os seletores oferecem 16 idiomas, inversão e cópia do resultado. O botão **Traduzir** faz uma consulta explícita; digitar, inverter e copiar não fazem consultas automáticas. Abrir o painel mantém a reprodução e a gravação em andamento. Histórico e tradutor ocupam o mesmo espaço e abrem um de cada vez.

A interface chama `POST /api/translate`, autenticado, e o backend consulta somente `GET https://api.mymemory.translated.net/get` com `q` e `langpair`. Não há integração com Gemini/Groq, alteração do histórico ou envio ao chatbot. As verificações locais de conteúdo do Marai são aplicadas na entrada e no resultado, sem chamar a classificação por IA. Consultas e resultados não são persistidos no banco do Marai. O texto da consulta é enviado ao MyMemory, que possui suas próprias regras de retenção: veja os [termos do serviço](https://mymemory.translated.net/terms-and-conditions).

Não é necessário cartão, chave ou cadastro. O limite por consulta é de **500 bytes UTF-8**, verificado na interface e no servidor; acentos e outros alfabetos podem ocupar mais de um byte. O MyMemory oferece **5.000 caracteres/dia** sem identificação e **50.000/dia** com e-mail válido. Para a opção ampliada, adicione ao `.env`, opcionalmente, `MYMEMORY_EMAIL=seu-email-valido@dominio.com`. O e-mail é validado e enviado somente pelo backend como `de`; não é exposto à interface nem retirado da conta de quem estiver conversando. Essas cotas são controladas pelo fornecedor e podem ser compartilhadas pelas consultas feitas pelo servidor; não representam uma franquia individual de cada usuário do Marai. Há também limite local de 20 consultas por minuto por conta. Não há repetição automática, troca de provedor, serviço pago ou tentativa de contornar cotas.

Erros de conexão, tempo de resposta, respostas inválidas e limite diário aparecem no painel sem interferir na conversa. Após atualizar o código do servidor, encerre o Marai com `Ctrl+C` na janela atual e execute **Iniciar Marai.cmd** novamente. Fontes: [especificação da API](https://mymemory.translated.net/doc/spec.php), [limites oficiais](https://mymemory.translated.net/doc/usagelimits.php).

## Segurança de conversação

A proteção combina verificações locais com classificação semântica de entradas, respostas, identidades e memória. São proibidos palavrões/linguagem ofensiva, conteúdo sexual e paquera, extração ou explicação do sistema interno do Marai e prompt injection/jailbreak. Não há exceção para citações, tradução, codificação, pesquisa, teste ou alegação de ser administrador. O filtro local normaliza acentos latinos, caracteres invisíveis, algumas grafias disfarçadas e formas comuns de codificação; uma correspondência local não pode ser liberada pelo modelo. Conversas comuns sobre tecnologia continuam permitidas.

Ao bloquear, o agente apresenta e pode falar **somente a resposta padrão no idioma escolhido**. Em português: “Esse conteúdo é proibido no Marai. Por favor, refaça sua pergunta sobre um assunto permitido.” Não introduz assunto nem faz uma nova pergunta. “Outra resposta” e “Trocar assunto” ficam desabilitados, e a mesma restrição existe no backend. Somente uma nova mensagem permitida do usuário retoma o diálogo. O estado permanece após recarregar.

Tentativas bloqueadas são preservadas no banco para integridade do histórico, mas aparecem como `[Mensagem bloqueada]` na transcrição e não entram na geração ou nos resumos. A resposta imprópria de um modelo é descartada e substituída pela mesma mensagem padrão. Nomes e perfis são tratados como dados sem poder de alterar instruções. A política é compartilhada entre geração e classificação e também verifica áudios históricos antes de sintetizá-los.

Se a verificação de segurança falhar, o sistema não libera uma resposta não verificada. A mesma política vale ao trocar de provedor, regenerar ou gerar identidades. Nenhum filtro de linguagem oferece garantia absoluta; os testes cobrem os casos documentados em `VALIDACAO.md`.

O personagem se apresenta como fictício e não promove segredo, exclusividade emocional ou compartilhamento de contato privado. A sala acolhedora é um cenário, não atendimento terapêutico. A IA mantém o idioma escolhido mesmo quando solicitada a traduzir ou corrigir; não há notas, provas nem avaliações.

## Login Google

O login com e-mail/senha funciona com as duas chaves existentes. **As chaves Gemini e Groq não habilitam OAuth Google.** A implementação Google está pronta para configuração, mas depende de um cliente OAuth próprio:

1. No Google Cloud, configure a tela de consentimento e um cliente OAuth do tipo aplicativo web.
2. Cadastre a URL de retorno exata: `http://localhost:8001/api/auth/google/callback`.
3. Adicione ao `.env`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_REDIRECT_URI`.
4. Reinicie o servidor. O botão Google passa a iniciar o fluxo OAuth real.

O callback valida o token OIDC, o estado e o e-mail verificado. Uma conta existente por senha não é vinculada silenciosamente a um login Google. Enquanto as credenciais OAuth não forem fornecidas, o botão explica a necessidade de configuração. O fluxo externo Google não foi testado com uma conta real.

## Arquitetura MVVM

```text
frontend/src/
  models/            Tipos de domínio e catálogos
  services/          API HTTP e sincronização do balão
  viewmodels/        Estado e ações de acesso, criação e conversa
  views/             Telas React, sem acesso direto ao banco
  components/        Avatar em camadas, cenários, navegação e diálogos
backend/app/
  models.py          Modelos persistentes SQLAlchemy
  schemas.py         Modelos de entrada e validação
  views/             Views HTTP FastAPI e serialização
  viewmodels/        Transições da conversa, contexto e persistência atômica
  services/          Provedores, fala, personalidade e política de segurança
  security.py        Sessões, senhas e limites
  database.py        Acesso PostgreSQL
  repositories.py    Consulta de recursos do dono e serialização de agregados
  main.py            Composição da aplicação e middleware
backend/migrations/  Migrações versionadas Alembic
backend/tests/       Testes isolados dos fluxos críticos
scripts/             Verificações reais, opcionais, de integração
```

Os ViewModels do frontend são hooks React que coordenam os modelos e os serviços. No backend, as Views HTTP delegam as transições da conversa ao ViewModel e os serviços externos às camadas específicas. A divisão preserva as responsabilidades de apresentação, estado, domínio e integrações.

Persistência: usuários, sessões revogáveis, personagens, cópias de configuração por conversa, mensagens ordenadas e identificadores de operação. Preferências e aparência usam JSON estruturado. Resumos internos limitam o contexto de sessões longas; todas as mensagens originais continuam no banco. A memória de uma conversa é restaurada quando ela é retomada; não se atribuem ao personagem lembranças de outras conversas ausentes do contexto.

Senhas usam Argon2id. Sessões usam tokens aleatórios, hashes no banco e cookies HttpOnly/SameSite, com validação de origem nas operações de escrita. Todos os recursos exigem dono autenticado. Versões e identificadores idempotentes impedem duplicação em tentativas de envio; o frontend cancela gravações e reprodução ao sair da conversa. Os limites em memória são apropriados ao servidor local de um processo; uma publicação com vários processos exigiria um limitador compartilhado.

## Desenvolvimento manual

```powershell
docker compose up -d --wait db
uv venv --python 3.12 .venv
uv pip sync --python .venv/Scripts/python.exe backend/requirements.lock
.venv/Scripts/python.exe -m alembic -c backend/alembic.ini upgrade head
cd frontend
pnpm install --frozen-lockfile
pnpm dev
```

Em outro terminal, na raiz:

```powershell
.venv/Scripts/python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8001
```

Desenvolvimento: `http://localhost:5173`, com proxy `/api` para 8001. Após `pnpm build`, reinicie o backend para servir a aplicação compilada diretamente em 8001. API documentada em `http://localhost:8001/docs`.

## Testes

```powershell
.venv/Scripts/python.exe -m pytest -q
cd frontend
pnpm test
pnpm build
```

Os testes automatizados usam banco SQLite **exclusivamente como ambiente isolado de teste** e respostas de IA explicitamente substituídas nos testes, sem afetar a aplicação real. O aplicativo utiliza PostgreSQL e serviços reais. A verificação adicional de integração percorre PostgreSQL e as APIs configuradas:

```powershell
# Com o Marai em execução em 8001; consome a cota das APIs configuradas.
.venv/Scripts/python.exe scripts/live_check.py
```

Para conferir especificamente a proteção com os provedores reais, sem gravar o microfone ou usar dados pessoais:

```powershell
.venv/Scripts/python.exe scripts/check_guardrails.py
```

Esse script usa frases públicas e áudio sintetizado de teste, sem gravar o microfone nem enviar dados pessoais do usuário, e remove sua própria conta de teste ao finalizar. Os resultados locais ficam em `.runtime/live-results.json`, ignorado pelo Git.

## Dados e configuração

- O `.env` e o diretório `.runtime` estão no `.gitignore`. Nunca coloque chaves em variáveis `VITE_*`.
- Áudios capturados e sintetizados não são persistidos pelo Marai. Transcrições e respostas ficam no PostgreSQL. Os provedores externos recebem os dados necessários ao processamento e possuem suas próprias políticas de retenção.
- `docker compose stop db` desliga o banco sem apagar os dados. Evite remover o volume se quiser preservar o histórico.
- A sessão expira em 14 dias por padrão. Configurações de limites, modelos e Google constam em `.env.example`.
- A publicação externa e políticas institucionais de cadastro/consentimento não fazem parte desta instalação local. Ao publicar, configure HTTPS e `COOKIE_SECURE=true`, credenciais de banco próprias, limites compartilhados e o domínio correto.

Veja `VALIDACAO.md` para os resultados executados e os limites da verificação.
