try {
    $res = Invoke-RestMethod -Uri "https://health-products.canada.ca/api/drug/drugproduct/?din=00406716&lang=en&type=json" -Method Get
    Write-Output "COUNT: $($res.Count)"
    foreach ($item in $res) {
        Write-Output "BRAND: $($item.brand_name)"
        Write-Output "DIN: $($item.drug_identification_number)"
        Write-Output "COMPANY: $($item.company_name)"
    }
} catch {
    Write-Output "DPD ERROR: $($_.Exception.Message)"
}
