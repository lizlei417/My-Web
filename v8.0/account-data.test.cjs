const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(__dirname + '/account-data.js', 'utf8');
const user = { id: 'alice' };
const active = 'user:alice:homeStickyNotes:v1';
const archive = 'user:alice:homeStickyNoteArchive:v1';
const pendingKey = key => `portal:sticky-pending:${key}`;
const notes = (text, extra = {}) => JSON.stringify([{ id: 'note1', text, x: 100, ...extra }]);

function server() {
  return { rows: new Map(), writes: 0, offline: false, beforeWrite: null };
}
function seed(db, value, key = 'home.sticky.active') {
  db.rows.set(`alice/${key}`, { user_id: 'alice', data_key: key, value_text: value, updated_at: '2026-10-19T00:00:00.000Z' });
}
async function device(db, initial = {}) {
  class Storage {
    constructor() { this.values = new Map(Object.entries(initial)); }
    getItem(key) { return this.values.get(String(key)) ?? null; }
    setItem(key, value) { this.values.set(String(key), String(value)); }
    removeItem(key) { this.values.delete(String(key)); }
  }
  class Query {
    constructor() { this.filters = []; this.operation = 'select'; }
    select() { return this; }
    eq(key, value) { this.filters.push([key, value]); return this; }
    update(value) { this.operation = 'update'; this.value = value; return this; }
    upsert(value, options) { this.operation = 'upsert'; this.value = value; this.options = options; return this; }
    delete() { this.operation = 'delete'; return this; }
    async then(resolve, reject) {
      try {
        if (db.offline) return resolve({ error: new Error('offline') });
        if (this.operation !== 'select' && db.beforeWrite) await db.beforeWrite(this);
        let data = [...db.rows.values()].filter(row => this.filters.every(([key, value]) => row[key] === value));
        if (this.operation === 'select' && db.afterRead) await db.afterRead(this);
        if (this.operation === 'update') {
          data = data.map(row => ({ ...row, ...this.value }));
          for (const row of data) { db.rows.set(`${row.user_id}/${row.data_key}`, row); db.writes++; }
        } else if (this.operation === 'upsert') {
          data = [];
          for (const row of Array.isArray(this.value) ? this.value : [this.value]) {
            const key = `${row.user_id}/${row.data_key}`;
            if (this.options?.ignoreDuplicates && db.rows.has(key)) continue;
            db.rows.set(key, { ...row }); db.writes++; data.push(row);
          }
        }
        resolve({ data: structuredClone(data), error: null });
      } catch (error) { reject(error); }
    }
  }
  const events = new EventTarget();
  const document = new EventTarget();
  document.currentScript = { src: 'https://example.com/v8.0/account-data.js' };
  document.visibilityState = 'visible';
  const localStorage = new Storage();
  const timers = new Map();
  let timerId = 0;
  const statuses = [];
  const restored = [];
  const client = { from: () => new Query(), auth: {
    getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => {}
  } };
  const window = { location: { href: 'https://example.com/' }, localStorage,
    SUPABASE_CONFIG: { url: 'mock', anonKey: 'mock' }, supabase: { createClient: () => client },
    dispatchEvent: events.dispatchEvent.bind(events), addEventListener: events.addEventListener.bind(events) };
  events.addEventListener('portal:account-data-status', e => statuses.push(e.detail));
  events.addEventListener('portal:account-data-restored', e => restored.push(e.detail));
  vm.runInNewContext(source, { window, document, Storage, localStorage, CustomEvent, URL, console,
    setTimeout: fn => { timers.set(++timerId, fn); return timerId; },
    clearTimeout: id => timers.delete(id), setInterval: () => 0 });
  const api = window.PortalAccountData;
  await api.ready();
  return { api, storage: localStorage, statuses, restored, events,
    login: () => api.useUser(user), refresh: () => api.refreshSticky(),
    saved: () => JSON.parse(db.rows.get('alice/home.sticky.active').value_text),
    async timers() { const jobs = [...timers.values()]; timers.clear(); for (const job of jobs) await job(); await api.refreshSticky(); } };
}

test('38 → 46 syncs to another computer, stale login never writes 38 back', async () => {
  const db = server(); seed(db, notes('38'));
  const a = await device(db, { [active]: notes('38') }); await a.login();
  const b = await device(db, { [active]: notes('38') }); await b.login();
  b.storage.setItem(active, notes('46')); await b.refresh();
  await a.api.useUser(null); await a.login();
  assert.equal(JSON.parse(a.storage.getItem(active))[0].text, '46');
  await b.refresh(); assert.equal(b.saved()[0].text, '46');
});

test('pending edit survives logout and reload, and retries after network recovery', async () => {
  const db = server(); seed(db, notes('38'));
  const a = await device(db); await a.login(); db.offline = true;
  a.storage.setItem(active, notes('46')); await a.refresh();
  assert.ok(a.storage.getItem(pendingKey(active)));
  await a.api.useUser(null);
  const b = await device(db, Object.fromEntries(a.storage.values));
  db.offline = false; await b.login();
  assert.equal(b.saved()[0].text, '46'); assert.equal(b.storage.getItem(pendingKey(active)), null);
});

