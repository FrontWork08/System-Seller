(function () {
  "use strict";
  var S = window.SS;

  S.pageDashboard = async function () {
    var rows = await Promise.all([
      S.sb.from("orders").select("id,external_id,status,payment_status,due_at,total,created_at").eq("organization_id", S.state.orgId).order("created_at", { ascending: false }).limit(20),
      S.sb.from("products").select("id,name,sku,stock,min_stock,active").eq("organization_id", S.state.orgId).eq("active", true).order("stock").limit(200),
      S.sb.from("customers").select("id", { count: "exact", head: true }).eq("organization_id", S.state.orgId)
    ]);
    if (rows[0].error) throw rows[0].error;
    if (rows[1].error) throw rows[1].error;
    if (rows[2].error) throw rows[2].error;

    var orders = rows[0].data || [];
    var products = rows[1].data || [];
    var customersCount = rows[2].count || 0;
    var finance = [];

    if (S.canAdmin()) {
      var first = S.todayIso().slice(0, 7) + "-01";
      var f = await S.sb.from("financial_transactions").select("kind,amount,status,occurred_on").eq("organization_id", S.state.orgId).gte("occurred_on", first).neq("status", "cancelled");
      if (f.error) throw f.error;
      finance = f.data || [];
    }

    var open = orders.filter(function (o) { return ["delivered", "cancelled"].indexOf(o.status) === -1; }).length;
    var low = products.filter(function (p) { return p.stock <= p.min_stock; }).length;
    var revenue = finance.filter(function (x) { return x.kind === "income" && x.status === "paid"; }).reduce(function (a, x) { return a + Number(x.amount); }, 0);
    var expenses = finance.filter(function (x) { return x.kind === "expense" && x.status === "paid"; }).reduce(function (a, x) { return a + Number(x.amount); }, 0);
    var now = Date.now();
    var overdue = orders.filter(function (o) {
      return o.due_at && new Date(o.due_at).getTime() < now && ["shipped", "delivered", "cancelled"].indexOf(o.status) === -1;
    }).length;

    var recent = orders.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Pedido</th><th>Status</th><th>Pagamento</th><th>Prazo</th><th>Total</th></tr></thead><tbody>' +
      orders.map(function (o) {
        var late = o.due_at && new Date(o.due_at) < new Date() && ["shipped", "delivered", "cancelled"].indexOf(o.status) === -1;
        return '<tr><td><button class="link-btn" data-action="view-order" data-id="' + o.id + '">' + S.e(o.external_id || o.id.slice(0, 8)) + '</button></td><td>' + S.statusBadge(o.status) + '</td><td>' + S.paymentBadge(o.payment_status) + '</td><td class="' + (late ? "overdue" : "") + '">' + S.dt(o.due_at) + '</td><td>' + S.money(o.total) + "</td></tr>";
      }).join("") + "</tbody></table></div>" : S.empty("Nenhum pedido", "Cadastre o primeiro pedido para iniciar a operação.");

    var attention = products.filter(function (x) { return x.stock <= x.min_stock; }).slice(0, 8);
    var lowList = attention.length ? attention.map(function (x) {
      return '<div class="list-item"><div><strong>' + S.e(x.name) + '</strong><div class="meta">' + S.e(x.sku) + '</div></div><div class="low">' + x.stock + " un.</div></div>";
    }).join("") : '<div class="muted">Nenhum produto abaixo do estoque mínimo.</div>';

    document.getElementById("page").innerHTML =
      '<div class="page-head"><div><h2>Visão geral</h2><p>Acompanhe o que precisa de atenção agora.</p></div><div class="actions">' +
      (S.canWrite() ? '<button class="primary" data-action="new-order">+ Novo pedido</button>' : "") + "</div></div>" +
      '<div class="cards"><div class="card"><div class="k">Pedidos recentes em aberto</div><div class="v">' + open + '</div><div class="s">' + (overdue ? overdue + " com prazo vencido" : "Nenhum prazo vencido nos recentes") + '</div></div>' +
      '<div class="card"><div class="k">Estoque baixo</div><div class="v">' + low + '</div><div class="s">Produtos no mínimo ou abaixo</div></div>' +
      '<div class="card"><div class="k">Clientes</div><div class="v">' + customersCount + '</div><div class="s">Cadastros da empresa</div></div>' +
      '<div class="card"><div class="k">' + (S.canAdmin() ? "Resultado do mês" : "Seu acesso") + '</div><div class="v">' + (S.canAdmin() ? S.money(revenue - expenses) : S.e(S.state.role)) + '</div><div class="s">' +
      (S.canAdmin() ? "Receitas " + S.money(revenue) + " · despesas " + S.money(expenses) : "Financeiro restrito a administradores") + "</div></div></div>" +
      '<div class="grid2"><section class="panel"><div class="panel-head"><h3>Pedidos recentes</h3><button class="ghost mini" data-action="nav" data-page="orders">Ver todos</button></div>' + recent + '</section>' +
      '<section class="panel"><div class="panel-head"><h3>Atenção no estoque</h3></div><div class="panel-body"><div class="list">' + lowList + "</div></div></section></div>";
  };

  S.ordersTable = function (rows, core) {
    core = core || {};
    var stores = core.stores || S.state.data.stores || [];
    var customers = core.customers || S.state.data.customers || [];
    var sm = {};
    var cm = {};
    stores.forEach(function (x) { sm[x.id] = x.name; });
    customers.forEach(function (x) { cm[x.id] = x.name; });
    if (!rows.length) return S.empty("Nenhum pedido encontrado", "Crie um pedido ou ajuste os filtros.");

    return '<div class="table-wrap"><table class="table"><thead><tr><th>Pedido</th><th>Loja</th><th>Cliente</th><th>Status</th><th>Pagamento</th><th>Prazo</th><th>Total</th></tr></thead><tbody>' +
      rows.map(function (o) {
        var late = o.due_at && new Date(o.due_at) < new Date() && ["shipped", "delivered", "cancelled"].indexOf(o.status) === -1;
        return '<tr><td><button class="link-btn" data-action="view-order" data-id="' + o.id + '">' + S.e(o.external_id || o.id.slice(0, 8)) + '</button></td><td>' +
          S.e(sm[o.store_id] || "—") + "</td><td>" + S.e(cm[o.customer_id] || "—") + "</td><td>" + S.statusBadge(o.status) + "</td><td>" +
          S.paymentBadge(o.payment_status) + '</td><td class="' + (late ? "overdue" : "") + '">' + S.dt(o.due_at) + "</td><td>" + S.money(o.total) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  };

  S.safeOrderSearch = function (value) {
    return String(value || "")
      .replace(/[,()*"'\\%_]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
  };

  S.loadOrdersPage = async function () {
    var oq = S.state.orderQuery || { page: 0, size: 50, search: "", status: "" };
    var size = Math.min(100, Math.max(10, Number(oq.size) || 50));
    var pageIndex = Math.max(0, Number(oq.page) || 0);
    var offset = pageIndex * size;
    var query = S.sb.from("orders")
      .select("*", { count: "exact" })
      .eq("organization_id", S.state.orgId);

    if (oq.status) query = query.eq("status", oq.status);
    var search = S.safeOrderSearch(oq.search);
    if (search) {
      query = query.or(
        "external_id.ilike.*" + search + "*,tracking_code.ilike.*" + search + "*,notes.ilike.*" + search + "*"
      );
    }

    query = query.order("created_at", { ascending: false }).range(offset, offset + size - 1);
    var res = await query;
    if (res.error) throw res.error;
    return { rows: res.data || [], total: Number(res.count) || 0, page: pageIndex, size: size };
  };

  S.pageOrders = async function () {
    var both = await Promise.all([
      S.loadOrdersPage(),
      S.fetchAll("stores", "*", "name"),
      S.fetchAll("customers", "*", "name")
    ]);
    var result = both[0];
    var core = { stores: both[1], customers: both[2] };
    var totalPages = Math.max(1, Math.ceil(result.total / result.size));

    if (result.page >= totalPages && result.page > 0) {
      S.state.orderQuery.page = totalPages - 1;
      return S.pageOrders();
    }

    S.state.data.orders = result.rows;
    S.state.data.stores = core.stores;
    S.state.data.customers = core.customers;

    var statusOptions = Object.keys(S.statusLabel).map(function (k) {
      return '<option value="' + k + '"' + (S.state.orderQuery.status === k ? " selected" : "") + '>' + S.statusLabel[k] + "</option>";
    }).join("");
    var pageNumber = result.page + 1;
    var first = result.total ? (result.page * result.size) + 1 : 0;
    var last = Math.min(result.total, (result.page + 1) * result.size);

    document.getElementById("page").innerHTML =
      '<div class="page-head"><div><h2>Pedidos</h2><p>Prazo, separação, envio e pagamento.</p></div><div class="actions"><button class="ghost" data-action="export" data-kind="orders">Exportar CSV</button>' +
      (S.canWrite() ? '<button class="primary" data-action="new-order">+ Novo pedido</button>' : "") + '</div></div>' +
      '<div class="toolbar"><input class="search" id="orderSearch" value="' + S.e(S.state.orderQuery.search || "") + '" placeholder="Buscar por código, rastreio ou observação"><select id="orderStatus"><option value="">Todos os status</option>' + statusOptions + '</select></div>' +
      '<section class="panel" id="ordersPanel">' + S.ordersTable(result.rows, core) + "</section>" +
      '<div class="pager"><span>Mostrando ' + first + "–" + last + " de " + result.total + ' pedidos</span><div class="pager-actions">' +
      '<button class="ghost mini" data-action="order-page" data-direction="-1"' + (result.page <= 0 ? " disabled" : "") + '>← Anterior</button>' +
      '<strong>Página ' + pageNumber + " de " + totalPages + '</strong>' +
      '<button class="ghost mini" data-action="order-page" data-direction="1"' + (result.page + 1 >= totalPages ? " disabled" : "") + '>Próxima →</button></div></div>';
  };

  S.productsTable = function (rows) {
    if (!rows.length) return S.empty("Nenhum produto", "Cadastre seus produtos para controlar o estoque.");
    return '<div class="table-wrap"><table class="table"><thead><tr><th>SKU</th><th>Produto</th><th>Custo</th><th>Preço</th><th>Estoque</th><th>Mínimo</th><th>Situação</th><th></th></tr></thead><tbody>' +
      rows.map(function (x) {
        return '<tr><td>' + S.e(x.sku) + "</td><td><strong>" + S.e(x.name) + "</strong></td><td>" + S.money(x.cost) + "</td><td>" + S.money(x.price) + '</td><td class="' +
          (x.stock <= x.min_stock ? "low" : "") + '">' + x.stock + "</td><td>" + x.min_stock + "</td><td>" + (x.active ? S.badge("Ativo", "ok") : S.badge("Inativo")) +
          '</td><td class="nowrap">' + (S.canWrite() ? '<button class="ghost mini" data-action="stock-product" data-id="' + x.id + '">Estoque</button> <button class="ghost mini" data-action="edit-product" data-id="' + x.id + '">Editar</button>' : "") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  };

  S.pageProducts = async function () {
    var rows = await S.fetchAll("products", "*", "name");
    S.state.data.products = rows;
    document.getElementById("page").innerHTML =
      '<div class="page-head"><div><h2>Produtos e estoque</h2><p>Custos, preços, saldo e estoque mínimo.</p></div><div class="actions"><button class="ghost" data-action="export" data-kind="products">Exportar CSV</button>' +
      (S.canWrite() ? '<button class="primary" data-action="new-product">+ Produto</button>' : "") + '</div></div>' +
      '<div class="toolbar"><input class="search" id="productSearch" placeholder="Buscar por SKU ou nome"><select id="stockFilter"><option value="">Todos</option><option value="low">Estoque baixo</option><option value="active">Ativos</option><option value="inactive">Inativos</option></select></div>' +
      '<section class="panel" id="productsPanel">' + S.productsTable(rows) + "</section>";
  };

  S.customersTable = function (rows) {
    if (!rows.length) return S.empty("Nenhum cliente", "Cadastre clientes ou vincule-os aos pedidos.");
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Documento</th><th></th></tr></thead><tbody>' +
      rows.map(function (x) {
        return '<tr><td><strong>' + S.e(x.name) + "</strong></td><td>" + S.e(x.email || "—") + "</td><td>" + S.e(x.phone || "—") + "</td><td>" + S.e(x.document || "—") +
          "</td><td>" + (S.canWrite() ? '<button class="ghost mini" data-action="edit-customer" data-id="' + x.id + '">Editar</button>' : "") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  };

  S.pageCustomers = async function () {
    var rows = await S.fetchAll("customers", "*", "name");
    S.state.data.customers = rows;
    document.getElementById("page").innerHTML =
      '<div class="page-head"><div><h2>Clientes</h2><p>Dados de contato e observações de atendimento.</p></div><div class="actions"><button class="ghost" data-action="export" data-kind="customers">Exportar CSV</button>' +
      (S.canWrite() ? '<button class="primary" data-action="new-customer">+ Cliente</button>' : "") + '</div></div>' +
      '<div class="toolbar"><input class="search" id="customerSearch" placeholder="Buscar por nome, e-mail, telefone ou documento"></div><section class="panel" id="customersPanel">' +
      S.customersTable(rows) + "</section>";
  };

  S.financeTable = function (rows) {
    if (!rows.length) return S.empty("Nenhum lançamento", "Receitas de pedidos pagos aparecem automaticamente aqui.");
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Status</th><th>Valor</th><th></th></tr></thead><tbody>' +
      rows.map(function (x) {
        var status = x.status === "paid" ? S.badge("Pago", "ok") : x.status === "planned" ? S.badge("Planejado", "warn") : S.badge("Cancelado", "danger");
        return "<tr><td>" + S.day(x.occurred_on) + "</td><td>" + (x.kind === "income" ? S.badge("Receita", "ok") : S.badge("Despesa", "danger")) + "</td><td>" +
          S.e(x.category) + "</td><td>" + S.e(x.description) + (x.order_id ? ' <span class="muted">(pedido)</span>' : "") + "</td><td>" + status +
          '</td><td class="money ' + (x.kind === "income" ? "pos" : "neg") + '">' + (x.kind === "income" ? "+" : "-") + " " + S.money(x.amount) + "</td><td>" +
          (!x.order_id ? '<button class="ghost mini" data-action="delete-finance" data-id="' + x.id + '">Excluir</button>' : "") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  };

  S.pageFinance = async function () {
    var rows = await S.fetchAll("financial_transactions", "*", "occurred_on");
    S.state.data.finance = rows;
    var inc = rows.filter(function (x) { return x.kind === "income" && x.status === "paid"; }).reduce(function (a, x) { return a + Number(x.amount); }, 0);
    var exp = rows.filter(function (x) { return x.kind === "expense" && x.status === "paid"; }).reduce(function (a, x) { return a + Number(x.amount); }, 0);

    document.getElementById("page").innerHTML =
      '<div class="page-head"><div><h2>Financeiro</h2><p>Receitas de pedidos e lançamentos manuais.</p></div><div class="actions"><button class="ghost" data-action="export" data-kind="finance">Exportar CSV</button><button class="primary" data-action="new-finance">+ Lançamento</button></div></div>' +
      '<div class="cards"><div class="card"><div class="k">Receitas pagas</div><div class="v money pos">' + S.money(inc) + '</div></div><div class="card"><div class="k">Despesas pagas</div><div class="v money neg">' + S.money(exp) +
      '</div></div><div class="card"><div class="k">Saldo registrado</div><div class="v">' + S.money(inc - exp) + '</div></div><div class="card"><div class="k">Lançamentos</div><div class="v">' + rows.length + "</div></div></div>" +
      '<section class="panel">' + S.financeTable(rows) + "</section>";
  };

  S.pageStores = async function () {
    var rows = await S.fetchAll("stores", "*", "name");
    S.state.data.stores = rows;
    var list = rows.length ? rows.map(function (x) {
      return '<div class="list-item"><div><strong>' + S.e(x.name) + '</strong><div class="meta">' + S.e(x.marketplace.replace("_", " ")) + " · " +
        (x.integration_status === "connected" ? "Conectada" : "Integração não conectada") + '</div></div><div class="actions">' +
        (x.active ? S.badge("Ativa", "ok") : S.badge("Inativa")) + (S.canAdmin() ? '<button class="ghost mini" data-action="edit-store" data-id="' + x.id + '">Editar</button>' : "") + "</div></div>";
    }).join("") : '<div class="muted">Nenhuma loja cadastrada.</div>';

    document.getElementById("page").innerHTML =
      '<div class="page-head"><div><h2>Lojas e canais</h2><p>Cadastre os canais de venda. Shopee e Mercado Livre ficam sem sincronização até as APIs oficiais serem configuradas.</p></div>' +
      (S.canAdmin() ? '<button class="primary" data-action="new-store">+ Loja</button>' : "") + '</div><section class="panel"><div class="panel-body"><div class="list">' + list + "</div></div></section>";
  };

  S.maskEmail = function (email) {
    var text = String(email || "");
    var parts = text.split("@");
    if (parts.length !== 2) return "Conta";
    var local = parts[0];
    var shown = local.length <= 2 ? local.charAt(0) : local.slice(0, 2);
    return shown + "***@" + parts[1];
  };

  S.pageTeam = async function () {
    if (!S.canAdmin()) throw new Error("Acesso restrito à administração.");

    var both = await Promise.all([
      S.sb.rpc("list_team_members", { p_org: S.state.orgId }),
      S.sb.from("organization_invites")
        .select("id,token,role,expires_at,redeemed_at,revoked_at,created_at")
        .eq("organization_id", S.state.orgId)
        .order("created_at", { ascending: false })
        .limit(30)
    ]);
    if (both[0].error) throw both[0].error;
    if (both[1].error) throw both[1].error;

    var members = both[0].data || [];
    var invites = both[1].data || [];
    S.state.data.teamMembers = members;
    S.state.data.teamInvites = invites;

    var memberRows = members.length ? members.map(function (m) {
      var canManage = m.role !== "owner" && (S.state.role === "owner" || (S.state.role === "admin" && m.role !== "admin"));
      var roleCell;
      if (canManage) {
        var allowed = S.state.role === "owner" ? ["admin","operator","viewer"] : ["operator","viewer"];
        roleCell = '<select class="team-role-select" data-action="team-role" data-id="' + m.membership_id + '">' +
          allowed.map(function (r) {
            return '<option value="' + r + '"' + (m.role === r ? " selected" : "") + '>' + S.e(S.roleLabel(r)) + "</option>";
          }).join("") + "</select>";
      } else {
        roleCell = S.badge(S.roleLabel(m.role), m.role === "owner" ? "info" : "");
      }

      var identity = m.full_name ? S.e(m.full_name) : "Membro da equipe";
      var masked = S.maskEmail(m.email);
      return '<tr><td><strong>' + identity + '</strong><div class="meta">' + S.e(masked) + '</div></td><td>' + roleCell + '</td><td>' + S.day(m.created_at) + '</td><td class="right">' +
        (canManage ? '<button class="danger-btn mini" data-action="remove-team-member" data-id="' + m.membership_id + '">Remover</button>' : "") + "</td></tr>";
    }).join("") : "";

    var memberBody = memberRows ? '<div class="table-wrap"><table class="table team-table"><thead><tr><th>Membro</th><th>Permissão</th><th>Desde</th><th></th></tr></thead><tbody>' + memberRows + '</tbody></table></div>' :
      S.empty("Nenhum membro", "Crie um convite para adicionar pessoas à equipe.");

    var now = Date.now();
    var inviteList = invites.length ? invites.map(function (i) {
      var active = !i.redeemed_at && !i.revoked_at && new Date(i.expires_at).getTime() > now;
      var status = i.redeemed_at ? S.badge("Usado", "ok") : i.revoked_at ? S.badge("Revogado", "danger") : new Date(i.expires_at).getTime() <= now ? S.badge("Expirado", "warn") : S.badge("Ativo", "info");
      var link = (S.cfg.productionUrl || window.location.origin).replace(/\/$/, "") + "/?invite=" + encodeURIComponent(i.token);
      return '<div class="list-item team-invite"><div><strong>' + S.e(S.roleLabel(i.role)) + '</strong><div class="meta">Criado em ' + S.dt(i.created_at) + ' · expira em ' + S.dt(i.expires_at) + '</div></div><div class="actions">' + status +
        (active ? '<button class="ghost mini" data-action="copy-team-invite" data-link="' + S.e(link) + '">Copiar convite</button><button class="danger-btn mini" data-action="revoke-team-invite" data-id="' + i.id + '">Revogar</button>' : "") +
        "</div></div>";
    }).join("") : '<div class="muted">Nenhum convite criado ainda.</div>';

    document.getElementById("page").innerHTML =
      '<div class="page-head"><div><h2>Equipe</h2><p>Convide funcionários e controle o que cada pessoa pode fazer dentro da empresa.</p></div><div class="actions"><button class="primary" data-action="new-team-invite">+ Criar convite</button></div></div>' +
      '<div class="team-role-help"><div><strong>Administrador</strong><span>Gerencia operação, financeiro, equipe e auditoria.</span></div><div><strong>Operador</strong><span>Cria e atualiza pedidos, clientes, produtos e estoque.</span></div><div><strong>Visualização</strong><span>Acompanha dados sem alterar a operação.</span></div></div>' +
      '<section class="panel"><div class="panel-head"><h3>Membros</h3><span class="muted">' + members.length + ' conta(s)</span></div>' + memberBody + '</section>' +
      '<section class="panel team-invites-panel"><div class="panel-head"><h3>Convites</h3><span class="muted">Links expiram em 7 dias e funcionam uma única vez.</span></div><div class="panel-body"><div class="list">' + inviteList + "</div></div></section>";
  };

  S.pageBackup = async function () {
    if (!S.canAdmin()) throw new Error("Acesso restrito à administração.");
    var key = "systemSeller:lastBackup:" + S.state.orgId;
    var last = "";
    try { last = window.localStorage.getItem(key) || ""; } catch (e) {}

    var counts = await Promise.all([
      S.sb.from("orders").select("id", { count: "exact", head: true }).eq("organization_id", S.state.orgId),
      S.sb.from("products").select("id", { count: "exact", head: true }).eq("organization_id", S.state.orgId),
      S.sb.from("customers").select("id", { count: "exact", head: true }).eq("organization_id", S.state.orgId)
    ]);
    counts.forEach(function (x) { if (x.error) throw x.error; });

    document.getElementById("page").innerHTML =
      '<div class="page-head"><div><h2>Backup e recuperação</h2><p>Gere uma cópia portátil dos dados da empresa para arquivamento e conferência.</p></div><div class="actions"><button class="primary" data-action="backup-workspace">Baixar backup JSON</button></div></div>' +
      '<div class="cards"><div class="card"><div class="k">Pedidos</div><div class="v">' + (counts[0].count || 0) + '</div></div><div class="card"><div class="k">Produtos</div><div class="v">' + (counts[1].count || 0) + '</div></div><div class="card"><div class="k">Clientes</div><div class="v">' + (counts[2].count || 0) + '</div></div><div class="card"><div class="k">Último backup neste navegador</div><div class="v backup-date">' + (last ? S.dt(last) : "Nunca") + '</div></div></div>' +
      '<section class="panel"><div class="panel-body"><h3>O que entra no arquivo</h3><p class="muted">Empresa, lojas, clientes, produtos, pedidos, itens, movimentações de estoque, financeiro, equipe e auditoria. Tokens de convite e credenciais não são exportados.</p>' +
      '<div class="note">Este arquivo é um backup operacional complementar. Ele não substitui os backups gerenciados e a retenção do banco no provedor. Guarde o JSON em local seguro porque ele contém dados comerciais da empresa.</div></div></section>' +
      '<section class="panel backup-checklist"><div class="panel-head"><h3>Rotina recomendada</h3></div><div class="panel-body"><div class="list"><div class="list-item"><div><strong>Semanal</strong><div class="meta">Baixe um snapshot e armazene fora do computador principal.</div></div></div><div class="list-item"><div><strong>Antes de mudanças grandes</strong><div class="meta">Exporte antes de importações, integrações ou alterações em massa.</div></div></div><div class="list-item"><div><strong>Mensal</strong><div class="meta">Teste se o arquivo abre e contém pedidos, produtos e financeiro esperados.</div></div></div></div></div></section>';
  };

  S.pageAudit = async function () {
    var res = await S.sb.from("audit_logs").select("id,entity_type,entity_id,action,created_at,actor_id").eq("organization_id", S.state.orgId).order("created_at", { ascending: false }).limit(200);
    if (res.error) throw res.error;
    S.state.data.audit = res.data || [];
    var body = S.state.data.audit.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Data</th><th>Entidade</th><th>Ação</th><th>Registro</th><th>Usuário</th></tr></thead><tbody>' +
      S.state.data.audit.map(function (x) {
        return "<tr><td>" + S.dt(x.created_at) + "</td><td>" + S.e(x.entity_type) + "</td><td>" + S.badge(x.action, x.action === "delete" ? "danger" : x.action === "insert" ? "ok" : "info") +
          "</td><td>" + S.e(x.entity_id.slice(0, 16)) + "</td><td>" + S.e(x.actor_id ? x.actor_id.slice(0, 8) : "Sistema") + "</td></tr>";
      }).join("") + "</tbody></table></div>" : S.empty("Sem eventos", "A auditoria aparecerá conforme a operação for utilizada.");

    document.getElementById("page").innerHTML = '<div class="page-head"><div><h2>Auditoria</h2><p>Registro de alterações importantes. Somente proprietários e administradores podem visualizar.</p></div></div><section class="panel">' + body + "</section>";
  };

  S.showOrder = async function (id) {
    var both = await Promise.all([
      S.sb.from("orders").select("*").eq("id", id).single(),
      S.sb.from("order_items").select("*").eq("order_id", id).order("created_at")
    ]);
    if (both[0].error) throw both[0].error;
    if (both[1].error) throw both[1].error;
    var o = both[0].data;
    var items = both[1].data || [];
    var store = (S.state.data.stores || []).find(function (x) { return x.id === o.store_id; });
    var customer = (S.state.data.customers || []).find(function (x) { return x.id === o.customer_id; });
    var next = S.transition[o.status];

    var itemList = items.map(function (i) {
      return '<div class="list-item"><div><strong>' + S.e(i.name) + '</strong><div class="meta">' + S.e(i.sku) + " · " + i.quantity + " × " + S.money(i.unit_price) + "</div></div><strong>" + S.money(i.line_total) + "</strong></div>";
    }).join("");

    var actions = "";
    if (S.canWrite() && next) actions += '<button class="primary" data-action="status-order" data-id="' + o.id + '" data-status="' + next + '">Avançar para ' + S.e(S.statusLabel[next]) + "</button>";
    if (S.canWrite() && ["new", "picking", "packing", "ready"].indexOf(o.status) !== -1) actions += '<button class="danger-btn" data-action="status-order" data-id="' + o.id + '" data-status="cancelled">Cancelar pedido</button>';
    if (S.canAdmin() && o.payment_status === "pending") actions += '<button class="secondary" data-action="payment-order" data-id="' + o.id + '" data-status="paid">Marcar pago</button>';
    if (S.canAdmin() && o.payment_status === "paid") actions += '<button class="danger-btn" data-action="payment-order" data-id="' + o.id + '" data-status="refunded">Registrar reembolso</button>';
    if (S.canWrite()) actions += '<button class="ghost" data-action="edit-order-meta" data-id="' + o.id + '">Editar prazo/rastreio</button>';

    var body = '<div class="grid2"><div><div class="section-title">Itens</div><div class="list">' + itemList + '</div></div><div><div class="section-title">Resumo</div>' +
      '<div class="statline"><span>Status</span>' + S.statusBadge(o.status) + '</div><div class="statline"><span>Pagamento</span>' + S.paymentBadge(o.payment_status) + '</div>' +
      '<div class="statline"><span>Loja</span><strong>' + S.e(store ? store.name : "—") + '</strong></div><div class="statline"><span>Cliente</span><strong>' + S.e(customer ? customer.name : "—") + '</strong></div>' +
      '<div class="statline"><span>Venda</span><strong>' + S.dt(o.sold_at) + '</strong></div><div class="statline"><span>Prazo</span><strong>' + S.dt(o.due_at) + '</strong></div>' +
      '<div class="statline"><span>Subtotal</span><strong>' + S.money(o.subtotal) + '</strong></div><div class="statline"><span>Frete</span><strong>' + S.money(o.shipping) + '</strong></div>' +
      '<div class="statline"><span>Desconto</span><strong>' + S.money(o.discount) + '</strong></div><div class="statline"><span>Total</span><strong>' + S.money(o.total) + '</strong></div>' +
      '<div class="statline"><span>Rastreio</span><strong>' + S.e(o.tracking_code || "—") + "</strong></div></div></div>" +
      (o.notes ? '<div class="section-title">Observações</div><div class="note">' + S.e(o.notes) + "</div>" : "") +
      '<div class="section-title">Ações</div><div class="actions">' + actions + "</div>";

    S.modal("Pedido " + (o.external_id || o.id.slice(0, 8)), body, true);
  };
  S.pageProfile = async function () {
    var org = S.currentOrg();
    var user = S.state.session.user;
    var base = await Promise.all([
      S.fetchAll("orders", "id,status,payment_status,total,due_at,sold_at,created_at", "created_at"),
      S.fetchAll("products", "id,name,sku,cost,price,stock,min_stock,active", "name"),
      S.sb.from("customers").select("id", { count: "exact", head: true }).eq("organization_id", S.state.orgId),
      S.sb.from("stores").select("id,name,marketplace,integration_status,active").eq("organization_id", S.state.orgId).order("name")
    ]);
    if (base[2].error) throw base[2].error;
    if (base[3].error) throw base[3].error;

    var orders = base[0] || [];
    var products = base[1] || [];
    var customers = base[2].count || 0;
    var stores = base[3].data || [];
    var finance = [];

    if (S.canAdmin()) {
      finance = await S.fetchAll("financial_transactions", "kind,amount,status,occurred_on,created_at", "created_at");
    }

    var terminal = ["delivered", "cancelled"];
    var openOrders = orders.filter(function (o) { return terminal.indexOf(o.status) === -1; });
    var delivered = orders.filter(function (o) { return o.status === "delivered"; }).length;
    var cancelled = orders.filter(function (o) { return o.status === "cancelled"; }).length;
    var paidOrders = orders.filter(function (o) { return o.payment_status === "paid" && o.status !== "cancelled"; });
    var pendingOrders = orders.filter(function (o) { return o.payment_status === "pending" && o.status !== "cancelled"; }).length;
    var now = Date.now();
    var overdue = openOrders.filter(function (o) {
      return o.due_at && new Date(o.due_at).getTime() < now && o.status !== "shipped";
    }).length;

    var validOrders = orders.filter(function (o) { return o.status !== "cancelled"; });
    var grossOrders = validOrders.reduce(function (sum, o) { return sum + Number(o.total || 0); }, 0);
    var avgTicket = validOrders.length ? grossOrders / validOrders.length : 0;

    var monthPrefix = S.todayIso().slice(0, 7);
    var monthOrders = validOrders.filter(function (o) {
      var date = o.sold_at || o.created_at;
      return date && String(date).slice(0, 7) === monthPrefix;
    });
    var monthGross = monthOrders.reduce(function (sum, o) { return sum + Number(o.total || 0); }, 0);

    var activeProducts = products.filter(function (x) { return x.active; });
    var units = activeProducts.reduce(function (sum, x) { return sum + Number(x.stock || 0); }, 0);
    var low = activeProducts.filter(function (x) { return Number(x.stock) <= Number(x.min_stock); }).length;
    var stockCost = activeProducts.reduce(function (sum, x) { return sum + Number(x.stock || 0) * Number(x.cost || 0); }, 0);
    var stockSale = activeProducts.reduce(function (sum, x) { return sum + Number(x.stock || 0) * Number(x.price || 0); }, 0);

    var income = finance.filter(function (x) { return x.kind === "income" && x.status === "paid"; })
      .reduce(function (sum, x) { return sum + Number(x.amount || 0); }, 0);
    var expense = finance.filter(function (x) { return x.kind === "expense" && x.status === "paid"; })
      .reduce(function (sum, x) { return sum + Number(x.amount || 0); }, 0);
    var plannedExpense = finance.filter(function (x) { return x.kind === "expense" && x.status === "planned"; })
      .reduce(function (sum, x) { return sum + Number(x.amount || 0); }, 0);

    var activeStores = stores.filter(function (x) { return x.active; }).length;
    var connectedStores = stores.filter(function (x) { return x.integration_status === "connected"; }).length;
    var roleLabel = S.state.role === "owner" ? "Proprietário" : S.state.role === "admin" ? "Administrador" : S.state.role === "operator" ? "Operador" : "Visualização";
    var profile = S.state.profile || {};
    var displayName = S.profileName();

    var statusOrder = ["new", "picking", "packing", "ready", "shipped", "delivered", "cancelled"];
    var maxStatus = Math.max(1, orders.length);
    var statusBars = statusOrder.map(function (status) {
      var qty = orders.filter(function (o) { return o.status === status; }).length;
      var pct = Math.round((qty / maxStatus) * 100);
      return '<div class="status-row"><div><span>' + S.e(S.statusLabel[status]) + '</span><b>' + qty + '</b></div><div class="status-track"><i style="width:' + pct + '%"></i></div></div>';
    }).join("");

    var storeRows = stores.length ? stores.map(function (x) {
      var channel = x.marketplace === "mercado_livre" ? "Mercado Livre" : x.marketplace === "shopee" ? "Shopee" : x.marketplace === "manual" ? "Manual" : "Outro";
      var state = x.integration_status === "connected" ? S.badge("Conectada", "ok") : S.badge("Sem integração");
      return '<div class="list-item"><div><strong>' + S.e(x.name) + '</strong><div class="meta">' + S.e(channel) + '</div></div>' + state + '</div>';
    }).join("") : '<div class="muted">Nenhuma loja cadastrada.</div>';

    var accountCreated = user.created_at ? S.dt(user.created_at) : "—";
    var lastSignIn = user.last_sign_in_at ? S.dt(user.last_sign_in_at) : "—";

    var financeCards = S.canAdmin() ?
      '<div class="metric"><span>Receitas pagas</span><strong class="money pos">' + S.money(income) + '</strong><small>Histórico financeiro</small></div>' +
      '<div class="metric"><span>Despesas pagas</span><strong class="money neg">' + S.money(expense) + '</strong><small>Histórico financeiro</small></div>' +
      '<div class="metric"><span>Saldo financeiro</span><strong>' + S.money(income - expense) + '</strong><small>Receitas menos despesas</small></div>' +
      '<div class="metric"><span>Despesas planejadas</span><strong>' + S.money(plannedExpense) + '</strong><small>Ainda não pagas</small></div>' :
      '<div class="profile-restricted">Os indicadores financeiros completos são exibidos somente para proprietário e administradores.</div>';

    document.getElementById("page").innerHTML =
      '<div class="page-head"><div><h2>Perfil e estatísticas</h2><p>Conta, empresa e visão consolidada da operação.</p></div><div class="actions">' +
      '<button class="ghost" data-action="profile-reset-password">Alterar senha</button><button class="danger-btn" data-action="logout">Sair da conta</button></div></div>' +
      '<section class="profile-hero"><div class="profile-photo-wrap">' + S.avatarMarkup("profile-avatar-img") +
      '<label class="photo-edit" for="avatarInput">Alterar foto</label><input id="avatarInput" class="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp">' +
      (profile.avatar_path ? '<button class="photo-remove" type="button" data-action="remove-avatar">Remover foto</button>' : '') +
      '</div><div class="profile-main"><span class="profile-kicker">Conta ativa</span><h3>' + S.e(displayName) + '</h3><p>' + S.e(org ? org.name : "Empresa") + ' · ' + S.e(roleLabel) + '</p><div class="privacy-note">Seu e-mail de acesso não é exibido aqui por privacidade.</div></div>' +
      '<div class="profile-meta"><div><span>Conta criada</span><b>' + S.e(accountCreated) + '</b></div><div><span>Último acesso</span><b>' + S.e(lastSignIn) + '</b></div></div></section>' +

      '<section class="panel profile-settings"><div class="panel-head"><h3>Dados do perfil</h3><span class="muted">Visível apenas dentro da sua conta</span></div><div class="panel-body"><form data-form="profile"><div class="form-grid"><div class="field span2"><label>Nome exibido</label><input name="full_name" minlength="2" maxlength="80" value="' + S.e(profile.full_name || "") + '" placeholder="Ex.: João Silva" required></div></div><div class="actions"><button class="primary" type="submit">Salvar perfil</button></div></form></div></section>' +

      '<section class="panel theme-settings"><div class="panel-head"><h3>Aparência</h3><span class="muted">Escolha uma paleta mais confortável para trabalhar</span></div><div class="panel-body"><div class="theme-grid">' + S.themeCards() + '</div><div class="theme-note">O tema fica salvo na sua conta e também neste navegador.</div></div></section>' +

      '<div class="section-title">Operação</div><div class="stats-grid">' +
      '<div class="metric"><span>Pedidos totais</span><strong>' + orders.length + '</strong><small>' + openOrders.length + ' em andamento</small></div>' +
      '<div class="metric"><span>Entregues</span><strong>' + delivered + '</strong><small>' + cancelled + ' cancelados</small></div>' +
      '<div class="metric"><span>Prazo vencido</span><strong class="' + (overdue ? "overdue" : "") + '">' + overdue + '</strong><small>Precisam de atenção</small></div>' +
      '<div class="metric"><span>Pagamento pendente</span><strong>' + pendingOrders + '</strong><small>' + paidOrders.length + ' pedidos pagos</small></div>' +
      '<div class="metric"><span>Valor dos pedidos</span><strong>' + S.money(grossOrders) + '</strong><small>Exclui cancelados</small></div>' +
      '<div class="metric"><span>Ticket médio</span><strong>' + S.money(avgTicket) + '</strong><small>Por pedido não cancelado</small></div>' +
      '<div class="metric"><span>Pedidos no mês</span><strong>' + monthOrders.length + '</strong><small>' + S.money(monthGross) + ' em vendas</small></div>' +
      '<div class="metric"><span>Clientes</span><strong>' + customers + '</strong><small>Cadastros da empresa</small></div></div>' +

      '<div class="section-title">Estoque e catálogo</div><div class="stats-grid">' +
      '<div class="metric"><span>Produtos ativos</span><strong>' + activeProducts.length + '</strong><small>' + products.length + ' cadastrados no total</small></div>' +
      '<div class="metric"><span>Unidades em estoque</span><strong>' + units + '</strong><small>Somatório dos produtos ativos</small></div>' +
      '<div class="metric"><span>Estoque baixo</span><strong class="' + (low ? "low" : "") + '">' + low + '</strong><small>No mínimo ou abaixo</small></div>' +
      '<div class="metric"><span>Custo do estoque</span><strong>' + S.money(stockCost) + '</strong><small>Custo × quantidade</small></div>' +
      '<div class="metric"><span>Valor potencial</span><strong>' + S.money(stockSale) + '</strong><small>Preço de venda × quantidade</small></div>' +
      '<div class="metric"><span>Lojas ativas</span><strong>' + activeStores + '</strong><small>' + connectedStores + ' integrações conectadas</small></div></div>' +

      '<div class="section-title">Financeiro</div><div class="stats-grid">' + financeCards + '</div>' +

      '<div class="profile-layout"><section class="panel"><div class="panel-head"><h3>Distribuição dos pedidos</h3></div><div class="panel-body status-list">' + statusBars + '</div></section>' +
      '<section class="panel"><div class="panel-head"><h3>Lojas da empresa</h3></div><div class="panel-body"><div class="list">' + storeRows + '</div></div></section></div>';
  };

})();
