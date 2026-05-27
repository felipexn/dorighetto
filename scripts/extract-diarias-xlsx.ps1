Add-Type -AssemblyName System.IO.Compression.FileSystem

$files = @(
  @{ Path = "C:\Users\aa\Downloads\Ajudante.xlsx"; Role = "AJUDANTE" },
  @{ Path = "C:\Users\aa\Downloads\operador.xlsx"; Role = "OPERADOR" }
)

function Get-SharedStrings($zip) {
  $entry = $zip.GetEntry("xl/sharedStrings.xml")
  $strings = @()
  if ($null -eq $entry) { return $strings }
  $reader = [System.IO.StreamReader]::new($entry.Open())
  [xml]$xml = $reader.ReadToEnd()
  $reader.Close()
  $ns = [System.Xml.XmlNamespaceManager]::new($xml.NameTable)
  $ns.AddNamespace("d", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
  foreach ($si in $xml.SelectNodes("//d:si", $ns)) {
    $texts = $si.SelectNodes(".//d:t", $ns) | ForEach-Object { $_."#text" }
    $strings += ($texts -join "")
  }
  return $strings
}

function Get-CellValue($cell, $shared) {
  if ($cell.t -eq "s" -and $null -ne $cell.v) { return $shared[[int]$cell.v] }
  if ($cell.t -eq "inlineStr") { return (($cell.is.t | ForEach-Object { $_."#text" }) -join "") }
  return [string]$cell.v
}

function Convert-ExcelDate($value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return $null }
  $number = 0.0
  if (-not [double]::TryParse($value, [Globalization.NumberStyles]::Any, [Globalization.CultureInfo]::InvariantCulture, [ref]$number)) {
    return $null
  }
  return ([datetime]"1899-12-30").AddDays($number).ToString("yyyy-MM-dd")
}

function Convert-Number($value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return 0 }
  $clean = ([string]$value).Trim().Replace("R$", "").Replace(" ", "")
  if ($clean.Contains(",") -and $clean.Contains(".")) {
    $clean = $clean.Replace(".", "").Replace(",", ".")
  } elseif ($clean.Contains(",")) {
    $clean = $clean.Replace(",", ".")
  }
  $number = 0.0
  if ([double]::TryParse($clean, [Globalization.NumberStyles]::Any, [Globalization.CultureInfo]::InvariantCulture, [ref]$number)) {
    return $number
  }
  return 0
}

$entries = @()

foreach ($file in $files) {
  $zip = [System.IO.Compression.ZipFile]::OpenRead($file.Path)
  $shared = Get-SharedStrings $zip
  $entry = $zip.GetEntry("xl/worksheets/sheet1.xml")
  $reader = [System.IO.StreamReader]::new($entry.Open())
  [xml]$sheet = $reader.ReadToEnd()
  $reader.Close()
  $ns = [System.Xml.XmlNamespaceManager]::new($sheet.NameTable)
  $ns.AddNamespace("d", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")

  foreach ($row in ($sheet.SelectNodes("//d:sheetData/d:row", $ns) | Select-Object -Skip 2)) {
    $vals = @()
    foreach ($cell in $row.SelectNodes("d:c", $ns)) {
      $vals += (Get-CellValue $cell $shared)
    }

    if ($vals.Count -lt 8) { continue }
    $date = Convert-ExcelDate $vals[0]
    $employeeName = ([string]$vals[1]).Trim()
    $total = Convert-Number $vals[7]
    if ($null -eq $date -or [string]::IsNullOrWhiteSpace($employeeName) -or $total -le 0) { continue }

    $dailyValue = Convert-Number $vals[3]
    $overtimeHours = Convert-Number $vals[4]
    $overtimeRate = if ($dailyValue -gt 0) { $dailyValue / 8 } else { 0 }
    $overtimeTotal = $overtimeHours * $overtimeRate

    $entries += [pscustomobject]@{
      date = $date
      employeeName = $employeeName.ToUpper()
      role = $file.Role
      dailyValue = $dailyValue
      overtimeHours = $overtimeHours
      overtimeRate = $overtimeRate
      overtimeTotal = $overtimeTotal
      dayTotal = $dailyValue + $overtimeTotal
      notes = if ($vals.Count -gt 8) { ([string]$vals[8]).Trim() } else { "" }
    }
  }

  $zip.Dispose()
}

$out = Join-Path (Get-Location) "scripts\diarias-import.json"
$entries | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $out -Encoding UTF8
Write-Output "Arquivo gerado: $out"
