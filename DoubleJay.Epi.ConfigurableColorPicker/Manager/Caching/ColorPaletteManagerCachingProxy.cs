using System;
using System.Collections.Generic;
using DoubleJay.Epi.ConfigurableColorPicker.Models;
using EPiServer.DataAbstraction;
using EPiServer.DataAbstraction.RuntimeModel;
using EPiServer.Applications;
using EPiServer.Framework.Cache;
using EPiServer.ServiceLocation;

namespace DoubleJay.Epi.ConfigurableColorPicker.Manager.Caching
{
    public class ColorPaletteManagerCachingProxy : ColorPaletteManager
    {
        private readonly IObjectInstanceCache _objectInstanceCache;

        private readonly TimeSpan _cachingTimeSpan = TimeSpan.FromHours(12);

        public ColorPaletteManagerCachingProxy(
            IPropertyDefinitionRepository propertyDefinitionRepository, IContentTypeRepository contentTypeRepository,
            IContentTypeModelRepository contentTypeModelRepository, IObjectInstanceCache objectInstanceCache,
            IApplicationResolver applicationResolver) : base(
            propertyDefinitionRepository, contentTypeRepository, contentTypeModelRepository, applicationResolver)
        {
            _objectInstanceCache = objectInstanceCache;
        }

        public override IColor GetColor(int id, int propertyDefinitionId)
        {
            // Palette selection depends on the current application. Cache the palette
            // definitions only; caching a resolved color leaks values between sites.
            return base.GetColor(id, propertyDefinitionId);
        }

        public override ICollection<IColorPalette> GetPalettes()
        {
            var cacheKey = $"{nameof(ColorPaletteManager)}:{nameof(GetPalettes)}";

            if (_objectInstanceCache.TryGet(cacheKey, ReadStrategy.Immediate, out ICollection<IColorPalette> palettes))
            {
                return palettes;
            }

            palettes = base.GetPalettes();

            _objectInstanceCache.Insert(cacheKey, palettes, new CacheEvictionPolicy(_cachingTimeSpan, CacheTimeoutType.Absolute));

            return palettes;
        }

    }
}
