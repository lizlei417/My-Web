(() => {
  if (window.PortalAccountData) return;

  const TABLE_NAME = "portal_user_data";
  const currentScriptUrl = document.currentScript?.src || new URL("account-data.js", window.location.href).href;
  const portalRoot = new URL("./", currentScriptUrl);
  const rememberedUserAtBoot = (() => {
    try {
      return localStorage.getItem("portalCurrentUserId") || "";
    } catch {
      return "";
    }
  })();

  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  const mappingsByLocalKey = new Map();
  const saveTimers = new Map();
  const subscribers = new Set();
  let client = null;
  let currentUser = null;
  let lastReadyUserId = "";
  let syncVersion = 0;
  let dependencyPromise = null;
  let bootPromise = null;

  const loadScript = (src) => new Promise((resolve) => {
    const absolute = new URL(src, portalRoot).href;
    const existing = [...document.scripts].find((script) => script.src === absolute);
    if (existing) {
      if (existing.dataset.loaded === "true" || (src.includes("supabase-js") && window.supabase)) {
        resolve(true);
        return;
      }
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = absolute;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve(true);
    }, { once: true });
    script.addEventListener("error", () => resolve(false), { once: true });
    document.head.appendChild(script);
  });

  const ensureDependencies = () => {
    if (dependencyPromise) return dependencyPromise;
    dependencyPromise = (async () => {
      if (!window.SUPABASE_CONFIG) await loadScript("supabase-config.js");
      if (!window.supabase) await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
      const config = window.SUPABASE_CONFIG || {};
      if (!window.supabase || !config.url || !config.anonKey) return null;
      client = window.__portalAccountDataClient
        || window.supabase.createClient(config.url, config.anonKey);
      window.__portalAccountDataClient = client;
      return client;
    })();
    return dependencyPromise;
  };

  const mappingsFor = (userId) => [
    { cloudKey: "theme", localKey: "theme", legacy: true },
    { cloudKey: "home.avatar", localKey: `user:${userId}:avatarImage`, scoped: true },
    { cloudKey: "home.username", localKey: `user:${userId}:username`, scoped: true },
    { cloudKey: "home.signature", localKey: `user:${userId}:signature`, scoped: true },
    { cloudKey: "home.bubbles", localKey: `user:${userId}:bubbles`, scoped: true },
    { cloudKey: "home.money.records", localKey: `user:${userId}:homeMoneyLedger:v1`, scoped: true },
    { cloudKey: "home.money.visible", localKey: `user:${userId}:homeMoneyLedgerVisible:v1`, scoped: true },
    { cloudKey: "bookkeeping.state", localKey: `user:${userId}:bookkeepingLedger:v1`, scoped: true },
    { cloudKey: "home.sticky.active", localKey: `user:${userId}:homeStickyNotes:v1`, scoped: true },
    { cloudKey: "home.sticky.archive", localKey: `user:${userId}:homeStickyNoteArchive:v1`, scoped: true },
    { cloudKey: "collect.cards", localKey: `user:${userId}:portalCollectCards`, scoped: true, legacyKey: "portalCollectCards" },
    { cloudKey: "habitat.records", localKey: `user:${userId}:habitat_records_v2`, scoped: true, legacyKey: "habitat_records_v2" },
    { cloudKey: "shell.nav.order", localKey: `portalNavOrder:${userId}`, scoped: true, legacyKey: "portalNavOrder" },
    { cloudKey: "shell.nav.hidden", localKey: `portalHiddenComponents:${userId}`, scoped: true },
    { cloudKey: "music.player.state", localKey: `user:${userId}:portalMusicPlayerState`, scoped: true, legacyKey: "portalMusicPlayerState" }
  ];

  const notify = (detail) => {
    window.dispatchEvent(new CustomEvent("portal:account-data-status", { detail }));
    subscribers.forEach((callback) => {
      try {
        callback(detail);
      } catch {}
    });
  };

  const queueSave = (mapping, value) => {
    if (!client || !currentUser || currentUser.isGuest) return;
    clearTimeout(saveTimers.get(mapping.cloudKey));
    const userId = currentUser.id;
    saveTimers.set(mapping.cloudKey, setTimeout(async () => {
      saveTimers.delete(mapping.cloudKey);
      if (!client || currentUser?.id !== userId) return;
      const { error } = await client.from(TABLE_NAME).upsert({
        user_id: userId,
        data_key: mapping.cloudKey,
        value_text: String(value),
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id,data_key" });
      if (error) {
        console.error(`账号数据保存失败：${mapping.cloudKey}`, error);
        notify({ state: "error", operation: "save", key: mapping.cloudKey, error });
      }
    }, 320));
  };

  const queueRemove = (mapping) => {
    if (!client || !currentUser || currentUser.isGuest) return;
    clearTimeout(saveTimers.get(mapping.cloudKey));
    const userId = currentUser.id;
    saveTimers.set(mapping.cloudKey, setTimeout(async () => {
      saveTimers.delete(mapping.cloudKey);
      if (!client || currentUser?.id !== userId) return;
      const { error } = await client
        .from(TABLE_NAME)
        .delete()
        .eq("user_id", userId)
        .eq("data_key", mapping.cloudKey);
      if (error) {
        console.error(`账号数据删除失败：${mapping.cloudKey}`, error);
        notify({ state: "error", operation: "remove", key: mapping.cloudKey, error });
      }
    }, 320));
  };

  Storage.prototype.setItem = function portalAccountSetItem(key, value) {
    originalSetItem.call(this, key, value);
    if (this !== window.localStorage) return;
    const mapping = mappingsByLocalKey.get(String(key));
    if (mapping) queueSave(mapping, value);
  };

  Storage.prototype.removeItem = function portalAccountRemoveItem(key) {
    originalRemoveItem.call(this, key);
    if (this !== window.localStorage) return;
    const mapping = mappingsByLocalKey.get(String(key));
    if (mapping) queueRemove(mapping);
  };

  const canMigrateLegacy = (userId) => (
    !rememberedUserAtBoot
    || rememberedUserAtBoot === userId
    || rememberedUserAtBoot === "guest"
  );

  const syncForUser = async (user) => {
    const version = ++syncVersion;
    if (!user?.id || user.isGuest) {
      currentUser = user || null;
      lastReadyUserId = "";
      mappingsByLocalKey.clear();
      notify({ state: "local", user: currentUser });
      return;
    }
    if (lastReadyUserId === user.id && currentUser?.id === user.id) return;

    const activeClient = await ensureDependencies();
    if (!activeClient || version !== syncVersion) return;
    currentUser = user;
    const localIdentityChanged = localStorage.getItem("portalCurrentUserId") !== user.id;
    originalSetItem.call(localStorage, "portalCurrentUserId", user.id);
    if (user.email) originalSetItem.call(localStorage, "portalCurrentUserEmail", user.email);
    const mappings = mappingsFor(user.id);
    mappingsByLocalKey.clear();
    mappings.forEach((mapping) => {
      mappingsByLocalKey.set(mapping.localKey, mapping);
      if (mapping.legacyKey) mappingsByLocalKey.set(mapping.legacyKey, mapping);
    });
    notify({ state: "syncing", user });

    const { data, error } = await activeClient
      .from(TABLE_NAME)
      .select("data_key,value_text")
      .eq("user_id", user.id);
    if (version !== syncVersion) return;
    if (error) {
      console.error("账号数据同步不可用，请先运行 account-data-setup.sql。", error);
      notify({ state: "error", operation: "load", error, user });
      return;
    }

    const cloudRows = new Map((data || []).map((row) => [row.data_key, row.value_text]));
    const migrations = [];
    const migratedLegacyKeys = [];
    const changedLocalKeys = localIdentityChanged ? ["portalCurrentUserId"] : [];

    mappings.forEach((mapping) => {
      if (cloudRows.has(mapping.cloudKey)) {
        const cloudValue = cloudRows.get(mapping.cloudKey);
        const localValue = localStorage.getItem(mapping.localKey);
        if (localValue !== cloudValue) {
          originalSetItem.call(localStorage, mapping.localKey, cloudValue);
          changedLocalKeys.push(mapping.localKey);
        }
        return;
      }

      let localValue = localStorage.getItem(mapping.localKey);
      if (localValue === null && mapping.legacyKey && canMigrateLegacy(user.id)) {
        localValue = localStorage.getItem(mapping.legacyKey);
        if (localValue !== null) {
          originalSetItem.call(localStorage, mapping.localKey, localValue);
          migratedLegacyKeys.push(mapping.legacyKey);
          changedLocalKeys.push(mapping.localKey);
        }
      }
      const safeToMigrate = mapping.scoped || canMigrateLegacy(user.id);
      if (localValue !== null && safeToMigrate) {
        migrations.push({
          user_id: user.id,
          data_key: mapping.cloudKey,
          value_text: localValue,
          updated_at: new Date().toISOString()
        });
      }
    });

    if (migrations.length) {
      const { error: migrationError } = await activeClient
        .from(TABLE_NAME)
        .upsert(migrations, { onConflict: "user_id,data_key" });
      if (version !== syncVersion) return;
      if (migrationError) {
        console.error("迁移现有浏览器数据失败", migrationError);
        notify({ state: "error", operation: "migrate", error: migrationError, user });
        return;
      }
      migratedLegacyKeys.forEach((key) => originalRemoveItem.call(localStorage, key));
    }

    if (version !== syncVersion) return;
    lastReadyUserId = user.id;
    notify({
      state: "ready",
      user,
      restoredKeys: changedLocalKeys,
      migratedKeys: migrations.map((row) => row.data_key)
    });
    window.dispatchEvent(new CustomEvent("portal:account-data-restored", {
      detail: { user, keys: changedLocalKeys }
    }));
  };

  const boot = () => {
    if (bootPromise) return bootPromise;
    bootPromise = (async () => {
      const activeClient = await ensureDependencies();
      if (!activeClient) {
        notify({ state: "unconfigured" });
        return null;
      }
      const { data } = await activeClient.auth.getSession();
      await syncForUser(data?.session?.user || null);
      activeClient.auth.onAuthStateChange((_event, session) => {
        syncForUser(session?.user || null);
      });
      return currentUser;
    })();
    return bootPromise;
  };

  window.PortalAccountData = {
    ready: boot,
    useUser: syncForUser,
    getUser: () => currentUser,
    subscribe(callback) {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    }
  };

  boot();
})();
