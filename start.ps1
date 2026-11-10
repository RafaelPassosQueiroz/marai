param(
    [switch]$SetupOnly,
    [int]$Port = 8001
)

$ErrorActionPreference = 'Stop'
$projectDirectory = $PSScriptRoot
Set-Location -LiteralPath $projectDirectory
$runtimeDirectory = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies'

function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao executar $Program. Confira a mensagem acima."
    }
}

function Test-DockerEngine {
    param([string]$DockerPath)
    # Capture native stderr independently of PowerShell's Stop preference.
    # A starting Docker engine can also leave its CLI waiting indefinitely.
    $probe = New-Object System.Diagnostics.Process
    $probe.StartInfo.FileName = $DockerPath
    $probe.StartInfo.Arguments = 'info --format "{{.ServerVersion}}"'
    $probe.StartInfo.UseShellExecute = $false
    $probe.StartInfo.CreateNoWindow = $true
    $probe.StartInfo.RedirectStandardOutput = $true
    $probe.StartInfo.RedirectStandardError = $true
    try {
        $null = $probe.Start()
        $outputTask = $probe.StandardOutput.ReadToEndAsync()
        $errorTask = $probe.StandardError.ReadToEndAsync()
        if (-not $probe.WaitForExit(10000)) {
            $probe.Kill()
            return $false
        }
        return ($probe.ExitCode -eq 0)
    } finally {
        $probe.Dispose()
    }
}

Write-Host ''
Write-Host 'MARAI - preparando boas conversas...' -ForegroundColor Cyan

if (-not (Test-Path -LiteralPath '.env')) {
    Copy-Item -LiteralPath '.env.example' -Destination '.env'
    throw 'Edite o arquivo .env e preencha GEMINI_API_KEY e GROQ_API_KEY. Depois, execute novamente.'
}

# Read only the database address here; Pydantic loads the full .env in Python.
# This allows a remote Aiven database without starting a local Docker container.
$databaseUrl = $env:DATABASE_URL
if (-not $databaseUrl) {
    $databaseLine = Get-Content -LiteralPath '.env' | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -Last 1
    if ($databaseLine -match '^\s*DATABASE_URL\s*=\s*(.*?)\s*$') {
        $databaseUrl = $Matches[1].Trim().Trim('"').Trim("'")
    }
}
$databaseHost = '127.0.0.1'
if ($databaseUrl) {
    try {
        $databaseHost = ([Uri]$databaseUrl).DnsSafeHost.Trim('[', ']')
        if (-not $databaseHost) { throw 'host ausente' }
    } catch {
        throw 'DATABASE_URL nao contem um endereco PostgreSQL valido. Confira a configuracao sem compartilhar a senha.'
    }
}
$usesLocalDatabase = $databaseHost -in @('localhost', '127.0.0.1', '::1')

if ($usesLocalDatabase) {
    $dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $dockerCommand) {
        throw 'Instale o Docker Desktop, inicie-o e execute novamente. Consulte o README.'
    }

    if (-not (Test-DockerEngine $dockerCommand.Source)) {
        $dockerDesktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
        if (Test-Path -LiteralPath $dockerDesktop) {
            Start-Process -FilePath $dockerDesktop -WindowStyle Hidden
        }
        Write-Host 'Aguardando o Docker Desktop iniciar (ate 2 minutos)...'
        $dockerReady = $false
        $dockerDeadline = [DateTime]::UtcNow.AddMinutes(2)
        while ([DateTime]::UtcNow -lt $dockerDeadline) {
            Start-Sleep -Seconds 2
            if (Test-DockerEngine $dockerCommand.Source) { $dockerReady = $true; break }
        }
        if (-not $dockerReady) {
            throw 'O Docker nao ficou pronto em 2 minutos. Abra o Docker Desktop, aguarde o motor iniciar e execute o Marai novamente. Se o Docker pedir uma configuracao inicial, conclua-a primeiro.'
        }
    }

    Invoke-Checked $dockerCommand.Source @('compose', 'up', '-d', '--wait', 'db')
} else {
    Write-Host 'Banco PostgreSQL remoto configurado; o container local nao sera iniciado.' -ForegroundColor Cyan
}

