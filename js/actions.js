(function () {
  "use strict";
  var S = window.SS;

  function formData(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function productOptions(products, selected) {
    return products.filter(function (p) { return p.active; }).map(function (p) {
      return '<option value="' + p.id + '" data-price="' + Number(p.price) + '"' + (p.id === selected ? " selected" : "") + ">" +
        S.e(p.sku + " · " + p.name + " · estoque " + p.stock) + "</option>";
    }).join("");
  }

  S.orderLine = function (products) {
    return '<div class="order-line"><div class="field"><label>Produto</label><select class="order-product" required><option value="">Selecione</option>' +
      productOptions(products) + '</select></div><div class="field"><label>Qtd.</label><input class="order-qty" type="number" min="1" step="1" value="1" required></div>' +
      '<div class="field"><label>Preço un.</label><input class="order-price" type="number" min="0" step="0.01" value="0" required></div><button class="danger-btn mini" type="button" data-action="remove-line" aria-label="Remover">×</button></div>';
  };

  S.updateEstimate = function () {
    var form = document.getElementById("orderForm");
    var out = document.getElementById("orderEstimate");
    if (!form || !out) return;
    var subtotal = 0;
    form.querySelectorAll(".order-line").forEach(function (row) {
      subtotal += (Number(row.querySelector(".order-qty").value) || 0) * (Number(row.querySelector(".order-price").value) || 0);
    });
    var shipping = Number(form.elements.shipping.value) || 0;
    var discount = Number(form.elements.discount.value) || 0;
    out.textContent = S.money(Math.max(0, subtotal + shipping - discount));
  };

  S.openOrderForm = async function () {
    var core = await S.getCore();
    var active = core.products.filter(function (x) { return x.active; });
    if (!active.length) {
      S.toast("Cadastre ao menos um produto ativo antes de criar pedidos.", "error");
      S.state.page = "products";
      S.renderShell();
      await S.pageProducts();
      return;
    }

    var stores = '<option value="">Sem loja</option>' + core.stores.filter(function (x) { return x.active; }).map(function (x) {
      return '<option value="' + x.id + '">' + S.e(x.name) + "</option>";
    }).join("");
    var customers = '<option value="">Sem cliente</option>' + core.customers.map(function (x) {
      return '<option value="' + x.id + '">' + S.e(x.name) + "</option>";
    }).join("");

    var body = '<form data-form="order" id="orderForm"><div class="form-grid">' +
      '<div class="field"><label>Loja</label><select name="store_id">' + stores + '</select></div>' +
      '<div class="field"><label>Cliente</label><select name="customer_id">' + customers + '</select></div>' +
      '<div class="field"><label>Código externo</label><input name="external_id" maxlength="120" placeholder="Ex.: ML-12345"></div>' +
      '<div class="field"><label>Pagamento</label><select name="payment_status"><option value="pending">Pendente</option><option value="paid">Pago</option></select></div>' +
      '<div class="field"><label>Prazo de envio</label><input name="due_at" type="datetime-local"></div>' +
      '<div class="field"><label>Data da venda</label><input name="sold_at" type="datetime-local" value="' + S.localInput(new Date()) + '"></div>' +
      '<div class="field"><label>Frete</label><input name="shipping" type="number" min="0" step="0.01" value="0"></div>' +
      '<div class="field"><label>Desconto</label><input name="discount" type="number" min="0" step="0.01" value="0"></div>' +
      '<div class="field span2"><label>Rastreio</label><input name="tracking_code" maxlength="160"></div></div>' +
      '<div class="section-title">Itens</div><div id="orderLines">' + S.orderLine(active) + '</div>' +
      '<button class="ghost" type="button" data-action="add-line">+ Adicionar item</button>' +
      '<div class="section-title">Resumo</div><div class="statline"><span>Total estimado</span><strong id="orderEstimate">' + S.money(0) + '</strong></div>' +
      '<div class="field"><label>Observações</label><textarea name="notes" maxlength="2000"></textarea></div>' +
      '<div class="actions right"><button class="primary" type="submit">Salvar pedido</button></div></form>';
    S.modal("Novo pedido", body, true);
  };

  S.openProductForm = function (item) {
    item = item || {};
    var editing = !!item.id;
    var body = '<form data-form="product"' + (editing ? ' data-id="' + item.id + '"' : "") + '><div class="form-grid">' +
      '<div class="field"><label>SKU</label><input name="sku" maxlength="80" value="' + S.e(item.sku || "") + '" required></div>' +
      '<div class="field"><label>Nome</label><input name="name" maxlength="180" value="' + S.e(item.name || "") + '" required></div>' +
      '<div class="field"><label>Custo</label><input name="cost" type="number" min="0" step="0.01" value="' + Number(item.cost || 0) + '" required></div>' +
      '<div class="field"><label>Preço de venda</label><input name="price" type="number" min="0" step="0.01" value="' + Number(item.price || 0) + '" required></div>' +
      '<div class="field"><label>Estoque mínimo</label><input name="min_stock" type="number" min="0" step="1" value="' + Number(item.min_stock || 0) + '" required></div>' +
      (editing ? '<div class="field"><label>Situação</label><select name="active"><option value="true"' + (item.active ? " selected" : "") + '>Ativo</option><option value="false"' + (!item.active ? " selected" : "") + ">Inativo</option></select></div>" :
        '<div class="field"><label>Estoque inicial</label><input name="stock" type="number" min="0" step="1" value="0" required></div>') +
      '</div><div class="actions right"><button class="primary" type="submit">Salvar produto</button></div></form>';
    S.modal(editing ? "Editar produto" : "Novo produto", body);
  };

  S.openStockForm = function (item) {
    var body = '<form data-form="stock" data-id="' + item.id + '"><div class="note">Saldo atual: <strong>' + item.stock + " un.</strong>. Use positivo para entrada e negativo para saída/ajuste.</div><br>" +
      '<div class="field"><label>Tipo</label><select name="movement_type"><option value="purchase">Compra/entrada</option><option value="adjustment">Ajuste</option><option value="return">Devolução</option></select></div>' +
      '<div class="field"><label>Quantidade</label><input name="delta" type="number" step="1" required placeholder="Ex.: 10 ou -2"></div>' +
      '<div class="field"><label>Motivo/observação</label><textarea name="notes" maxlength="1000" required></textarea></div>' +
      '<button class="primary" type="submit">Registrar ajuste</button></form>';
    S.modal("Ajustar estoque · " + item.name, body);
  };

  S.openCustomerForm = function (item) {
    item = item || {};
    var body = '<form data-form="customer"' + (item.id ? ' data-id="' + item.id + '"' : "") + '><div class="form-grid">' +
      '<div class="field"><label>Nome</label><input name="name" maxlength="160" value="' + S.e(item.name || "") + '" required></div>' +
      '<div class="field"><label>E-mail</label><input name="email" type="email" maxlength="200" value="' + S.e(item.email || "") + '"></div>' +
      '<div class="field"><label>Telefone</label><input name="phone" maxlength="60" value="' + S.e(item.phone || "") + '"></div>' +
      '<div class="field"><label>Documento</label><input name="document" maxlength="80" value="' + S.e(item.document || "") + '"></div>' +
      '<div class="field span2"><label>Observações</label><textarea name="notes" maxlength="2000">' + S.e(item.notes || "") + '</textarea></div></div>' +
      '<button class="primary" type="submit">Salvar cliente</button></form>';
    S.modal(item.id ? "Editar cliente" : "Novo cliente", body);
  };

  S.openFinanceForm = function () {
    var body = '<form data-form="finance"><div class="form-grid">' +
      '<div class="field"><label>Tipo</label><select name="kind"><option value="expense">Despesa</option><option value="income">Receita manual</option></select></div>' +
      '<div class="field"><label>Status</label><select name="status"><option value="paid">Pago</option><option value="planned">Planejado</option></select></div>' +
      '<div class="field"><label>Categoria</label><input name="category" maxlength="80" required></div>' +
      '<div class="field"><label>Valor</label><input name="amount" type="number" min="0.01" step="0.01" required></div>' +
      '<div class="field"><label>Data</label><input name="occurred_on" type="date" value="' + S.todayIso() + '" required></div>' +
      '<div class="field span2"><label>Descrição</label><input name="description" maxlength="240" required></div></div>' +
      '<button class="primary" type="submit">Salvar lançamento</button></form>';
    S.modal("Novo lançamento financeiro", body);
  };

  S.openStoreForm = function (item) {
    item = item || {};
    var mp = item.marketplace || "manual";
    var body = '<form data-form="store"' + (item.id ? ' data-id="' + item.id + '"' : "") + '><div class="form-grid">' +
      '<div class="field"><label>Nome da loja</label><input name="name" maxlength="100" value="' + S.e(item.name || "") + '" required></div>' +
      '<div class="field"><label>Canal</label><select name="marketplace"><option value="manual"' + (mp === "manual" ? " selected" : "") + '>Manual</option><option value="shopee"' + (mp === "shopee" ? " selected" : "") + '>Shopee</option><option value="mercado_livre"' + (mp === "mercado_livre" ? " selected" : "") + '>Mercado Livre</option><option value="other"' + (mp === "other" ? " selected" : "") + ">Outro</option></select></div>" +
      '<div class="field"><label>ID externo da conta</label><input name="external_account_id" maxlength="160" value="' + S.e(item.external_account_id || "") + '"></div>' +
      (item.id ? '<div class="field"><label>Situação</label><select name="active"><option value="true"' + (item.active ? " selected" : "") + '>Ativa</option><option value="false"' + (!item.active ? " selected" : "") + ">Inativa</option></select></div>" : "") +
      '</div><div class="note">Cadastrar Shopee ou Mercado Livre aqui não ativa sincronização. A integração só será marcada como conectada depois do OAuth/API oficial.</div><br>' +
      '<button class="primary" type="submit">Salvar loja</button></form>';
    S.modal(item.id ? "Editar loja" : "Nova loja", body);
  };

  S.openOrderMeta = async function (id) {
    var res = await S.sb.from("orders").select("id,due_at,tracking_code,notes").eq("id", id).single();
    if (res.error) throw res.error;
    var o = res.data;
    var body = '<form data-form="order-meta" data-id="' + o.id + '"><div class="field"><label>Prazo de envio</label><input name="due_at" type="datetime-local" value="' + S.localInput(o.due_at) + '"></div>' +
      '<div class="field"><label>Rastreio</label><input name="tracking_code" maxlength="160" value="' + S.e(o.tracking_code || "") + '"></div>' +
      '<div class="field"><label>Observações</label><textarea name="notes" maxlength="2000">' + S.e(o.notes || "") + '</textarea></div>' +
      '<button class="primary" type="submit">Salvar</button></form>';
    S.modal("Editar dados operacionais", body);
  };

  function filterOrders() {
    var search = document.getElementById("orderSearch");
    var status = document.getElementById("orderStatus");
    var panel = document.getElementById("ordersPanel");
    if (!panel) return;
    var q = (search ? search.value : "").toLowerCase();
    var s = status ? status.value : "";
    var rows = (S.state.data.orders || []).filter(function (o) {
      var matchStatus = !s || o.status === s;
      var matchText = !q || [o.external_id, o.tracking_code, o.notes, o.id].some(function (v) { return String(v || "").toLowerCase().includes(q); });
      return matchStatus && matchText;
    });
    panel.innerHTML = S.ordersTable(rows);
  }

  function filterProducts() {
    var search = document.getElementById("productSearch");
    var filter = document.getElementById("stockFilter");
    var panel = document.getElementById("productsPanel");
    if (!panel) return;
    var q = (search ? search.value : "").toLowerCase();
    var f = filter ? filter.value : "";
    var rows = (S.state.data.products || []).filter(function (x) {
      var matchText = !q || (x.sku + " " + x.name).toLowerCase().includes(q);
      var matchFilter = !f || (f === "low" && x.stock <= x.min_stock) || (f === "active" && x.active) || (f === "inactive" && !x.active);
      return matchText && matchFilter;
    });
    panel.innerHTML = S.productsTable(rows);
  }

  function filterCustomers() {
    var search = document.getElementById("customerSearch");
    var panel = document.getElementById("customersPanel");
    if (!panel) return;
    var q = (search ? search.value : "").toLowerCase();
    var rows = (S.state.data.customers || []).filter(function (x) {
      return !q || [x.name, x.email, x.phone, x.document].some(function (v) { return String(v || "").toLowerCase().includes(q); });
    });
    panel.innerHTML = S.customersTable(rows);
  }

  function csvCell(value) {
    var s = String(value == null ? "" : value);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }

  S.exportKind = async function (kind) {
    var table, columns, rows, headers;
    if (kind === "orders") {
      table = "orders"; columns = "external_id,status,payment_status,due_at,sold_at,subtotal,shipping,discount,total,tracking_code,notes,created_at";
    } else if (kind === "products") {
      table = "products"; columns = "sku,name,cost,price,stock,min_stock,active,created_at";
    } else if (kind === "customers") {
      table = "customers"; columns = "name,email,phone,document,notes,created_at";
    } else if (kind === "finance") {
      if (!S.canAdmin()) throw new Error("Acesso financeiro restrito.");
      table = "financial_transactions"; columns = "kind,category,description,amount,occurred_on,status,order_id,created_at";
    } else return;

    rows = await S.fetchAll(table, columns, "created_at");
    headers = columns.split(",");
    var csv = "\uFEFF" + headers.map(csvCell).join(";") + "\r\n" + rows.map(function (row) {
      return headers.map(function (h) { return csvCell(row[h]); }).join(";");
    }).join("\r\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "system-seller-" + kind + "-" + S.todayIso() + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  };

  document.addEventListener("click", async function (ev) {
    var b = ev.target.closest("[data-action]");
    if (!b) return;
    var a = b.dataset.action;
    try {
      if (a === "close-modal") S.closeModal();
      else if (a === "auth-mode") S.renderAuth(b.dataset.mode);
      else if (a === "logout") await S.sb.auth.signOut();
      else if (a === "nav") {
        S.state.page = b.dataset.page;
        S.renderShell();
        await S.loadPage();
      } else if (a === "new-order") await S.openOrderForm();
      else if (a === "view-order") await S.showOrder(b.dataset.id);
      else if (a === "new-product") S.openProductForm();
      else if (a === "edit-product") {
        var product = (S.state.data.products || []).find(function (x) { return x.id === b.dataset.id; });
        if (!product) throw new Error("Produto não encontrado.");
        S.openProductForm(product);
      } else if (a === "stock-product") {
        var stockProduct = (S.state.data.products || []).find(function (x) { return x.id === b.dataset.id; });
        if (!stockProduct) throw new Error("Produto não encontrado.");
        S.openStockForm(stockProduct);
      } else if (a === "new-customer") S.openCustomerForm();
      else if (a === "edit-customer") {
        var customer = (S.state.data.customers || []).find(function (x) { return x.id === b.dataset.id; });
        if (!customer) throw new Error("Cliente não encontrado.");
        S.openCustomerForm(customer);
      } else if (a === "new-finance") S.openFinanceForm();
      else if (a === "new-store") S.openStoreForm();
      else if (a === "edit-store") {
        var store = (S.state.data.stores || []).find(function (x) { return x.id === b.dataset.id; });
        if (!store) throw new Error("Loja não encontrada.");
        S.openStoreForm(store);
      } else if (a === "add-line") {
        var box = document.getElementById("orderLines");
        box.insertAdjacentHTML("beforeend", S.orderLine(S.state.data.products || []));
        S.updateEstimate();
      } else if (a === "remove-line") {
        var line = b.closest(".order-line");
        if (line) line.remove();
        S.updateEstimate();
      } else if (a === "edit-order-meta") {
        await S.openOrderMeta(b.dataset.id);
      } else if (a === "status-order") {
        if (b.dataset.status === "cancelled" && !confirm("Cancelar este pedido? O estoque será devolvido automaticamente.")) return;
        var sr = await S.sb.rpc("change_order_status", { p_order_id: b.dataset.id, p_status: b.dataset.status });
        if (sr.error) throw sr.error;
        S.toast("Status atualizado.");
        S.closeModal();
        await S.loadPage();
      } else if (a === "payment-order") {
        var question = b.dataset.status === "refunded" ? "Registrar o reembolso e cancelar a receita vinculada?" : "Marcar este pedido como pago?";
        if (!confirm(question)) return;
        var pr = await S.sb.rpc("set_order_payment_status", { p_order_id: b.dataset.id, p_payment_status: b.dataset.status });
        if (pr.error) throw pr.error;
        S.toast("Pagamento atualizado.");
        S.closeModal();
        await S.loadPage();
      } else if (a === "delete-finance") {
        if (!confirm("Excluir este lançamento manual?")) return;
        var dr = await S.sb.from("financial_transactions").delete().eq("id", b.dataset.id);
        if (dr.error) throw dr.error;
        S.toast("Lançamento excluído.");
        await S.pageFinance();
      } else if (a === "export") {
        await S.exportKind(b.dataset.kind);
        S.toast("Arquivo CSV gerado.");
      }
    } catch (err) {
      S.toast(S.errText(err), "error");
    }
  });

  document.addEventListener("change", async function (ev) {
    var t = ev.target;
    try {
      if (t.id === "orgSelect") {
        S.state.orgId = t.value;
        S.state.role = S.state.roles[S.state.orgId];
        S.state.page = "dashboard";
        S.state.data = {};
        S.renderShell();
        await S.loadPage();
      } else if (t.classList.contains("order-product")) {
        var opt = t.selectedOptions[0];
        var row = t.closest(".order-line");
        if (row && opt && opt.dataset.price) row.querySelector(".order-price").value = Number(opt.dataset.price).toFixed(2);
        S.updateEstimate();
      } else if (t.id === "orderStatus") filterOrders();
      else if (t.id === "stockFilter") filterProducts();
    } catch (err) {
      S.toast(S.errText(err), "error");
    }
  });

  document.addEventListener("input", function (ev) {
    var t = ev.target;
    if (t.closest("#orderForm")) S.updateEstimate();
    if (t.id === "orderSearch") filterOrders();
    if (t.id === "productSearch") filterProducts();
    if (t.id === "customerSearch") filterCustomers();
  });

  document.addEventListener("submit", async function (ev) {
    var form = ev.target.closest("form[data-form]");
    if (!form) return;
    ev.preventDefault();
    S.busy(form, true);
    var f = formData(form);

    try {
      if (form.dataset.form === "login") {
        var login = await S.sb.auth.signInWithPassword({ email: String(f.email).trim(), password: String(f.password) });
        if (login.error) throw login.error;
      } else if (form.dataset.form === "signup") {
        if (f.password !== f.confirm) throw new Error("As senhas não coincidem.");
        if (String(f.password).length < 10) throw new Error("A senha deve ter pelo menos 10 caracteres.");
        var signup = await S.sb.auth.signUp({
          email: String(f.email).trim(),
          password: String(f.password),
          options: { emailRedirectTo: location.origin + location.pathname }
        });
        if (signup.error) throw signup.error;
        if (!signup.data.session) {
          S.toast("Conta criada. Confirme o e-mail antes de entrar.");
          S.renderAuth("login");
        }
      } else if (form.dataset.form === "forgot") {
        var forgot = await S.sb.auth.resetPasswordForEmail(String(f.email).trim(), { redirectTo: location.origin + location.pathname });
        if (forgot.error) throw forgot.error;
        S.toast("Se o e-mail estiver cadastrado, o link de recuperação será enviado.");
        S.renderAuth("login");
      } else if (form.dataset.form === "recovery") {
        if (f.password !== f.confirm) throw new Error("As senhas não coincidem.");
        if (String(f.password).length < 10) throw new Error("A senha deve ter pelo menos 10 caracteres.");
        var recovery = await S.sb.auth.updateUser({ password: String(f.password) });
        if (recovery.error) throw recovery.error;
        S.state.recovery = false;
        S.toast("Senha atualizada.");
        await S.loadContext();
      } else if (form.dataset.form === "onboarding") {
        var onboard = await S.sb.rpc("create_workspace", { p_name: String(f.name).trim() });
        if (onboard.error) throw onboard.error;
        S.toast("Empresa criada.");
        await S.loadContext();
      } else if (form.dataset.form === "order") {
        var lines = Array.from(form.querySelectorAll(".order-line"));
        if (!lines.length) throw new Error("Adicione ao menos um item.");
        var items = lines.map(function (row) {
          return {
            product_id: row.querySelector(".order-product").value,
            quantity: Number(row.querySelector(".order-qty").value),
            unit_price: Number(row.querySelector(".order-price").value)
          };
        });
        if (items.some(function (x) { return !x.product_id || !Number.isInteger(x.quantity) || x.quantity <= 0 || x.unit_price < 0; })) throw new Error("Revise os itens do pedido.");
        if (new Set(items.map(function (x) { return x.product_id; })).size !== items.length) throw new Error("O mesmo produto não pode aparecer duas vezes. Some as quantidades em uma única linha.");

        var params = {
          p_organization_id: S.state.orgId,
          p_store_id: f.store_id || null,
          p_customer_id: f.customer_id || null,
          p_external_id: f.external_id || null,
          p_payment_status: f.payment_status,
          p_due_at: f.due_at ? S.zonedInputToIso(f.due_at) : null,
          p_sold_at: f.sold_at ? S.zonedInputToIso(f.sold_at) : new Date().toISOString(),
          p_shipping: Number(f.shipping) || 0,
          p_discount: Number(f.discount) || 0,
          p_tracking_code: f.tracking_code || null,
          p_notes: f.notes || null,
          p_items: items
        };
        var order = await S.sb.rpc("create_order", params);
        if (order.error) throw order.error;
        S.toast("Pedido salvo e estoque atualizado.");
        S.closeModal();
        S.state.page = "orders";
        S.renderShell();
        await S.pageOrders();
      } else if (form.dataset.form === "product") {
        var productId = form.dataset.id;
        var productObj = {
          sku: String(f.sku).trim(),
          name: String(f.name).trim(),
          cost: Number(f.cost),
          price: Number(f.price),
          min_stock: Number(f.min_stock)
        };
        var productRes;
        if (productId) {
          productObj.active = f.active === "true";
          productRes = await S.sb.from("products").update(productObj).eq("id", productId);
        } else {
          productObj.organization_id = S.state.orgId;
          productObj.stock = Number(f.stock);
          productRes = await S.sb.from("products").insert(productObj);
        }
        if (productRes.error) throw productRes.error;
        S.toast("Produto salvo.");
        S.closeModal();
        await S.pageProducts();
      } else if (form.dataset.form === "stock") {
        var delta = Number(f.delta);
        if (!Number.isInteger(delta) || delta === 0) throw new Error("Informe uma quantidade inteira diferente de zero.");
        var stockRes = await S.sb.rpc("adjust_stock", {
          p_product_id: form.dataset.id,
          p_delta: delta,
          p_notes: String(f.notes).trim(),
          p_movement_type: f.movement_type
        });
        if (stockRes.error) throw stockRes.error;
        S.toast("Estoque ajustado e movimento registrado.");
        S.closeModal();
        await S.pageProducts();
      } else if (form.dataset.form === "customer") {
        var customerObj = {
          name: String(f.name).trim(),
          email: String(f.email || "").trim() || null,
          phone: String(f.phone || "").trim() || null,
          document: String(f.document || "").trim() || null,
          notes: String(f.notes || "").trim() || null
        };
        var customerRes = form.dataset.id ? await S.sb.from("customers").update(customerObj).eq("id", form.dataset.id) :
          await S.sb.from("customers").insert(Object.assign({}, customerObj, { organization_id: S.state.orgId }));
        if (customerRes.error) throw customerRes.error;
        S.toast("Cliente salvo.");
        S.closeModal();
        await S.pageCustomers();
      } else if (form.dataset.form === "finance") {
        var financeObj = {
          organization_id: S.state.orgId,
          kind: f.kind,
          category: String(f.category).trim(),
          description: String(f.description).trim(),
          amount: Number(f.amount),
          occurred_on: f.occurred_on,
          status: f.status,
          created_by: S.state.session.user.id
        };
        var financeRes = await S.sb.from("financial_transactions").insert(financeObj);
        if (financeRes.error) throw financeRes.error;
        S.toast("Lançamento salvo.");
        S.closeModal();
        await S.pageFinance();
      } else if (form.dataset.form === "store") {
        var storeObj = {
          name: String(f.name).trim(),
          marketplace: f.marketplace,
          external_account_id: String(f.external_account_id || "").trim() || null
        };
        if (form.dataset.id) storeObj.active = f.active === "true";
        var storeRes = form.dataset.id ? await S.sb.from("stores").update(storeObj).eq("id", form.dataset.id) :
          await S.sb.from("stores").insert(Object.assign({}, storeObj, { organization_id: S.state.orgId }));
        if (storeRes.error) throw storeRes.error;
        S.toast("Loja salva.");
        S.closeModal();
        await S.pageStores();
      } else if (form.dataset.form === "order-meta") {
        var meta = await S.sb.rpc("update_order_metadata", {
          p_order_id: form.dataset.id,
          p_due_at: f.due_at ? S.zonedInputToIso(f.due_at) : null,
          p_tracking_code: f.tracking_code || null,
          p_notes: f.notes || null
        });
        if (meta.error) throw meta.error;
        S.toast("Dados operacionais atualizados.");
        S.closeModal();
        await S.loadPage();
      }
    } catch (err) {
      S.toast(S.errText(err), "error");
    } finally {
      if (document.body.contains(form)) S.busy(form, false);
    }
  });
})();
