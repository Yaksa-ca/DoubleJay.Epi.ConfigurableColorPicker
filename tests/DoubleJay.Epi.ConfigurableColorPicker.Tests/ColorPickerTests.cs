using System;
using System.Collections.Generic;
using System.Linq;
using DoubleJay.Epi.ConfigurableColorPicker.Infrastructure;
using DoubleJay.Epi.ConfigurableColorPicker.Manager;
using DoubleJay.Epi.ConfigurableColorPicker.Manager.Caching;
using DoubleJay.Epi.ConfigurableColorPicker.Models;
using EPiServer.Applications;
using EPiServer.Core;
using EPiServer.Framework.Cache;
using EPiServer.ServiceLocation;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;

namespace DoubleJay.Epi.ConfigurableColorPicker.Tests;

public class ColorPickerTests
{
    [Fact]
    public void PropertyPersistsOnlyColorIdAndResolvesCurrentPalette()
    {
        var manager = new Mock<IColorPaletteManager>();
        manager.Setup(x => x.GetColor(7, It.IsAny<int>())).Returns(new Color(7, "Primary", "#123456"));
        var services = new ServiceCollection().AddSingleton(manager.Object).BuildServiceProvider();
        ServiceLocator.SetServiceProvider(services);
        try
        {
            var property = new PropertyPaletteColor { Value = new Color(7, "Old name", "#ffffff") };
            Assert.Equal(7, property.Number);
            var color = Assert.IsType<Color>(property.Value);
            Assert.Equal("#123456", color.Value);
            Assert.Equal(7, property.SaveData());
            property.Value = null;
            Assert.Null(property.Number);
            Assert.Null(property.Value);
        }
        finally
        {
            ServiceLocator.SetServiceProvider(null);
            services.Dispose();
        }
    }

    [Fact]
    public void ExistingNumericStorageAndAttributeArePreserved()
    {
        var property = new PropertyPaletteColor { Value = 42 };
        Assert.Equal(42, property.Number);
        Assert.Equal(typeof(Color), property.PropertyValueType);
        Assert.Equal("Brand", new ColorPickerAttribute("Brand").PaletteName);
    }

    [Fact]
    public void CachedManagerResolvesColorsSeparatelyForEachApplication()
    {
        var applicationResolver = new Mock<IApplicationResolver>();
        var firstApp = new InProcessWebsite("First", new ContentReference(1));
        firstApp.Hosts.Add(new ApplicationHost("first.example"));
        var secondApp = new InProcessWebsite("Second", new ContentReference(2));
        secondApp.Hosts.Add(new ApplicationHost("second.example"));
        applicationResolver.Setup(x => x.GetByContext()).Returns(firstApp);
        var manager = new TestManager(applicationResolver.Object);
        Assert.Equal("#111111", manager.GetColor(1, 0).Value);
        applicationResolver.Setup(x => x.GetByContext()).Returns(secondApp);
        Assert.Equal("#222222", manager.GetColor(1, 0).Value);
        applicationResolver.Setup(x => x.GetByContext()).Returns((Application)null);
        Assert.Equal("#333333", manager.GetColor(1, 0).Value);
    }

    private sealed class TestManager(IApplicationResolver resolver)
        : ColorPaletteManagerCachingProxy(null, null, null, Mock.Of<IObjectInstanceCache>(), resolver)
    {
        public override ICollection<IColorPalette> GetPalettes() =>
        [
            Palette("first.example", "#111111"),
            Palette("second.example", "#222222"),
            Palette(null, "#333333")
        ];

        private static IColorPalette Palette(string host, string value)
        {
            var palette = new Mock<IColorPalette>();
            palette.SetupGet(x => x.Hosts).Returns(host == null ? [] : new[] { host });
            palette.SetupGet(x => x.Colors).Returns(new IColor[] { new Color(1, "Primary", value) });
            return palette.Object;
        }
    }
}
