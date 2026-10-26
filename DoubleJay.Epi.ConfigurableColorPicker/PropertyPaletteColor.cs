using System;
using DoubleJay.Epi.ConfigurableColorPicker.Manager;
using DoubleJay.Epi.ConfigurableColorPicker.Models;
using EPiServer.Core;
using EPiServer.DataAnnotations;
using EPiServer.ServiceLocation;

namespace DoubleJay.Epi.ConfigurableColorPicker
{
    [PropertyDefinitionType]
    public class PropertyPaletteColor : PropertyNumber
    {
        public override object Value
        {
            // PropertyData is created by CMS rather than the DI container. Resolve at access
            // time so the color follows the current application's palette, even on cached content.
            get => !Number.HasValue ? null : ServiceLocator.Current.GetInstance<IColorPaletteManager>().GetColor(Number.Value, PropertyDefinitionID);
            set => base.Value = (value as IColor)?.Id ?? value;
        }

        public override Type PropertyValueType => typeof(Color);

        public override object SaveData() => Number;
    }
}
