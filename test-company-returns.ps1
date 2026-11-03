param([switch]$Phone, [switch]$Cloudflare, [int]$Port = 8084)
$ErrorActionPreference = 'Stop'
$appFolder = Join-Path $PSScriptRoot 'App'
$python = (Get-Command python -ErrorAction Stop).Source
$server = $null
try {
    # Pick the first free local port so an earlier test window cannot block this run.
    $portAvailable = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        $probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
        try {
            $probe.Start()
            $portAvailable = $true
            break
        } catch [System.Net.Sockets.SocketException] {
            $Port++
        } finally {
            try { $probe.Stop() } catch { }
        }
    }
    if (-not $portAvailable) { throw 'No free local test port was found between 8084 and 8103.' }
    $server = Start-Process -FilePath $python -ArgumentList @('-u', '-m', 'http.server', "$Port", '--bind', '127.0.0.1', '--directory', ('"' + $appFolder + '"')) -WindowStyle Hidden -PassThru
    $localUrl = "http://127.0.0.1:$Port/index.html"
    $ready = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        if ($server.HasExited) { throw 'The test server could not start.' }
        try {
            $response = Invoke-WebRequest -Uri $localUrl -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200 -and $response.Content.Contains('tab-company-returns') -and $response.Content.Contains('</html>')) { $ready = $true; break }
        } catch { Start-Sleep -Milliseconds 200 }
    }
    if (-not $ready) { throw 'The Company Returns test app did not respond.' }
    Write-Host ''
    Write-Host 'COMPANY RETURNS - TEST BRANCH' -ForegroundColor Green
    Write-Host "Computer: $localUrl"
    Write-Host 'Sign in, open Expires Labo, then choose Company Returns.'
    Write-Host 'Keep this window open while testing. Ctrl+C stops the test server.'
    if ($Phone) {
        Write-Host ''
        Write-Host 'A temporary public HTTPS test address will appear below.' -ForegroundColor Yellow
        Write-Host 'On your phone, open that HTTPS address with /index.html at the end.'
        Write-Host 'Only the App folder is served. The app still requires your normal sign-in.'
        Write-Host 'The computer must stay awake. The temporary URL may change next time.'
        Write-Host ''
        if ($Cloudflare) {
            $cloudflaredCommand = Get-Command cloudflared -ErrorAction SilentlyContinue
            $cloudflaredPath = if ($cloudflaredCommand) { $cloudflaredCommand.Source } else { Join-Path $env:USERPROFILE 'Downloads\cloudflared.exe' }
            if (-not (Test-Path -LiteralPath $cloudflaredPath -PathType Leaf)) {
                throw 'Download the Windows 64-bit cloudflared executable from Cloudflare and save it as Downloads\cloudflared.exe.'
            }
            Write-Host 'This temporary Cloudflare address is public while the tunnel runs; stop it with Ctrl+C when finished.' -ForegroundColor Yellow
            & $cloudflaredPath tunnel --url "http://127.0.0.1:$Port"
            if ($LASTEXITCODE -ne 0) { throw 'The Cloudflare phone connection ended or could not be established.' }
        } else {
            $ssh = (Get-Command ssh -ErrorAction Stop).Source
            Write-Host 'First connection: SSH may ask you to trust localhost.run.'
            # No credentials, firewall changes, or production deployment are needed.
            & $ssh -T -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -R "80:127.0.0.1:$Port" nokey@localhost.run
            if ($LASTEXITCODE -ne 0) { throw 'The temporary phone connection ended or could not be established.' }
        }
    } else {
        Start-Process $localUrl
        Read-Host 'Press Enter when you have finished testing'
    }
} catch {
    Write-Host ("Unable to run the test: " + $_.Exception.Message) -ForegroundColor Red
} finally {
    if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id }
}
