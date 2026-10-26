param([string]$Version = '4.0.0')

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$feed = Join-Path $repo 'artifacts'
$packagePath = Join-Path $feed "DoubleJay.Epi.ConfigurableColorPicker.$Version.nupkg"
if (!(Test-Path -LiteralPath $packagePath)) { throw "Build the package into $feed first." }

Add-Type -AssemblyName System.IO.Compression.FileSystem
$packageArchive = [IO.Compression.ZipFile]::OpenRead($packagePath)
try {
    $libraries = @($packageArchive.Entries | Where-Object { $_.FullName -like 'lib/*/*.dll' })
    if ($libraries.Count -ne 1 -or $libraries[0].FullName -ne 'lib/net10.0/DoubleJay.Epi.ConfigurableColorPicker.dll') {
        throw 'The package must contain only the .NET 10 library.'
    }
} finally { $packageArchive.Dispose() }

# A fresh directory and package cache prevent an earlier local package masking changes.
$work = Join-Path $feed ("package-verification-" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $work | Out-Null
$packageXml = [System.Security.SecurityElement]::Escape($feed)
$cacheXml = [System.Security.SecurityElement]::Escape((Join-Path $env:USERPROFILE '.nuget/packages'))
@"
<configuration>
  <packageSources>
    <clear />
    <add key="local" value="$packageXml" />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
    <add key="Optimizely" value="https://nuget.optimizely.com/feed/packages.svc" />
  </packageSources>
  <fallbackPackageFolders><add key="cached-dependencies" value="$cacheXml" /></fallbackPackageFolders>
</configuration>
"@ | Set-Content -LiteralPath (Join-Path $work 'NuGet.Config')

@"
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup>
  <ItemGroup><PackageReference Include="DoubleJay.Epi.ConfigurableColorPicker" Version="[$Version]" /></ItemGroup>
</Project>
"@ | Set-Content -LiteralPath (Join-Path $work 'Consumer.csproj')
@'
using DoubleJay.Epi.ConfigurableColorPicker;
using Microsoft.AspNetCore.Builder;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddConfigurableColorPicker();
var app = builder.Build();
app.Run();
'@ | Set-Content -LiteralPath (Join-Path $work 'Program.cs')

$project = Join-Path $work 'Consumer.csproj'
dotnet restore $project --configfile (Join-Path $work 'NuGet.Config') --packages (Join-Path $work 'packages') --verbosity minimal
if ($LASTEXITCODE) { throw 'Consumer restore failed.' }
dotnet publish $project -c Release --no-restore -o (Join-Path $work 'publish') --verbosity minimal
if ($LASTEXITCODE) { throw 'Consumer build/publish failed.' }

$module = 'modules/_protected/DoubleJay.Epi.ConfigurableColorPicker/DoubleJay.Epi.ConfigurableColorPicker.zip'
$sourceZip = Join-Path $repo 'DoubleJay.Epi.ConfigurableColorPicker/DoubleJay.Epi.ConfigurableColorPicker.zip'
foreach ($location in @($work, (Join-Path $work 'bin/Release/net10.0'), (Join-Path $work 'publish'))) {
    $path = Join-Path $location $module
    if (!(Test-Path -LiteralPath $path)) { throw "Module missing: $path" }
    if ((Get-FileHash -LiteralPath $path).Hash -ne (Get-FileHash -LiteralPath $sourceZip).Hash) {
        throw "Module does not match the current build: $path"
    }
}

$archive = [IO.Compression.ZipFile]::OpenRead((Join-Path (Join-Path $work 'publish') $module))
try {
    $configEntry = $archive.GetEntry('module.config')
    if (!$configEntry) { throw 'Module configuration missing from ZIP.' }
    $reader = [IO.StreamReader]::new($configEntry.Open())
    try { [xml]$config = $reader.ReadToEnd() } finally { $reader.Dispose() }
    if ($config.module.clientResourceRelativePath -ne $Version) { throw 'Incorrect module resource version.' }
    if ($config.module.dojo) { throw 'Legacy client registration found.' }
    $script = $archive.GetEntry("$Version/ClientResources/Scripts/ColorPalette.js")
    if (!$script) { throw 'Versioned ES module missing from ZIP.' }
    $reader = [IO.StreamReader]::new($script.Open())
    try { $javascript = $reader.ReadToEnd() } finally { $reader.Dispose() }
    if ($javascript -notmatch 'export default function') { throw 'Client resource is not an ES module.' }
} finally { $archive.Dispose() }

Write-Host "Package installation, build, publish, and versioned ES module checks passed. Output: $work"
