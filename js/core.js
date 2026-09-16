(function () {
  "use strict";

  var cfg = window.SYSTEM_SELLER_CONFIG;
  var sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  var S = window.SS = {
    cfg: cfg,
    sb: sb,
    app: document.getElementById("app"),
    toastEl: document.getElementById("toast"),
    state: { session: null, recovery: false, orgs: [], roles: {}, orgId: null, role: null, page: "dashboard", data: {} },
    statusLabel: { new: "Novo", picking: "Separando", packing: "Embalando", ready: "Pronto", shipped: "Enviado", delivered: "Entregue", cancelled: "Cancelado" },
    paymentLabel: { pending: "Pendente", partial: "Parcial", paid: "Pago", refunded: "Reembolsado" },
    transition: { new: "picking", picking: "packing", packing: "ready", ready: "shipped", shipped: "delivered" }
  };

  S.e = function (v) {
    return String(v == null ? "" : v).replace(/[&<>'"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c];
    });
  };

  S.money = function (v) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);
  };

  S.dt = function (v) {
    if (!v) return "—";
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: cfg.timezone }).format(new Date(v));
  };

  S.day = function (v) {
    if (!v) return "—";
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: cfg.timezone }).format(new Date(v));
  };

  S.tzParts = function (v) {
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: cfg.timezone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date(v));
    var out = {};
    parts.forEach(function (p) { if (p.type !== "literal") out[p.type] = p.value; });
    return out;
  };

  S.todayIso = function () {
    var p = S.tzParts(new Date());
    return p.year + "-" + p.month + "-" + p.day;
  };

  S.localInput = function (v) {
    if (!v) return "";
    var p = S.tzParts(v);
    return p.year + "-" + p.month + "-" + p.day + "T" + p.hour + ":" + p.minute;
  };

  S.errText = function (err) { return err && err.message ? err.message : "Ocorreu um erro inesperado."; };
  S.canAdmin = function () { return S.state.role === "owner" || S.state.role === "admin"; };
  S.canWrite = function () { return S.canAdmin() || S.state.role === "operator"; };
  S.currentOrg = function () { return S.state.orgs.find(function (o) { return o.id === S.state.orgId; }); };

  S.toast = function (message, type) {
    type = type || "ok";
    S.toastEl.textContent = message;
    S.toastEl.className = "toast show " + type;
    clearTimeout(S.toastEl._timer);
    S.toastEl._timer = setTimeout(function () { S.toastEl.className = "toast"; }, 3600);
  };

  S.busy = function (form, on) {
    var btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    btn.disabled = on;
    if (!btn.dataset.original) btn.dataset.original = btn.textContent;
    btn.textContent = on ? "Salvando…" : btn.dataset.original;
  };

  S.closeModal = function () {
    var old = document.querySelector(".modal-backdrop");
    if (old) old.remove();
  };

  S.modal = function (title, body, wide) {
    S.closeModal();
    var wrap = document.createElement("div");
    wrap.className = "modal-backdrop";
    wrap.innerHTML = '<section class="modal ' + (wide ? "wide" : "") + '" role="dialog" aria-modal="true">' +
      '<header class="modal-head"><h3>' + S.e(title) + '</h3><button class="x" data-action="close-modal" aria-label="Fechar">×</button></header>' +
      '<div class="modal-body">' + body + "</div></section>";
    document.body.appendChild(wrap);
  };

  S.badge = function (text, type) {
    return '<span class="badge ' + (type || "") + '">' + S.e(text) + "</span>";
  };

  S.statusBadge = function (status) {
    var type = status === "cancelled" ? "danger" : status === "delivered" ? "ok" : status === "shipped" ? "info" : status === "ready" ? "warn" : "";
    return S.badge(S.statusLabel[status] || status, type);
  };

  S.paymentBadge = function (status) {
    var type = status === "paid" ? "ok" : status === "refunded" ? "danger" : status === "partial" ? "warn" : "";
    return S.badge(S.paymentLabel[status] || status, type);
  };

  S.empty = function (title, text) {
    return '<div class="empty"><strong>' + S.e(title) + "</strong>" + S.e(text) + "</div>";
  };

  S.fetchAll = async function (table, columns, orderCol) {
    columns = columns || "*";
    if (orderCol === undefined) orderCol = "created_at";
    var out = [];
    var from = 0;
    var size = 1000;
    while (true) {
      var q = sb.from(table).select(columns).eq("organization_id", S.state.orgId).range(from, from + size - 1);
      if (orderCol) q = q.order(orderCol, { ascending: false });
      var res = await q;
      if (res.error) throw res.error;
      out = out.concat(res.data || []);
      if (!res.data || res.data.length < size) break;
      from += size;
    }
    return out;
  };

  S.getCore = async function () {
    var rows = await Promise.all([
      S.fetchAll("stores", "*", "name"),
      S.fetchAll("customers", "*", "name"),
      S.fetchAll("products", "*", "name")
    ]);
    S.state.data.stores = rows[0];
    S.state.data.customers = rows[1];
    S.state.data.products = rows[2];
    return { stores: rows[0], customers: rows[1], products: rows[2] };
  };

  S.navItems = function () {
    var items = [["dashboard", "▦", "Visão geral"], ["orders", "◫", "Pedidos"], ["products", "□", "Produtos"], ["customers", "◎", "Clientes"]];
    if (S.canAdmin()) items.push(["finance", "R$", "Financeiro"]);
    items.push(["stores", "⌂", "Lojas"]);
    if (S.canAdmin()) items.push(["audit", "≡", "Auditoria"]);
    return items;
  };

  S.renderShell = function () {
    var org = S.currentOrg();
    var nav = S.navItems();
    var roleLabel = S.state.role === "owner" ? "Proprietário" : S.state.role === "admin" ? "Administrador" : S.state.role === "operator" ? "Operador" : "Visualização";
    var selector = "";
    if (S.state.orgs.length > 1) {
      selector = '<select class="org-select" id="orgSelect">' + S.state.orgs.map(function (o) {
        return '<option value="' + o.id + '"' + (o.id === S.state.orgId ? " selected" : "") + ">" + S.e(o.name) + "</option>";
      }).join("") + "</select>";
    }
    S.app.innerHTML = '<div class="shell"><aside class="sidebar">' +
      '<div class="brand"><div class="brand-mark">SS</div><span>System Seller</span></div>' +
      '<nav class="nav">' + nav.map(function (item) {
        return '<button data-action="nav" data-page="' + item[0] + '" class="' + (S.state.page === item[0] ? "active" : "") + '"><b>' + item[1] + "</b><span>" + item[2] + "</span></button>";
      }).join("") + "</nav>" +
      '<div class="sidebar-foot"><div class="userbox"><strong>' + S.e(S.state.session.user.email || "Usuário") + "</strong><span>" + S.e(S.state.role || "") + '</span></div><button class="secondary" data-action="logout">Sair</button></div></aside>' +
      '<section class="main"><header class="topbar"><div class="topbar-left"><h1>' + S.e(org ? org.name : "System Seller") + "</h1><p>" + S.e(S.state.session.user.email || "") + '</p></div><div class="top-actions">' + selector + S.badge(roleLabel, "info") + '</div></header><div class="content" id="page"><div class="boot"><div class="spinner"></div><p>Carregando…</p></div></div></section></div>';
  };

  S.loadPage = async function () {
    var page = document.getElementById("page");
    if (!page) return;
    page.innerHTML = '<div class="boot"><div class="spinner"></div><p>Carregando…</p></div>';
    try {
      if (S.state.page === "dashboard") await S.pageDashboard();
      else if (S.state.page === "orders") await S.pageOrders();
      else if (S.state.page === "products") await S.pageProducts();
      else if (S.state.page === "customers") await S.pageCustomers();
      else if (S.state.page === "finance" && S.canAdmin()) await S.pageFinance();
      else if (S.state.page === "stores") await S.pageStores();
      else if (S.state.page === "audit" && S.canAdmin()) await S.pageAudit();
      else {
        S.state.page = "dashboard";
        S.renderShell();
        await S.pageDashboard();
      }
    } catch (err) {
      page.innerHTML = S.empty("Não foi possível carregar", S.errText(err));
      S.toast(S.errText(err), "error");
    }
  };
})();
