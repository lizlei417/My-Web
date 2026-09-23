"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const core = require("./core.js");

const records = [
  { id: "food-now", type: "expense", categoryId: "exp-food", amountHkd: 80, date: "2026-09-10T12:00" },
  { id: "fun-now", type: "expense", categoryId: "exp-entertain", amountHkd: 120, date: "2026-09-11T18:00" },
  { id: "salary-now", type: "income", categoryId: "inc-salary", amountHkd: 1000, date: "2026-09-12T09:00" },
  { id: "food-old", type: "expense", categoryId: "exp-food", amountHkd: 50, date: "2026-08-31T12:00" }
];

test("category selection accumulates, toggles, and resets", () => {
  let selected = core.toggleCategorySelection([], "exp-food");
  assert.deepEqual(selected, ["exp-food"]);
  selected = core.toggleCategorySelection(selected, "exp-entertain");
  assert.deepEqual(selected, ["exp-food", "exp-entertain"]);
  selected = core.toggleCategorySelection(selected, "exp-entertain");
  assert.deepEqual(selected, ["exp-food"]);
  assert.deepEqual(core.toggleCategorySelection(selected, "all"), []);
});

test("multiple categories share the active date range and sum together", () => {
  const filtered = core.filteredRecords(records, {
    start: "2026-09-01",
    end: "2026-09-30",
    categoryIds: ["exp-food", "exp-entertain"]
  });
  assert.deepEqual(filtered.map((record) => record.id), ["food-now", "fun-now"]);
  assert.deepEqual(core.totalsFor(filtered), { expense: 200, income: 0 });
});

test("an income-only category forces expense total to zero", () => {
  const filtered = core.filteredRecords(records, {
    start: "2026-09-01",
    end: "2026-09-30",
    categoryIds: ["inc-salary"]
  });
  assert.deepEqual(core.totalsFor(filtered), { expense: 0, income: 1000 });
});

test("type-only filters force the opposite total to zero", () => {
  const range = { start: "2026-09-01", end: "2026-09-30" };
  assert.deepEqual(core.totalsFor(core.filteredRecords(records, { ...range, type: "expense" })), { expense: 200, income: 0 });
  assert.deepEqual(core.totalsFor(core.filteredRecords(records, { ...range, type: "income" })), { expense: 0, income: 1000 });
});

test("theme-facing controls use portal theme variables and category filter is multiple", () => {
  const styles = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  assert.match(styles, /\.primary-button\s*\{[^}]*linear-gradient\(145deg, var\(--theme\), var\(--theme-deep\)\)/s);
  assert.match(styles, /body\s*\{[^}]*rgba\(var\(--theme-rgb\), \.13\)/s);
  assert.doesNotMatch(styles, /linear-gradient\(145deg, #8eb3eb, #6e89c8\)/);
  assert.match(html, /<select id="categoryFilter"[^>]*multiple/);
});
