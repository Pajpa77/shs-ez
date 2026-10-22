$destDir = "$PSScriptRoot\..\backups"
if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
}
$destZip = "$destDir\shs-ez_v7.1.0_backup_2026-10-23.zip"
if (Test-Path $destZip) {
    Remove-Item $destZip -Force
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$archive = [System.IO.Compression.ZipFile]::Open($destZip, [System.IO.Compression.ZipArchiveMode]::Create)
$basePath = (Resolve-Path "$PSScriptRoot\..").Path

$includeDirs = @("src", "public", "scripts")
$includeFiles = @(
    "package.json", "package-lock.json", "tsconfig.json", "tsconfig.node.json", 
    "vite.config.ts", "capacitor.config.ts", "index.html", "tailwind.config.js", 
    "postcss.config.js", "firebase.json", "firestore.rules", "firestore.indexes.json", 
    "AGENTS.md", "README.md"
)

foreach ($f in $includeFiles) {
    $filePath = Join-Path $basePath $f
    if (Test-Path $filePath) {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $filePath, $f) | Out-Null
    }
}

foreach ($d in $includeDirs) {
    $dirPath = Join-Path $basePath $d
    if (Test-Path $dirPath) {
        Get-ChildItem -Path $dirPath -Recurse -File | ForEach-Object {
            $rel = $_.FullName.Substring($basePath.Length + 1)
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $rel) | Out-Null
        }
    }
}

$androidPath = Join-Path $basePath "android"
if (Test-Path $androidPath) {
    Get-ChildItem -Path $androidPath -Recurse -File | Where-Object {
        $_.FullName -notmatch '[\\/](\.gradle|build|\.idea|captures)[\\/]'
    } | ForEach-Object {
        $rel = $_.FullName.Substring($basePath.Length + 1)
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $rel) | Out-Null
    }
}

$archive.Dispose()
Write-Host "Backup created successfully!"
Get-Item $destZip | Select-Object Name, Length