$pythonPath = Join-Path $projectDirectory '.venv\Scripts\python.exe'
$uvCommand = Get-Command uv -ErrorAction SilentlyContinue
if (-not (Test-Path -LiteralPath $pythonPath)) {
    if ($uvCommand) {
        $bundledPython = Join-Path $runtimeDirectory 'python\python.exe'
        if (Test-Path -LiteralPath $bundledPython) {
            Invoke-Checked $uvCommand.Source @('venv', '--python', $bundledPython, '.venv')
        } else {
            Invoke-Checked $uvCommand.Source @('venv', '--python', '3.12', '.venv')
        }
    } else {
        $systemPython = Get-Command python -ErrorAction SilentlyContinue
        if (-not $systemPython) { throw 'Instale Python 3.12 ou superior e tente novamente.' }
        Invoke-Checked $systemPython.Source @('-m', 'venv', '.venv')
    }
}

if ($uvCommand) {
    Invoke-Checked $uvCommand.Source @('pip', 'sync', '--python', $pythonPath, 'backend/requirements.lock')
} else {
    Invoke-Checked $pythonPath @('-m', 'pip', 'install', '-r', 'backend/requirements.lock')
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { $null }
if (-not $nodePath) {
    $nodeCandidates = @(
        (Join-Path $runtimeDirectory 'node\bin\node.exe'),
        (Join-Path $env:ProgramFiles 'nodejs\node.exe')
    )
    $nodePath = $nodeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $nodePath) { throw 'Instale o Node.js LTS e tente novamente.' }
# Build tools also launch node by name, so include it for this process and its children.
# This does not modify the user's saved Windows environment variables.
$nodeDirectory = Split-Path -Parent $nodePath
$env:Path = "$nodeDirectory;$env:Path"
$pnpmCommand = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
$bundledPnpm = Join-Path $runtimeDirectory 'node\node_modules\pnpm\bin\pnpm.cjs'

Push-Location -LiteralPath 'frontend'
try {
    if ($pnpmCommand) {
        Invoke-Checked $pnpmCommand.Source @('install', '--frozen-lockfile')
        Invoke-Checked $pnpmCommand.Source @('run', 'build')
    } elseif (Test-Path -LiteralPath $bundledPnpm) {
        Invoke-Checked $nodePath @($bundledPnpm, 'install', '--frozen-lockfile')
        Invoke-Checked $nodePath @($bundledPnpm, 'run', 'build')
    } elseif ($npmCommand) {
        Invoke-Checked $npmCommand.Source @('install')
        Invoke-Checked $npmCommand.Source @('run', 'build')
    } else { throw 'Instale o Node.js LTS com npm ou instale o pnpm.' }
} finally { Pop-Location }

Invoke-Checked $pythonPath @('-m', 'alembic', '-c', 'backend/alembic.ini', 'upgrade', 'head')
if ($SetupOnly) {
    Write-Host 'Instalação pronta.' -ForegroundColor Green
    exit 0
}

$portInUse = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
if ($portInUse) {
    $maraiRunning = $false
    try {
        $runningHealth = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 5
        $runningPage = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/" -TimeoutSec 5
        $maraiRunning = ($runningHealth.status -eq 'ok' -and $runningPage.Content -match '<title>\s*marai\b')
    } catch {
        $maraiRunning = $false
    }
    if ($maraiRunning) {
        Write-Host "O Marai ja esta rodando em http://localhost:$Port. Use a janela existente." -ForegroundColor Green
        exit 0
    }
    throw "A porta $Port está ocupada. Feche a outra instância do Marai ou execute start.ps1 -Port 8002."
}
Write-Host ''
Write-Host "Abra http://localhost:$Port no Chrome ou Edge." -ForegroundColor Green
Write-Host 'Mantenha esta janela aberta. Para encerrar, pressione Ctrl+C.'
Invoke-Checked $pythonPath @('-m', 'uvicorn', 'app.main:app', '--app-dir', 'backend', '--host', '127.0.0.1', '--port', "$Port")
