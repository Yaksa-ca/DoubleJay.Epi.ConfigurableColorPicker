import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import colorPalette from "../DoubleJay.Epi.ConfigurableColorPicker/ClientResources/Scripts/ColorPalette.js";

const colors = [
    { id: 1, name: "Primary", value: "#000000" },
    { id: 2, name: "Secondary", value: "#ffffff" },
    { id: 3, name: "Accent", value: "red" }
];

function create(initialValue = null, settings = {}, readOnly = false) {
    const dom = new JSDOM("<div id='editor'></div>");
    const container = dom.window.document.getElementById("editor");
    const changes = [];
    const editor = colorPalette(container, initialValue, value => changes.push(value), { colors, ...settings }, readOnly);
    editor.render();
    return { dom, container, changes, editor,
        radios: () => [...container.querySelectorAll("[role=radio]")],
        clear: () => container.querySelector("button:not([role])") };
}

test("initial render selects by ID without saving; identical CSS colors remain distinct", () => {
    const context = create({ id: 2 }, { colors: [colors[0], { ...colors[1], value: colors[0].value }] });
    assert.equal(context.radios()[1].getAttribute("aria-checked"), "true");
    assert.equal(context.radios()[1].tabIndex, 0);
    assert.deepEqual(context.changes, []);
    context.radios()[0].click();
    assert.deepEqual(context.changes, [colors[0]]);
});

test("selection emits the full color object once; clear emits null", () => {
    const context = create();
    assert.equal(context.clear().disabled, true);
    context.radios()[2].click();
    context.radios()[2].click();
    assert.deepEqual(context.changes, [colors[2]]);
    context.clear().click();
    assert.deepEqual(context.changes, [colors[2], null]);
    assert.ok(context.radios().every(button => button.getAttribute("aria-checked") === "false"));
});

test("undo/redo updates selection and clear state without saving back", () => {
    const context = create(colors[0]);
    context.editor.updateValue({ id: 3 });
    assert.equal(context.radios()[2].getAttribute("aria-checked"), "true");
    context.editor.updateValue(null);
    assert.equal(context.clear().disabled, true);
    context.editor.updateValue({ id: 999 });
    assert.ok(context.radios().every(button => button.getAttribute("aria-checked") === "false"));
    assert.equal(context.clear().disabled, false);
    assert.deepEqual(context.changes, []);
});

test("read-only mode blocks clicks, clearing, and keyboard changes", () => {
    const context = create(colors[0], {}, true);
    assert.ok(context.radios().every(button => button.disabled));
    assert.equal(context.clear().disabled, true);
    context.radios()[1].click();
    context.radios()[0].dispatchEvent(new context.dom.window.KeyboardEvent("keydown", { key: "ArrowRight" }));
    context.clear().click();
    assert.deepEqual(context.changes, []);
});

test("arrow keys, Home and End move focus and selection across partial rows", () => {
    const context = create(colors[0], { maxColumns: 2 });
    const press = (index, key) => context.radios()[index].dispatchEvent(
        new context.dom.window.KeyboardEvent("keydown", { key, cancelable: true }));
    press(0, "ArrowLeft");
    assert.equal(context.dom.window.document.activeElement, context.radios()[2]);
    press(2, "ArrowUp");
    press(0, "ArrowRight");
    press(1, "ArrowDown");
    press(2, "Home");
    press(0, "End");
    assert.deepEqual(context.changes.map(color => color.id), [3, 1, 2, 3, 1, 3]);
});

test("optional clear button, invalid columns, and empty palette are supported", () => {
    const context = create(null, { maxColumns: 0, showClearButton: false });
    assert.equal(context.clear(), null);
    assert.equal(context.container.querySelector("[role=radiogroup]").style.gridTemplateColumns, "repeat(3, 28px)");
    const empty = create(null, { colors: [] });
    assert.equal(empty.radios().length, 0);
    assert.equal(empty.clear().disabled, true);
});

test("labels are text, and CSS values cannot inject markup", () => {
    const name = '<img src=x onerror="alert(1)">';
    const context = create(null, { colors: [{ id: 1, name, value: 'red; background-image:url("bad")' }] });
    assert.equal(context.radios()[0].getAttribute("aria-label"), name);
    assert.equal(context.container.querySelector("img"), null);
    assert.equal(context.radios()[0].style.backgroundImage, "");
});

test("destroy removes DOM and listeners; rerender does not duplicate content or callbacks", () => {
    const context = create();
    const detached = context.radios()[1];
    context.editor.destroy();
    assert.equal(context.container.children.length, 0);
    detached.click();
    assert.deepEqual(context.changes, []);
    context.editor.updateValue(colors[0]);
    context.editor.render();
    context.editor.render();
    assert.equal(context.container.children.length, 1);
    context.radios()[2].click();
    assert.deepEqual(context.changes, [colors[2]]);
});