test('unchanged cache writes and refreshes do not upload old content', async () => {
  const db = server(); seed(db, notes('46'));
  const a = await device(db, { [active]: notes('38') });
  a.storage.setItem(active, notes('38')); assert.equal(a.storage.getItem(pendingKey(active)), null);
  await a.login(); await a.refresh(); assert.equal(db.writes, 0);
  assert.equal(JSON.parse(a.storage.getItem(active))[0].text, '46');
});

test('layout edits from a stale device preserve newer remote text', async () => {
  const db = server(); seed(db, notes('38'));
  const a = await device(db); await a.login();
  const b = await device(db); await b.login();
  b.storage.setItem(active, notes('46')); await b.refresh();
  a.storage.setItem(active, notes('38', { x: 200 })); await a.refresh();
  assert.deepEqual(a.saved()[0], { id: 'note1', text: '46', x: 200 });
});

test('compare-and-swap retries a real write collision and merges different fields', async () => {
  const db = server(); seed(db, notes('38'));
  const a = await device(db); await a.login();
  const b = await device(db); await b.login();
  a.storage.setItem(active, notes('46'));
  b.storage.setItem(active, notes('38', { x: 300 }));
  db.beforeWrite = async () => { db.beforeWrite = null; await b.refresh(); };
  await a.refresh();
  assert.deepEqual(a.saved()[0], { id: 'note1', text: '46', x: 300 });
});

test('editing during an upload retains and uploads the newest input', async () => {
  const db = server(); seed(db, notes('38'));
  const a = await device(db); await a.login(); a.storage.setItem(active, notes('46'));
  db.beforeWrite = async () => { db.beforeWrite = null; a.storage.setItem(active, notes('47')); };
  await a.refresh(); assert.equal(a.saved()[0].text, '47');
  assert.equal(a.storage.getItem(pendingKey(active)), null);
});

test('missing cloud row imports edited local notes instead of dropping them', async () => {
  const db = server(); const a = await device(db, { [active]: notes('38') });
  a.storage.setItem(active, notes('46')); await a.login(); assert.equal(a.saved()[0].text, '46');
});

test('remote deletion is not resurrected by stale geometry; archive data syncs too', async () => {
  const db = server(); seed(db, notes('38'));
  const a = await device(db); await a.login();
  const b = await device(db); await b.login();
  b.storage.setItem(archive, notes('38')); b.storage.setItem(active, '[]'); await b.refresh();
  a.storage.setItem(active, notes('38', { x: 250 })); await a.refresh();
  assert.deepEqual(a.saved(), []); assert.equal(JSON.parse(a.storage.getItem(archive))[0].text, '38');
});

test('account switch does not upload another account pending data', async () => {
  const db = server(); seed(db, notes('38')); const a = await device(db); await a.login();
  a.storage.setItem(active, notes('46')); await a.api.useUser({ id: 'bob' }); await a.refresh();
  assert.equal(a.saved()[0].text, '38'); assert.ok(a.storage.getItem(pendingKey(active)));
  assert.ok(![...db.rows.keys()].some(key => key.startsWith('bob/')));
  await a.login(); assert.equal(a.saved()[0].text, '46');
});

test('focus and online trigger remote refresh without a fresh login', async () => {
  const db = server(); seed(db, notes('38')); const a = await device(db); await a.login();
  seed(db, notes('46')); a.events.dispatchEvent(new Event('focus')); await a.refresh();
  assert.equal(JSON.parse(a.storage.getItem(active))[0].text, '46');
  assert.ok(a.restored.some(detail => detail.keys.includes(active)));
  seed(db, notes('47')); a.events.dispatchEvent(new Event('online')); await a.refresh();
  assert.equal(JSON.parse(a.storage.getItem(active))[0].text, '47');
});

test('first upgrade keeps a recovery copy of differing legacy local notes', async () => {
  const db = server(); seed(db, notes('38'));
  const a = await device(db, { [active]: notes('46') }); await a.login();
  const backup = JSON.parse(a.storage.getItem(`portal:sticky-recovery:${active}`));
  assert.equal(JSON.parse(backup.value)[0].text, '46');
});

test('a delayed old poll cannot roll back an acknowledged edit in a sibling frame', async () => {
  const db = server(); seed(db, notes('38'));
  const a = await device(db); await a.login();
  const b = await device(db); await b.login();
  // Parent shell and home iframe share localStorage but have separate requests.
  b.storage.values = a.storage.values;
  db.afterRead = async () => {
    db.afterRead = null;
    b.storage.setItem(active, notes('46')); await b.refresh();
  };
  await a.refresh();
  assert.equal(JSON.parse(a.storage.getItem(active))[0].text, '46');
});

test('a widget layout save uses its own baseline when a storage event is delayed', async () => {
  const db = server(); seed(db, notes('38'));
  const a = await device(db); await a.login();
  const base = a.storage.getItem(active);
  seed(db, notes('46')); await a.refresh();
  a.api.writeStickyNotes(active, notes('38', { x: 400 }), base);
  await a.refresh();
  assert.deepEqual(a.saved()[0], { id: 'note1', text: '46', x: 400 });
});

test('explicit confirmation reports cloud failure and success truthfully', async () => {
  const db = server(); seed(db, notes('38'));
  const a = await device(db); await a.login();
  a.storage.setItem(active, notes('46')); db.offline = true;
  assert.equal(await a.refresh(), false);
  assert.ok(a.storage.getItem(pendingKey(active)));
  db.offline = false;
  assert.equal(await a.refresh(), true);
  assert.equal(a.saved()[0].text, '46');
});
