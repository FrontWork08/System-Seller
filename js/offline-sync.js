(function () {
  "use strict";
  var S = window.SS;
  if (!S || !window.indexedDB) return;

  var DB_NAME = "system-seller-offline";
  var STORE = "mutations";
  var ALLOWED = ["quote_create", "order_create", "production_update", "order_notes"];

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c === "x" ? r : (r & 3 | 8);
      return v.toString(16);
    });
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "mutation_id" });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  async function all() {
    var db = await openDb();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, "readonly");
      var req = tx.objectStore(STORE).getAll();
      req.onsuccess = function () { resolve(req.result || []); };
      req.onerror = function () { reject(req.error); };
    });
  }

  async function put(item) {
    var db = await openDb();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(item);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
  }

  async function remove(id) {
    var db = await openDb();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
  }

  function updateBadge(count) {
    var el = document.getElementById("offlineBadge");
    if (!el) {
      el = document.createElement("div");
      el.id = "offlineBadge";
      el.className = "offline-badge";
      document.body.appendChild(el);
    }
    var offline = !navigator.onLine;
    el.textContent = offline ? "Offline · " + count + " pendência(s)" : (count ? count + " alteração(ões) aguardando sincronização" : "");
    el.classList.toggle("show", offline || count > 0);
  }

  S.queueOfflineMutation = async function (type, payload, baseUpdatedAt) {
    if (ALLOWED.indexOf(type) === -1) throw new Error("Esta operação exige conexão com a internet.");
    if (!S.state.session || !S.state.orgId) throw new Error("Sessão inválida para fila offline.");
    var item = {
      mutation_id: uuid(),
      organization_id: S.state.orgId,
      user_id: S.state.session.user.id,
      mutation_type: type,
      payload: payload || {},
      base_updated_at: baseUpdatedAt || null,
      client_created_at: new Date().toISOString(),
      status: "pending"
    };
    await put(item);
    updateBadge((await all()).length);
    return item;
  };

  S.syncOfflineMutations = async function () {
    if (!navigator.onLine || !S.state.session) return { applied: 0, conflicts: 0 };
    var rows = await all();
    var applied = 0, conflicts = 0;
    for (var i = 0; i < rows.length; i++) {
      var item = rows[i];
      if (item.organization_id !== S.state.orgId || item.user_id !== S.state.session.user.id) continue;
      var res = await S.sb.rpc("apply_offline_mutation", {
        p_organization_id: item.organization_id,
        p_mutation_id: item.mutation_id,
        p_type: item.mutation_type,
        p_payload: item.payload,
        p_base_updated_at: item.base_updated_at,
        p_client_created_at: item.client_created_at
      });
      if (res.error) {
        if (/offline mutation type is not allowed/i.test(res.error.message || "")) await remove(item.mutation_id);
        continue;
      }
      if (res.data && res.data.status === "conflict") conflicts++;
      else applied++;
      await remove(item.mutation_id);
    }
    updateBadge((await all()).length);
    if (applied || conflicts) {
      S.toast("Sincronização: " + applied + " aplicada(s)" + (conflicts ? " · " + conflicts + " conflito(s)" : "") + ".", conflicts ? "error" : "ok");
    }
    return { applied: applied, conflicts: conflicts };
  };

  S.offlineMutationAllowed = function (type) { return ALLOWED.indexOf(type) !== -1; };
  window.addEventListener("online", function () { S.syncOfflineMutations().catch(function () {}); });
  window.addEventListener("offline", async function () { updateBadge((await all()).length); });
  setTimeout(function () { S.syncOfflineMutations().catch(function () {}); }, 1800);
})();
