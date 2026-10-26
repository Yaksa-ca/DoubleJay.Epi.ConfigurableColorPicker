# Configurable Color Picker for Optimizely CMS 13

A configurable palette editor for **.NET 10 only** and **Optimizely CMS 13.4.2 or later within CMS 13**. Version 4 uses a native ES module with no JavaScript framework or frontend build step.

- Configure colors, named palettes, and palettes for individual website hosts.
- Persist numeric color IDs, so changing a color's name or CSS value does not require republishing content.
- Select colors with a mouse or keyboard, clear optional values, and use CMS undo/redo.
- Respect read-only properties and clean up the editor when navigating away.

## Install

Build the package from this checkout (version 4 must be published to a feed before it can be installed from that feed):

```powershell
dotnet restore
dotnet pack DoubleJay.Epi.ConfigurableColorPicker/DoubleJay.Epi.ConfigurableColorPicker.csproj -c Release -o artifacts
```

Install into a .NET 10 CMS 13 application using the generated package directory as an additional source:

```powershell
dotnet add package DoubleJay.Epi.ConfigurableColorPicker --version 4.0.0 --source C:/path/to/this/repository/artifacts
```

Keep nuget.org and the [Optimizely feed](https://nuget.optimizely.com/feed/packages.svc) configured in the application's NuGet.Config for dependency restore. Once version 4 is published to your configured feed, the explicit local source is unnecessary.

Register the picker alongside your existing CMS registrations:

```csharp
using DoubleJay.Epi.ConfigurableColorPicker;

builder.Services.AddConfigurableColorPicker();
```

The package includes the protected module and copies it to the application's module directory during build, output copying, and publishing. No manual script copying or client module registration is needed.

## Configure palettes

Create a `ColorPalette.config` file in the web application's root:

```xml
<?xml version="1.0" encoding="utf-8"?>
<colorPalettes>
  <colorPalette id="1">
    <maxColumns>4</maxColumns>
    <showClearButton>true</showClearButton>
    <colors>
      <color id="1">
        <name>Primary</name>
        <value>#005EB8</value>
      </color>
      <color id="2">
        <name>Accent</name>
        <value>#FFB81C</value>
      </color>
    </colors>
  </colorPalette>
  <colorPalette id="2" fallback="1">
    <name>Brand</name>
    <hosts>
      <host>www.example.com</host>
    </hosts>
    <colors>
      <color id="1">
        <name>Site primary</name>
        <value>#663399</value>
      </color>
    </colors>
  </colorPalette>
</colorPalettes>
```

Ensure the configuration reaches the application's output and publish directory:

```xml
<ItemGroup>
  <None Update="ColorPalette.config" CopyToOutputDirectory="PreserveNewest" CopyToPublishDirectory="PreserveNewest" />
</ItemGroup>
```

The manager loads this file from `AppDomain.CurrentDomain.BaseDirectory`. Palette definitions are cached for 12 hours; restart the application after changing the file.

- Omit `name` for the default palette. Add `name` to use `[ColorPicker("Brand")]`.
- Host matching uses the current CMS application's canonical URL hostname. A palette without hosts is the fallback for that palette name.
- The example's `Brand` palette is available on `www.example.com`. Omit `hosts` to make a named palette available on every site.
- A `fallback` references another palette's numeric ID and inherits missing colors. Color IDs in the selected palette override inherited IDs. Keep fallback chains acyclic.
- Color IDs must be unique positive integers within each palette. Keep existing IDs when upgrading.
- `maxColumns` defaults to 4; `showClearButton` defaults to true. Set these explicitly on palettes that need a particular layout.
- A property is hidden if no matching palette exists.

## Use in content models

```csharp
using DoubleJay.Epi.ConfigurableColorPicker.Infrastructure;
using DoubleJay.Epi.ConfigurableColorPicker.Models;
using EPiServer.Core;
using EPiServer.DataAnnotations;

[ContentType(DisplayName = "Example page", GUID = "A46F263D-C8DB-4A51-89AE-4E79A30A2CC5")]
public class ExamplePage : PageData
{
    [ColorPicker]
    public virtual Color BackgroundColor { get; set; }

    [ColorPicker("Brand")]
    public virtual Color BrandColor { get; set; }
}
```

In a Razor view:

```cshtml
<div style="background-color: @(Model.CurrentPage.BackgroundColor?.Value)">
    Example
</div>
```

Configure trusted CSS color values such as hex, RGB, or named colors. The editor sends the selected color object to CMS; the backing property saves only its ID and resolves its current name and CSS value from the palette.

## Upgrade from version 3 / CMS 12

1. Upgrade the host application to .NET 10 and CMS 13.4.2 or later within CMS 13.
2. Install version 4 and keep `AddConfigurableColorPicker()`.
3. Keep existing `Color` properties, `[ColorPicker]` attributes, palette files, and color IDs. No content data conversion is required.
4. Deploy the published output, including `modules/_protected/DoubleJay.Epi.ConfigurableColorPicker` and `ColorPalette.config`, and restart the application.

The assembly name, backing property type, and numeric storage format are retained. Editor registration now resolves a versioned protected-module URL and enables CMS 13's `isJavascriptModule` option. The client implements `render`, `updateValue`, and `destroy`, following the [CMS 13 custom editor example](https://world.optimizely.com/blogs/grzegorz-wiechec/dates/2026/3/custom-property-editors-in-optimizely-cms-13/).

Custom subclasses of the palette managers must update their constructors to use `IContentTypeModelRepository` and accept `IApplicationResolver`.

## Development and verification

```powershell
dotnet test DoubleJay.Epi.ConfigurableColorPicker.sln -c Release
npm ci
npm test
dotnet pack DoubleJay.Epi.ConfigurableColorPicker/DoubleJay.Epi.ConfigurableColorPicker.csproj -c Release -o artifacts
./eng/Verify-Package.ps1
```

Node.js is needed only for the editor tests, not to build or install the NuGet package. Server tests cover numeric storage compatibility and application-specific color resolution. DOM tests cover selection, clearing, read-only mode, keyboard navigation, undo/redo updates, safe text rendering, and cleanup. The package check installs the actual NuGet into a temporary web project and verifies its built and published module assets.

Before releasing, verify the picker in a running CMS 13 site: edit and publish a color, reload it, clear it, use undo/redo, verify a read-only property, and switch between applications with different palettes. These require a configured CMS database and authenticated edit UI.

NuGet currently reports NU1902/NU1903 warnings for CMS's transitive ImageSharp 3.2.0 dependency. These remain visible; no audit warnings are suppressed. Some [upstream advisory version ranges](https://github.com/advisories/GHSA-j3p4-wp97-rph4) already list 3.2.0 as patched, so review the current NuGet audit results and vendor guidance before release.

The project retains the [MIT license](LICENSE) and original package identity from [jacobjones/DoubleJay.Epi.ConfigurableColorPicker](https://github.com/jacobjones/DoubleJay.Epi.ConfigurableColorPicker).
