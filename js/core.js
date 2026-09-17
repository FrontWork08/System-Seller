(function () {
  "use strict";

  var cfg = window.SYSTEM_SELLER_CONFIG;
  var initialUrl = new URL(window.location.href);
  var authMarker = initialUrl.searchParams.get("auth");
  var inviteToken = initialUrl.searchParams.get("invite");
  var themeOptions = {
    ocean: { label: "Azul profissional", description: "Visual original com azul discreto." },
    graphite: { label: "Grafite", description: "Neutro e menos saturado para uso prolongado." },
    forest: { label: "Esmeralda", description: "Tons escuros com destaque verde." },
    amber: { label: "Âmbar", description: "Tons quentes com contraste suave." }
  };
  var savedTheme = "ocean";
  try { savedTheme = window.localStorage.getItem("systemSeller:theme") || "ocean"; } catch (e) {}
  if (!themeOptions[savedTheme]) savedTheme = "ocean";
  document.documentElement.setAttribute("data-theme", savedTheme);
  var sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  var S = window.SS = {
    cfg: cfg,
    sb: sb,
    app: document.getElementById("app"),
    toastEl: document.getElementById("toast"),
    state: { session: null, recovery: false, authMarker: authMarker, inviteToken: inviteToken, pendingEmail: null, profile: null, theme: savedTheme, orgs: [], roles: {}, orgId: null, role: null, page: "dashboard", orderQuery: { page: 0, size: 50, search: "", status: "" }, data: {} },
    statusLabel: { new: "Novo", picking: "Separando", packing: "Embalando", ready: "Pronto", shipped: "Enviado", delivered: "Entregue", cancelled: "Cancelado" },
    paymentLabel: { pending: "Pendente", partial: "Parcial", paid: "Pago", refunded: "Reembolsado" },
    transition: { new: "picking", picking: "packing", packing: "ready", ready: "shipped", shipped: "delivered" }
  };

  S.themeOptions = themeOptions;

  S.applyTheme = function (theme, persist) {
    if (!themeOptions[theme]) theme = "ocean";
    S.state.theme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    if (persist !== false) {
      try { window.localStorage.setItem("systemSeller:theme", theme); } catch (e) {}
    }
    return theme;
  };

  S.themeCards = function () {
    return Object.keys(themeOptions).map(function (key) {
      var item = themeOptions[key];
      var active = S.state.theme === key ? " selected" : "";
      return '<button type="button" class="theme-card' + active + '" data-action="set-theme" data-theme="' + key + '">' +
        '<span class="theme-preview theme-preview-' + key + '"><i></i><i></i><i></i></span>' +
        '<span><strong>' + S.e(item.label) + '</strong><small>' + S.e(item.description) + '</small></span>' +
        '<b class="theme-check">' + (active ? "✓" : "") + '</b></button>';
    }).join("");
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

  S.errText = function (err) {
    var message = err && err.message ? String(err.message) : "Ocorreu um erro inesperado.";
    var lower = message.toLowerCase();
    if (lower === "email not confirmed") return "Confirme seu e-mail antes de entrar.";
    if (lower === "invalid login credentials") return "E-mail ou senha incorretos.";
    if (lower === "user already registered") return "Já existe uma conta com este e-mail.";
    if (lower.indexOf("email rate limit exceeded") !== -1) return "Limite temporário de e-mails atingido. O serviço de e-mail do Supabase está no limite; aguarde e tente novamente mais tarde.";
    if (lower.indexOf("for security purposes") !== -1 && lower.indexOf("60 seconds") !== -1) return "Aguarde um minuto antes de solicitar outro e-mail.";
    if (lower.indexOf("insufficient role") !== -1) return "Sua permissão não permite executar esta ação.";
    if (lower.indexOf("invite not found") !== -1) return "Este convite não existe ou não está mais disponível.";
    if (lower.indexOf("invite revoked") !== -1) return "Este convite foi revogado.";
    if (lower.indexOf("invite already used") !== -1) return "Este convite já foi utilizado.";
    if (lower.indexOf("invite expired") !== -1) return "Este convite expirou. Peça um novo link ao administrador.";
    if (lower.indexOf("only the owner can") !== -1) return "Somente o proprietário da empresa pode executar esta ação.";
    return message;
  };

  S.authRedirect = function () {
    var base = cfg.productionUrl || window.location.origin;
    var url = new URL(base);
    url.pathname = "/";
    url.hash = "";
    url.search = "";
    if (S.state && S.state.inviteToken) url.searchParams.set("invite", S.state.inviteToken);
    return url.toString();
  };

  S.clearAuthMarker = function () {
    S.state.authMarker = null;
    if (window.history && window.history.replaceState) {
      var url = new URL(window.location.href);
      url.searchParams.delete("auth");
      window.history.replaceState({}, document.title, url.pathname + url.search);
    }
  };

  S.clearInviteMarker = function () {
    S.state.inviteToken = null;
    if (window.history && window.history.replaceState) {
      var url = new URL(window.location.href);
      url.searchParams.delete("invite");
      window.history.replaceState({}, document.title, url.pathname + url.search);
    }
  };
  S.canAdmin = function () { return S.state.role === "owner" || S.state.role === "admin"; };
  S.canWrite = function () { return S.canAdmin() || S.state.role === "operator"; };
  S.roleLabel = function (role) {
    return role === "owner" ? "Proprietário" : role === "admin" ? "Administrador" : role === "operator" ? "Operador" : "Visualização";
  };
  S.currentOrg = function () { return S.state.orgs.find(function (o) { return o.id === S.state.orgId; }); };

  S.profileName = function () {
    var p = S.state.profile || {};
    return String(p.full_name || "Minha conta");
  };

  S.avatarMarkup = function (className) {
    var p = S.state.profile || {};
    var name = S.profileName();
    var initial = name && name !== "Minha conta" ? name.charAt(0).toUpperCase() : "U";
    if (p.avatar_url) {
      return '<img class="' + S.e(className || "avatar-image") + '" src="' + S.e(p.avatar_url) + '" alt="Foto de perfil">';
    }
    return '<span class="' + S.e(className || "avatar-fallback") + '">' + S.e(initial) + '</span>';
  };

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
    var items = [
      ["dashboard", "▦", "Visão geral", "Operação"],
      ["orders", "◫", "Pedidos", "Operação"],
      ["products", "□", "Produtos", "Operação"],
      ["customers", "◎", "Clientes", "Operação"]
    ];
    if (S.canAdmin()) items.push(["finance", "R$", "Financeiro", "Gestão"]);
    items.push(["stores", "⌂", "Lojas", "Gestão"]);
    if (S.canAdmin()) items.push(["team", "♙", "Equipe", "Gestão"]);
    if (S.canAdmin()) items.push(["backup", "⇩", "Backup", "Gestão"]);
    if (S.canAdmin()) items.push(["audit", "≡", "Auditoria", "Gestão"]);
    items.push(["profile", "◉", "Perfil", "Conta"]);
    return items;
  };

  S.renderShell = function () {
    var org = S.currentOrg();
    var nav = S.navItems();
    var roleLabel = S.roleLabel(S.state.role);
    var selector = "";
    if (S.state.orgs.length > 1) {
      selector = '<select class="org-select" id="orgSelect">' + S.state.orgs.map(function (o) {
        return '<option value="' + o.id + '"' + (o.id === S.state.orgId ? " selected" : "") + ">" + S.e(o.name) + "</option>";
      }).join("") + "</select>";
    }

    var navHtml = "";
    var group = "";
    nav.forEach(function (item) {
      if (item[3] !== group) {
        group = item[3];
        navHtml += '<div class="nav-label">' + S.e(group) + '</div>';
      }
      navHtml += '<button data-action="nav" data-page="' + item[0] + '" class="' + (S.state.page === item[0] ? "active" : "") + '">' +
        '<b>' + item[1] + '</b><span>' + item[2] + '</span></button>';
    });

    var displayName = S.profileName();

    S.app.innerHTML = '<div class="shell"><aside class="sidebar">' +
      '<div class="brand"><div class="brand-mark">SS</div><span>System Seller</span></div>' +
      '<nav class="nav">' + navHtml + '</nav>' +
      '<div class="sidebar-foot"><button class="userbox" data-action="nav" data-page="profile">' + S.avatarMarkup("avatar-mini-img") + '<span class="userbox-copy"><strong>' + S.e(displayName) + '</strong><small>' + S.e(roleLabel) + '</small></span></button>' +
      '<button class="logout-btn" data-action="logout">↪ <span>Sair da conta</span></button></div></aside>' +
      '<button class="mobile-scrim" data-action="close-sidebar" aria-label="Fechar menu"></button>' +
      '<section class="main"><header class="topbar"><button class="mobile-menu" data-action="toggle-sidebar" aria-label="Abrir menu">☰</button>' +
      '<div class="topbar-left"><h1>' + S.e(org ? org.name : "System Seller") + '</h1><p>Área protegida da empresa</p></div>' +
      '<div class="top-actions">' + selector + S.badge(roleLabel, "info") + '<button class="profile-chip" data-action="nav" data-page="profile" aria-label="Abrir perfil">' + S.avatarMarkup("profile-chip-img") + '<b>Perfil</b></button></div>' +
      '</header><div class="content" id="page"><div class="boot"><div class="spinner"></div><p>Carregando…</p></div></div></section></div>';
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
      else if (S.state.page === "team" && S.canAdmin()) await S.pageTeam();
      else if (S.state.page === "backup" && S.canAdmin()) await S.pageBackup();
      else if (S.state.page === "audit" && S.canAdmin()) await S.pageAudit();
      else if (S.state.page === "profile") await S.pageProfile();
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
