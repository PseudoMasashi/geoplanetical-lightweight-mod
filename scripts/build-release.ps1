param([string]$OutputFolder)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$repoRoot = Split-Path -Parent $PSScriptRoot
if(-not $OutputFolder) { $OutputFolder = Join-Path $repoRoot 'downloads' }
[void][IO.Directory]::CreateDirectory($OutputFolder)
$manifest = Get-Content -LiteralPath (Join-Path $repoRoot 'mod.json') -Raw | ConvertFrom-Json
$sourceHash = (Get-FileHash -LiteralPath (Join-Path $repoRoot 'lightweight.js') -Algorithm SHA256).Hash.ToLowerInvariant()
if($sourceHash -ne $manifest.moduleSha256) { throw 'The adapter does not match its release manifest.' }
$monthEndHash = (Get-FileHash -LiteralPath (Join-Path $repoRoot 'month-end.js') -Algorithm SHA256).Hash.ToLowerInvariant()
if($monthEndHash -ne $manifest.monthEndModuleSha256) { throw 'The month-end module does not match its release manifest.' }
$archiveName = 'Geoplanetical-Lightweight-Mod-' + $manifest.modVersion + '.zip'
$archivePath = Join-Path $OutputFolder $archiveName
$files = @('Install.cmd','LICENSE','NOTICE','README.md','README.txt','install.ps1','lightweight.js','month-end.js','mod.json','scripts/inspect-economy.cjs')
$file = [IO.File]::Open($archivePath,[IO.FileMode]::Create,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
try {
    $archive = New-Object IO.Compression.ZipArchive($file,[IO.Compression.ZipArchiveMode]::Create,$true)
    try {
        foreach($name in $files) {
            $entry = $archive.CreateEntry($name,[IO.Compression.CompressionLevel]::Optimal)
            $entry.LastWriteTime = [DateTimeOffset]::Parse('2026-10-31T00:00:00Z')
            $inputFile = [IO.File]::OpenRead((Join-Path $repoRoot $name))
            $entryStream = $entry.Open()
            try { $inputFile.CopyTo($entryStream) }
            finally { $entryStream.Dispose(); $inputFile.Dispose() }
        }
    } finally { $archive.Dispose() }
} finally { $file.Dispose() }
$digest = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
$utf8 = New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $OutputFolder 'SHA256SUMS.txt'),($digest + '  ' + $archiveName + [char]10),$utf8)
Write-Output $archivePath
Write-Output ('SHA256: ' + $digest)
