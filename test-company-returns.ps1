param([switch]$Phone, [int]$Port = 8084)
$ErrorActionPreference = 'Stop'
$appFolder = Join-Path $PSScriptRoot 'App'
$python = (Get-Command python -ErrorAction Stop).Source
$server = $null
try {
    # Refuse to use an occupied port: it might belong to a different branch.
    $probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    try { $probe.Start() } finally { $probe.Stop() }
    $server = Start-Process -FilePath $python -ArgumentList @('-u', '-m', 'http.server', "$Port", '--bind', '127.0.0.1', '--directory', ('"' + $appFolder + '"')) -WindowStyle Hidden -PassThru
    $localUrl = "http://127.0.0.1:$Port/index.html"
    $ready = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        if ($server.HasExited) { throw 'The test server could not start.' }
        try {
            $response = Invoke-WebRequest -Uri $localUrl -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200 -and $response.Content.Contains('tab-company-returns')) { $ready = $true; break }
        } catch { Start-Sleep -Milliseconds 200 }
    }
    if (-not $ready) { throw 'The Company Returns test app did not respond.' }
    Write-Host ''
    Write-Host 'COMPANY RETURNS - TEST BRANCH' -ForegroundColor Green
    Write-Host "Computer: $localUrl"
    Write-Host 'Sign in, open Expires Labo, then choose Company Returns.'
    Write-Host 'Keep this window open while testing. Ctrl+C stops the test server.'
    if ($Phone) {
        $ssh = (Get-Command ssh -ErrorAction Stop).Source
        Write-Host ''
        Write-Host 'A temporary public HTTPS test address will appear below.' -ForegroundColor Yellow
        Write-Host 'On your phone, open that HTTPS address with /index.html at the end.'
        Write-Host 'Only the App folder is served. The app still requires your normal sign-in.'
        Write-Host 'The computer must stay awake. The temporary URL may change next time.'
        Write-Host 'First connection: SSH may ask you to trust localhost.run.'
        Write-Host ''
        # No credentials, firewall changes, or production deployment are needed.
        & $ssh -T -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -R "80:127.0.0.1:$Port" nokey@localhost.run
        if ($LASTEXITCODE -ne 0) { throw 'The temporary phone connection ended or could not be established.' }
    } else {
        Start-Process $localUrl
        Read-Host 'Press Enter when you have finished testing'
    }
} catch {
    Write-Host ("Unable to run the test: " + $_.Exception.Message) -ForegroundColor Red
    Write-Host "If port $Port is already in use, close the earlier test window first."
} finally {
    if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id }
}
