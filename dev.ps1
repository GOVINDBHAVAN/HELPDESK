$root = $PSScriptRoot
$backendUrl = "http://localhost:5000"

Write-Host "Starting infrastructure (postgres, redis, mailpit)..."
docker compose -f "$root\docker-compose.yml" up -d postgres redis mailpit

Write-Host "Waiting for postgres to be ready..."
$timeout = 30
$elapsed = 0
do {
    Start-Sleep -Seconds 2
    $elapsed += 2
    docker compose -f "$root\docker-compose.yml" exec -T postgres pg_isready -U postgres 2>$null | Out-Null
} while ($LASTEXITCODE -ne 0 -and $elapsed -lt $timeout)

if ($LASTEXITCODE -ne 0) {
    Write-Error "Postgres did not become ready in time."
    exit 1
}

Write-Host "Stopping docker backend container if running (avoids port conflict)..."
docker compose -f "$root\docker-compose.yml" stop backend 2>$null | Out-Null

Write-Host "Starting backend on $backendUrl ..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend\Helpdesk.Api'; dotnet run"

Write-Host "Waiting for backend to be ready..."
$timeout = 60
$elapsed = 0
$backendReady = $false
do {
    Start-Sleep -Seconds 2
    $elapsed += 2
    try {
        $null = Invoke-WebRequest -Uri "$backendUrl/api/health" -UseBasicParsing -ErrorAction Stop
        $backendReady = $true
    } catch {}
} while (-not $backendReady -and $elapsed -lt $timeout)

if (-not $backendReady) {
    Write-Warning "Backend did not respond in time - frontend may load before it is ready."
}

Write-Host "Starting frontend..."
Set-Location "$root\frontend"
npm run dev
