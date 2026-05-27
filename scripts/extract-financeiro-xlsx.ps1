Add-Type -AssemblyName System.IO.Compression.FileSystem

$files = @(
  @{ Path = "C:\Users\aa\Downloads\despesas compressor garimpo.xlsx"; Nome = "Despesas Compressor Garimpo"; Mode = "SignedValue" },
  @{ Path = "C:\Users\aa\Downloads\entrada e saida xinguara.xlsx"; Nome = "Entrada e Saida Xinguara"; Mode = "EntradaSaida" },
  @{ Path = "C:\Users\aa\Downloads\deposito cooperativa e legep.xlsx"; Nome = "Deposito Cooperativa e Legep"; Mode = "Deposito" },
  @{ Path = "C:\Users\aa\Downloads\despesa cooperativa e legep.xlsx"; Nome = "Despesa Cooperativa e Legep"; Mode = "EntradaSaida" },
  @{ Path = "C:\Users\aa\Downloads\despesa comprensor 070 celeste.xlsx"; Nome = "Despesa Compressor 070 Celeste"; Mode = "OnlySaida" },
  @{ Path = "C:\Users\aa\Downloads\despesa comprensor 080 celeste.xlsx"; Nome = "Despesa Compressor 080 Celeste"; Mode = "OnlySaida" },
  @{ Path = "C:\Users\aa\Downloads\dispesas diversas celeste.xlsx"; Nome = "Despesas Diversas Celeste"; Mode = "OnlySaida" }
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
  if ($cell.t -eq "s" -and $null -ne $cell.v) {
    return $shared[[int]$cell.v]
  }

  if ($cell.t -eq "inlineStr") {
    return (($cell.is.t | ForEach-Object { $_."#text" }) -join "")
  }

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

function Convert-Money($value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return $null }
  $clean = ([string]$value).Trim().Replace("R$", "").Replace(" ", "")
  if ($clean.Contains(",") -and $clean.Contains(".")) {
    $clean = $clean.Replace(".", "").Replace(",", ".")
  } elseif ($clean.Contains(",")) {
    $clean = $clean.Replace(",", ".")
  }

  $number = 0.0
  if ([double]::TryParse($clean, [Globalization.NumberStyles]::Any, [Globalization.CultureInfo]::InvariantCulture, [ref]$number)) {
    return [decimal]$number
  }
  return $null
}

function Get-Rows($file) {
  $zip = [System.IO.Compression.ZipFile]::OpenRead($file)
  $shared = Get-SharedStrings $zip
  $entry = $zip.GetEntry("xl/worksheets/sheet1.xml")
  $reader = [System.IO.StreamReader]::new($entry.Open())
  [xml]$sheet = $reader.ReadToEnd()
  $reader.Close()

  $ns = [System.Xml.XmlNamespaceManager]::new($sheet.NameTable)
  $ns.AddNamespace("d", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")

  $rows = @()
  foreach ($row in $sheet.SelectNodes("//d:sheetData/d:row", $ns)) {
    $values = @()
    foreach ($cell in $row.SelectNodes("d:c", $ns)) {
      $values += (Get-CellValue $cell $shared)
    }
    $rows += ,$values
  }

  $zip.Dispose()
  return $rows
}

$planilhas = @()

foreach ($file in $files) {
  $rows = Get-Rows $file.Path
  $lancamentos = @()
  $ultimaData = $null

  foreach ($row in ($rows | Select-Object -Skip 2)) {
    if ($row.Count -lt 2) { continue }

    $data = Convert-ExcelDate $row[0]
    if ($null -ne $data) { $ultimaData = $data }

    $item = if ($row.Count -gt 1) { ([string]$row[1]).Trim() } else { "" }
    $qtd = if ($row.Count -gt 2) { ([string]$row[2]).Trim() } else { "" }

    if ($file.Mode -eq "Deposito") {
      $valor = Convert-Money $row[1]
      if ($null -eq $valor) { continue }
      $lancamentos += [pscustomobject]@{ date = $ultimaData; item = "Deposito"; quantity = ""; type = "ENTRADA"; value = [math]::Abs($valor) }
      continue
    }

    if ($file.Mode -eq "EntradaSaida") {
      $saida = if ($row.Count -gt 3) { Convert-Money $row[3] } else { $null }
      $entrada = if ($row.Count -gt 4) { Convert-Money $row[4] } else { $null }

      if ($null -ne $saida) {
        $lancamentos += [pscustomobject]@{ date = $ultimaData; item = $item; quantity = $qtd; type = "SAIDA"; value = [math]::Abs($saida) }
      }
      if ($null -ne $entrada) {
        $entryItem = if ([string]::IsNullOrWhiteSpace($item)) { "Entrada" } else { $item }
        $lancamentos += [pscustomobject]@{ date = $ultimaData; item = $entryItem; quantity = $qtd; type = "ENTRADA"; value = [math]::Abs($entrada) }
      }
      continue
    }

    $valor = if ($row.Count -gt 3) { Convert-Money $row[3] } else { $null }
    if ($null -eq $valor -or [string]::IsNullOrWhiteSpace($item)) { continue }

    $tipo = if ($file.Mode -eq "OnlySaida") { "SAIDA" } elseif ($valor -lt 0) { "SAIDA" } else { "ENTRADA" }
    $lancamentos += [pscustomobject]@{ date = $ultimaData; item = $item; quantity = $qtd; type = $tipo; value = [math]::Abs($valor) }
  }

  $planilhas += [pscustomobject]@{
    name = $file.Nome
    purpose = $file.Nome
    description = "Planilha financeira cadastrada a partir do controle da empresa."
    entries = $lancamentos
  }
}

$out = Join-Path (Get-Location) "scripts\financeiro-import.json"
$planilhas | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $out -Encoding UTF8
Write-Output "Arquivo gerado: $out"
