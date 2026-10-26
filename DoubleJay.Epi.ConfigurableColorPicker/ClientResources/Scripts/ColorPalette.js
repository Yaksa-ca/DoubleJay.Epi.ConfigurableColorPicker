// Optimizely CMS 13 ES module property editor.
export default function colorPalette(editorContainer, initialValue, onEditorValueChange, widgetSettings = {}, readOnly = false) {
    const document = editorContainer.ownerDocument;
    const colors = Array.isArray(widgetSettings.colors) ? widgetSettings.colors : [];
    const configuredColumns = Number(widgetSettings.maxColumns);
    const columns = Number.isInteger(configuredColumns) && configuredColumns > 0 ? configuredColumns : 4;
    let value = initialValue;
    let root;
    let buttons = [];
    let clearButton;
    let controller;

    const refresh = () => {
        const selected = colors.findIndex(color => color.id === value?.id);
        buttons.forEach((button, index) => {
            const checked = index === selected;
            button.setAttribute("aria-checked", String(checked));
            button.tabIndex = index === (selected < 0 ? 0 : selected) ? 0 : -1;
            button.style.boxShadow = checked ? "0 0 0 2px white, 0 0 0 4px #333" : "none";
            button.textContent = checked ? "✓" : "";
        });
        if (clearButton) clearButton.disabled = readOnly || value == null;
    };

    const select = color => {
        if (readOnly || (color == null ? value == null : color.id === value?.id)) return;
        value = color;
        refresh();
        onEditorValueChange(color);
    };

    const destroy = () => {
        controller?.abort();
        root?.remove();
        root = undefined;
        buttons = [];
        clearButton = undefined;
    };

    return {
        render() {
            destroy();
            controller = new document.defaultView.AbortController();
            const options = { signal: controller.signal };
            root = document.createElement("div");
            root.className = "configurable-color-picker";
            const palette = document.createElement("div");
            palette.setAttribute("role", "radiogroup");
            palette.setAttribute("aria-label", "Color palette");
            palette.setAttribute("aria-readonly", String(readOnly));
            Object.assign(palette.style, {
                display: "grid",
                gridTemplateColumns: `repeat(${Math.min(columns, colors.length || 1)}, 28px)`,
                gap: "8px", padding: "6px", width: "max-content"
            });

            buttons = colors.map((color, index) => {
                const button = document.createElement("button");
                button.type = "button";
                button.setAttribute("role", "radio");
                const label = color.name || color.value || String(color.id);
                button.setAttribute("aria-label", label);
                button.title = label;
                button.disabled = readOnly;
                Object.assign(button.style, {
                    width: "28px", height: "28px", border: "1px solid #767676",
                    borderRadius: "3px", padding: "0", cursor: readOnly ? "default" : "pointer",
                    backgroundColor: color.value,
                    // A two-tone check remains visible over light and dark swatches.
                    color: "white", textShadow: "0 0 2px black, 0 0 2px black", fontSize: "20px"
                });
                button.addEventListener("click", () => select(color), options);
                button.addEventListener("keydown", event => {
                    if (readOnly) return;
                    let next;
                    switch (event.key) {
                        case "ArrowRight": next = (index + 1) % colors.length; break;
                        case "ArrowLeft": next = (index - 1 + colors.length) % colors.length; break;
                        case "ArrowDown": next = Math.min(index + columns, colors.length - 1); break;
                        case "ArrowUp": next = Math.max(index - columns, 0); break;
                        case "Home": next = 0; break;
                        case "End": next = colors.length - 1; break;
                        default: return;
                    }
                    event.preventDefault();
                    select(colors[next]);
                    buttons[next].focus();
                }, options);
                palette.appendChild(button);
                return button;
            });
            root.appendChild(palette);

            if (widgetSettings.showClearButton !== false) {
                clearButton = document.createElement("button");
                clearButton.type = "button";
                clearButton.textContent = "Clear";
                clearButton.style.marginTop = "8px";
                clearButton.addEventListener("click", () => select(null), options);
                root.appendChild(clearButton);
            }
            editorContainer.appendChild(root);
            refresh();
        },
        updateValue(newValue) {
            value = newValue;
            refresh();
        },
        destroy
    };
}
