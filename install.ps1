param([string]$GameFolder,[string]$Destination,[switch]$CheckOnly,[switch]$NoShortcut)
$ErrorActionPreference = 'Stop'
trap {
    Write-Host ''
    Write-Host ('Installation stopped: '+$_.Exception.Message) -ForegroundColor Yellow
    Write-Host 'The original game was not changed.'
    if($Destination) { Write-Host ('Any incomplete separate copy is at: '+$Destination) }
    exit 1
}
$utf8 = New-Object System.Text.UTF8Encoding($false)
$mod = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'mod.json') -Raw | ConvertFrom-Json
function Get-Sha256([byte[]]$Bytes) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($sha.ComputeHash($Bytes)).Replace('-','').ToLowerInvariant() }
    finally { $sha.Dispose() }
}
function Read-Exactly($Stream,[byte[]]$Buffer,[int]$Count) {
    $done = 0
    while($done -lt $Count) {
        $read = $Stream.Read($Buffer,$done,$Count-$done)
        if($read -eq 0) { throw 'The game archive ended unexpectedly.' }
        $done += $read
    }
}
function Get-AsarFiles($Node,[string]$Prefix,$List) {
    foreach($property in $Node.files.PSObject.Properties) {
        $name = if($Prefix) { $Prefix + '/' + $property.Name } else { $property.Name }
        $entry = $property.Value
        if($entry.PSObject.Properties['files']) { Get-AsarFiles $entry $name $List }
        else {
            $oldOffset = if($entry.PSObject.Properties['offset']) { [long]$entry.offset } else { 0 }
            [void]$List.Add([pscustomobject]@{Path=$name;Entry=$entry;OldOffset=$oldOffset})
        }
    }
}
function Copy-Runtime([string]$From,[string]$To) {
    [void][IO.Directory]::CreateDirectory($To)
    foreach($item in Get-ChildItem -LiteralPath $From -Force) {
        if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Linked installation files are not supported.' }
        $next = Join-Path $To $item.Name
        if($item.PSIsContainer) { Copy-Runtime $item.FullName $next }
        elseif($item.FullName -ne $script:sourceArchive) { [IO.File]::Copy($item.FullName,$next,$false) }
    }
}
if(-not $GameFolder) {
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = 'Select the folder containing Geoplanetical.exe'
    $dialog.ShowNewFolderButton = $false
    if($dialog.ShowDialog() -ne [Windows.Forms.DialogResult]::OK) { Write-Host 'Installation cancelled.'; exit 0 }
    $GameFolder = $dialog.SelectedPath
}
$GameFolder = [IO.Path]::GetFullPath($GameFolder).TrimEnd('\','/')
$sourceArchive = Join-Path $GameFolder 'resources\app.asar'
$sourceExe = Join-Path $GameFolder 'Geoplanetical.exe'
if(-not (Test-Path -LiteralPath $sourceExe) -or -not (Test-Path -LiteralPath $sourceArchive)) { throw 'Choose the folder containing Geoplanetical.exe and its resources folder.' }
Write-Host 'Checking compatibility. The original game will not be changed.'
$source = [IO.File]::Open($sourceArchive,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite)
try {
    $prefix = New-Object byte[] 16
    Read-Exactly $source $prefix 16
    $oldDataOffset = [long]8 + [BitConverter]::ToUInt32($prefix,4)
    $jsonBytes = New-Object byte[] ([BitConverter]::ToUInt32($prefix,12))
    Read-Exactly $source $jsonBytes $jsonBytes.Length
    $oldHeaderHash = Get-Sha256 $jsonBytes
    $header = $utf8.GetString($jsonBytes) | ConvertFrom-Json
    $all = New-Object 'System.Collections.Generic.List[object]'
    Get-AsarFiles $header '' $all
    $app = @($all | Where-Object Path -eq 'renderer/app.bundle.js')
    if($app.Count -ne 1) { throw 'The expected graphics bundle was not found.' }
    [void]$source.Seek(($oldDataOffset + $app[0].OldOffset),[IO.SeekOrigin]::Begin)
    $originalBytes = New-Object byte[] ([int]$app[0].Entry.size)
    Read-Exactly $source $originalBytes $originalBytes.Length
    if((Get-Sha256 $originalBytes) -ne $mod.originalBundleSha256) {
        throw 'This game build is not supported by this mod release. No files were changed. A matching mod release is needed for a different game update.'
    }
    $moduleBytes = [IO.File]::ReadAllBytes((Join-Path $PSScriptRoot 'lightweight.js'))
    if((Get-Sha256 $moduleBytes) -ne $mod.moduleSha256) { throw 'The mod files do not match their release manifest.' }
    $bundle = $utf8.GetString($originalBytes)
    foreach($patch in $mod.patches) {
        $first = $bundle.IndexOf([string]$patch.find,[StringComparison]::Ordinal)
        if($first -lt 0 -or $first -ne $bundle.LastIndexOf([string]$patch.find,[StringComparison]::Ordinal)) { throw 'A required integration point was not unique. No files were changed.' }
        $bundle = $bundle.Replace([string]$patch.find,[string]$patch.replace)
    }
    $replacement = $utf8.GetBytes($utf8.GetString($moduleBytes) + [char]10 + $bundle)
    if((Get-Sha256 $replacement) -ne $mod.modifiedBundleSha256) { throw 'The patched graphics bundle did not pass verification.' }
    if($CheckOnly) {
        [pscustomobject]@{Compatible=$true;ModVersion=$mod.modVersion;OriginalGameUnchanged=$true;BundleSha256=$mod.modifiedBundleSha256}
        return
    }
    if(-not $Destination) { $Destination = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Geoplanetical-Lightweight' }
    $Destination = [IO.Path]::GetFullPath($Destination).TrimEnd('\','/')
    if($Destination.Equals($GameFolder,[StringComparison]::OrdinalIgnoreCase) -or $Destination.StartsWith($GameFolder+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) {
        throw 'Choose a separate destination outside the original game folder.'
    }
    if((Test-Path -LiteralPath $Destination) -and @(Get-ChildItem -LiteralPath $Destination -Force).Count -gt 0) {
        throw 'The destination already contains files. Choose a new empty folder; existing installations are never overwritten.'
    }
    Write-Host 'Creating a separate lightweight copy. This needs about 4 GB of free space.'
    Copy-Runtime $GameFolder $Destination
    $packed = @($all | Where-Object {-not ($_.Entry.PSObject.Properties['unpacked'] -and $_.Entry.unpacked) -and -not $_.Entry.PSObject.Properties['link']} | Sort-Object OldOffset)
    $offset = [long]0
    foreach($item in $packed) {
        $entry = $item.Entry
        $entry.offset = $offset.ToString([Globalization.CultureInfo]::InvariantCulture)
        if($item.Path -eq 'renderer/app.bundle.js') {
            $entry.size = $replacement.Length
            $blockSize = [int]$entry.integrity.blockSize
            $blocks = New-Object 'System.Collections.Generic.List[string]'
            for($start=0;$start -lt $replacement.Length;$start+=$blockSize) {
                $count = [Math]::Min($blockSize,$replacement.Length-$start)
                $part = New-Object byte[] $count
                [Array]::Copy($replacement,$start,$part,0,$count)
                [void]$blocks.Add((Get-Sha256 $part))
            }
            $entry.integrity = [pscustomobject]@{algorithm='SHA256';hash=(Get-Sha256 $replacement);blockSize=$blockSize;blocks=@($blocks.ToArray())}
        }
        $offset += [long]$entry.size
    }
    $newJson = $utf8.GetBytes(($header | ConvertTo-Json -Depth 100 -Compress))
    $headerLength = 8 + [int]([Math]::Ceiling($newJson.Length / 4.0)*4)
    $newHeader = New-Object byte[] $headerLength
    [BitConverter]::GetBytes([uint32]($headerLength-4)).CopyTo($newHeader,0)
    [BitConverter]::GetBytes([uint32]$newJson.Length).CopyTo($newHeader,4)
    $newJson.CopyTo($newHeader,8)
    $sizeHeader = New-Object byte[] 8
    [BitConverter]::GetBytes([uint32]4).CopyTo($sizeHeader,0)
    [BitConverter]::GetBytes([uint32]$headerLength).CopyTo($sizeHeader,4)
    $destinationArchive = Join-Path $Destination 'resources\app.asar'
    $temp = $destinationArchive + '.building'
    $output = [IO.File]::Open($temp,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try {
        $output.Write($sizeHeader,0,$sizeHeader.Length)
        $output.Write($newHeader,0,$newHeader.Length)
        $buffer = New-Object byte[] (8*1024*1024)
        $copied = [long]0
        $nextNotice = [long]1000000000
        foreach($item in $packed) {
            if($item.Path -eq 'renderer/app.bundle.js') { $output.Write($replacement,0,$replacement.Length); $copied += $replacement.Length }
            else {
                [void]$source.Seek(($oldDataOffset+$item.OldOffset),[IO.SeekOrigin]::Begin)
                $remaining = [long]$item.Entry.size
                while($remaining -gt 0) {
                    $count = [int][Math]::Min([long]$buffer.Length,$remaining)
                    Read-Exactly $source $buffer $count
                    $output.Write($buffer,0,$count)
                    $remaining -= $count
                    $copied += $count
                }
            }
            if($copied -ge $nextNotice) { Write-Host ('Copied '+[Math]::Round($copied/1GB,1)+' GB...'); $nextNotice += 1000000000 }
        }
        $output.Flush($true)
    } finally { $output.Dispose() }
    [IO.File]::Move($temp,$destinationArchive)
    Write-Host 'Updating the copied package record. Integrity checking stays enabled.'
    $exeBytes = [IO.File]::ReadAllBytes($sourceExe)
    $exeText = [Text.Encoding]::ASCII.GetString($exeBytes)
    $at = $exeText.IndexOf($oldHeaderHash,[StringComparison]::Ordinal)
    if($at -lt 60 -or $at -ne $exeText.LastIndexOf($oldHeaderHash,[StringComparison]::Ordinal) -or -not $exeText.Substring($at-60,60).Contains('"value":"')) {
        throw 'The expected package record was not found. The original game is unchanged.'
    }
    $newHeaderHash = Get-Sha256 $newJson
    [Text.Encoding]::ASCII.GetBytes($newHeaderHash).CopyTo($exeBytes,$at)
    [IO.File]::WriteAllBytes((Join-Path $Destination 'Geoplanetical.exe'),$exeBytes)
    $exeText = $null
    $installed = [pscustomobject]@{Mod=$mod.name;Version=$mod.modVersion;Source=$GameFolder;Destination=$Destination;OriginalBundleSha256=$mod.originalBundleSha256;ModifiedBundleSha256=$mod.modifiedBundleSha256;HeaderSha256=$newHeaderHash;SimulationFilesChanged=@();CreatedAt=[DateTime]::UtcNow.ToString('o')}
    [IO.File]::WriteAllText((Join-Path $Destination 'Lightweight-mod.json'),($installed|ConvertTo-Json -Depth 10),$utf8)
    $launchCode = '$r=Get-Process -Name Geoplanetical -ErrorAction SilentlyContinue; if($r){Add-Type -AssemblyName System.Windows.Forms; [void][System.Windows.Forms.MessageBox]::Show(''Please save and close Geoplanetical before switching editions.'',''Geoplanetical Lightweight''); exit}; Start-Process -FilePath (Join-Path $env:GEO_LITE_DIR ''Geoplanetical.exe'') -WorkingDirectory $env:GEO_LITE_DIR'
    $quote = [char]34
    $launcherRows = @('@echo off','setlocal DisableDelayedExpansion','set "GEO_LITE_DIR=%~dp0"',('powershell.exe -NoProfile -WindowStyle Hidden -Command '+$quote+$launchCode+$quote))
    $launcher = ($launcherRows -join ([string][char]13+[char]10)) + [char]13 + [char]10
    [IO.File]::WriteAllText((Join-Path $Destination 'Play Lightweight.cmd'),$launcher,$utf8)
    [IO.File]::Copy((Join-Path $PSScriptRoot 'README.txt'),(Join-Path $Destination 'README-Lightweight.txt'),$false)
    if(-not $NoShortcut) {
        $shortcutPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Geoplanetical Lightweight.lnk'
        if(Test-Path -LiteralPath $shortcutPath) { $shortcutPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Geoplanetical Lightweight Mod.lnk' }
        if(-not (Test-Path -LiteralPath $shortcutPath)) {
            $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcutPath)
            $shortcut.TargetPath = Join-Path $Destination 'Play Lightweight.cmd'
            $shortcut.WorkingDirectory = $Destination
            $shortcut.IconLocation = (Join-Path $Destination 'Geoplanetical.exe')+',0'
            $shortcut.WindowStyle = 7
            $shortcut.Description = 'Lightweight graphics and browsing during calculations. Original game retained.'
            $shortcut.Save()
        }
    }
    Write-Host ''
    Write-Host 'Installed. Save and close the current game before using the new launcher.'
    Write-Host 'Graphics switch: Ctrl+Alt+L, or Settings > Graphics.'
    Write-Host 'Browse during calculations has its own switch in Graphics settings.'
    Write-Host ('Installed folder: '+$Destination)
    $installed
} finally { $source.Dispose() }
