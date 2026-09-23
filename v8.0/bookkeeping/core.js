(() => {
  "use strict";

  const dateOnly = (dateTime) => String(dateTime || "").slice(0, 10);

  function toggleCategorySelection(selectedIds, value) {
    const selected = new Set(selectedIds || []);
    if (value === "all") selected.clear();
    else if (selected.has(value)) selected.delete(value);
    else selected.add(value);
    return [...selected];
  }

  function recordMatchesFilters(record, { type = "all", categoryIds = [] } = {}) {
    if (type !== "all" && record.type !== type) return false;
    const selected = categoryIds instanceof Set ? categoryIds : new Set(categoryIds);
    return selected.size === 0 || selected.has(record.categoryId);
  }

  function recordsInRange(records, { start, end } = {}) {
    return records.filter((record) => {
      const day = dateOnly(record.date);
      return (!start || day >= start) && (!end || day <= end);
    });
  }

  function filteredRecords(records, { start, end, type = "all", categoryIds = [] } = {}) {
    return recordsInRange(records, { start, end }).filter((record) => recordMatchesFilters(record, { type, categoryIds }));
  }

  function totalsFor(records, amountForRecord = (record) => Number(record.amountHkd || 0)) {
    return records.reduce((totals, record) => {
      totals[record.type] += amountForRecord(record);
      return totals;
    }, { expense: 0, income: 0 });
  }

  const api = { toggleCategorySelection, recordMatchesFilters, recordsInRange, filteredRecords, totalsFor };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.BookkeepingCore = api;
})();
