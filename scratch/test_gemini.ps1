$key = "YOUR_GEMINI_API_KEY"
$url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=" + $key
# Tiny 1x1 red PNG base64
$base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

$payload = @{
    contents = @(
        @{
            parts = @(
                @{ text = "De quelle couleur est cette image? Réponds en un mot." },
                @{ inline_data = @{ mime_type = "image/png"; data = $base64 } }
            )
        }
    )
} | ConvertTo-Json -Depth 10

try {
    $res = Invoke-RestMethod -Uri $url -Method Post -ContentType "application/json" -Body $payload
    Write-Output "SUCCESS VISION:"
    Write-Output ($res.candidates[0].content.parts[0].text)
} catch {
    Write-Output "FAIL VISION: $($_.Exception.Message)"
}
