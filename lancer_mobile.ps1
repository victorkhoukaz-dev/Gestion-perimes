# Lancer le serveur local d'abord s'il n'est pas déjà lancé
$serverPort = 8001
Write-Host "Création d'un lien HTTPS sécurisé pour tester sur votre cellulaire..." -ForegroundColor Green

# Lancer la connexion SSH sécurisée vers localhost.run
$processInfo = New-Object System.Diagnostics.ProcessStartInfo
$processInfo.FileName = "ssh"
$processInfo.Arguments = "-o StrictHostKeyChecking=no -R 80:localhost:$serverPort nokey@localhost.run"
$processInfo.RedirectStandardOutput = $true
$processInfo.RedirectStandardError = $true
$processInfo.UseShellExecute = $false
$processInfo.CreateNoWindow = $true

$process = [System.Diagnostics.Process]::Start($processInfo)

Start-Sleep -Seconds 3

while (-not $process.StandardOutput.EndOfStream) {
    $line = $process.StandardOutput.ReadLine()
    if ($line -like "*https://*") {
        $url = [regex]::Match($line, "https://[a-zA-Z0-9\-\.]+\.lhrt\.dev").Value
        if ($url) {
            Write-Host "`n========================================================" -ForegroundColor Cyan
            Write-Host "  VOTRE LIEN CELLULAIRE ÉTAPE 1 (HTTPS SÉCURISÉ) :" -ForegroundColor Yellow
            Write-Host "  $url/App/index.html" -ForegroundColor Green
            Write-Host "========================================================`n" -ForegroundColor Cyan
            break
        }
    }
}
