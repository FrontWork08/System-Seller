(function () {
  "use strict";
  var S = window.SS;
  if (!S) return;

  var paymentLabels = {
    pix: "Pix",
    cash: "Dinheiro",
    credit_card: "Cartão de crédito",
    debit_card: "Cartão de débito",
    bank_transfer: "Transferência bancária",
    boleto: "Boleto",
    other: "Outro"
  };

  S.paymentMethodLabel = function (value) {
    return paymentLabels[value] || "Não informado";
  };

  function paymentOptions(selected) {
    selected = selected || "pix";
    return Object.keys(paymentLabels).map(function (key) {
      return '<option value="' + key + '"' + (key === selected ? " selected" : "") + '>' + S.e(paymentLabels[key]) + "</option>";
    }).join("");
  }

  function productOptions(products) {
    return products.filter(function (p) { return p.active; }).map(function (p) {
      return '<option value="' + p.id + '" data-price="' + Number(p.price) + '">' +
        S.e(p.sku + " · " + p.name + " · estoque " + p.stock) + "</option>";
    }).join("");
  }

  S.orderLine = function (products) {
    return '<div class="order-line">' +
      '<div class="field"><label>Produto</label><select class="order-product" required><option value="">Selecione</option>' + productOptions(products) + '</select></div>' +
      '<div class="field"><label>Qtd.</label><input class="order-qty" type="number" min="1" step="1" value="1" required></div>' +
      '<div class="field"><label>Preço cobrado</label><input class="order-price" type="number" min="0" step="0.01" value="0" required readonly>' +
      '<label class="meta"><input class="order-custom-price" type="checkbox"> Usar preço personalizado</label>' +
      '<div class="meta order-price-hint">Selecione um produto para carregar o preço padrão.</div></div>' +
      '<button class="danger-btn mini" type="button" data-action="remove-line" aria-label="Remover">×</button></div>';
  };

  function updatePriceHint(row) {
    if (!row) return;
    var select = row.querySelector(".order-product");
    var input = row.querySelector(".order-price");
    var toggle = row.querySelector(".order-custom-price");
    var hint = row.querySelector(".order-price-hint");
    var opt = select && select.selectedOptions ? select.selectedOptions[0] : null;
    var standard = opt && opt.dataset && opt.dataset.price !== undefined ? Number(opt.dataset.price) : null;
    if (input && standard !== null && isFinite(standard)) input.dataset.standardPrice = standard.toFixed(2);
    if (!hint) return;
    if (standard === null || !isFinite(standard)) {
      hint.textContent = "Selecione um produto para carregar o preço padrão.";
    } else if (toggle && toggle.checked) {
      hint.textContent = "Preço personalizado neste pedido · padrão " + S.money(standard) + ".";
    } else {
      hint.textContent = "Preço padrão do produto: " + S.money(standard) + ".";
    }
  }

  S.updateEstimate = function () {
    var form = document.getElementById("orderForm");
    if (!form) return;
    var subtotal = 0;
    form.querySelectorAll(".order-line").forEach(function (row) {
      subtotal += (Number(row.querySelector(".order-qty").value) || 0) * (Number(row.querySelector(".order-price").value) || 0);
    });
    var shipping = Number(form.elements.shipping && form.elements.shipping.value) || 0;
    var discount = Number(form.elements.discount && form.elements.discount.value) || 0;
    var total = Math.max(0, subtotal + shipping - discount);
    var initial = Number(form.elements.initial_payment && form.elements.initial_payment.value) || 0;
    initial = Math.max(0, initial);
    var balance = Math.max(0, total - initial);
    var totalOut = document.getElementById("orderEstimate");
    var paidOut = document.getElementById("orderInitialPaid");
    var balanceOut = document.getElementById("orderBalance");
    if (totalOut) totalOut.textContent = S.money(total);
    if (paidOut) paidOut.textContent = S.money(initial);
    if (balanceOut) balanceOut.textContent = S.money(balance);
    if (form.elements.initial_payment) form.elements.initial_payment.max = total.toFixed(2);
  };

  S.openOrderForm = async function () {
    var core = await S.getCore();
    var active = core.products.filter(function (x) { return x.active; });
    S.state.data.products = core.products;
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

    var paymentBlock = S.canAdmin() ?
      '<div class="section-title">Pagamento inicial</div>' +
      '<div class="note">Você pode registrar uma entrada agora e completar depois. Ex.: pedido de R$ 90,00 com R$ 30,00 via Pix ficará com R$ 60,00 em aberto.</div><br>' +
      '<div class="form-grid">' +
      '<div class="field"><label>Valor recebido agora</label><input name="initial_payment" type="number" min="0" step="0.01" value="0"></div>' +
      '<div class="field"><label>Forma de pagamento</label><select name="payment_method">' + paymentOptions("pix") + '</select></div>' +
      '<div class="field"><label>Data/hora do pagamento</label><input name="payment_paid_at" type="datetime-local" value="' + S.localInput(new Date()) + '"></div>' +
      '<div class="field"><label>Observação do pagamento</label><input name="payment_notes" maxlength="180" placeholder="Ex.: Entrada de 30%"></div></div>' :
      '<div class="note">Pagamentos podem ser registrados por proprietários e administradores depois que o pedido for criado.</div>';

    var body = '<form data-form="order-v2" id="orderForm"><div class="form-grid">' +
      '<div class="field"><label>Loja</label><select name="store_id">' + stores + '</select></div>' +
      '<div class="field"><label>Cliente</label><select name="customer_id">' + customers + '</select></div>' +
      '<div class="field"><label>Código externo</label><input name="external_id" maxlength="120" placeholder="Ex.: ML-12345"></div>' +
      '<div class="field"><label>Prazo de envio</label><input name="due_at" type="datetime-local"></div>' +
      '<div class="field"><label>Data da venda</label><input name="sold_at" type="datetime-local" value="' + S.localInput(new Date()) + '"></div>' +
      '<div class="field"><label>Frete</label><input name="shipping" type="number" min="0" step="0.01" value="0"></div>' +
      '<div class="field"><label>Desconto</label><input name="discount" type="number" min="0" step="0.01" value="0"></div>' +
      '<div class="field span2"><label>Rastreio</label><input name="tracking_code" maxlength="160"></div></div>' +
      '<div class="section-title">Itens</div><div class="note">O preço padrão é carregado automaticamente. Marque <strong>Usar preço personalizado</strong> quando o valor daquele cliente ou serviço for diferente.</div><br>' +
      '<div id="orderLines">' + S.orderLine(active) + '</div>' +
      '<button class="ghost" type="button" data-action="add-line">+ Adicionar item</button>' +
      '<div class="section-title">Resumo</div>' +
      '<div class="statline"><span>Total do pedido</span><strong id="orderEstimate">' + S.money(0) + '</strong></div>' +
      '<div class="statline"><span>Recebido na criação</span><strong id="orderInitialPaid">' + S.money(0) + '</strong></div>' +
      '<div class="statline"><span>Saldo restante</span><strong id="orderBalance">' + S.money(0) + '</strong></div>' +
      paymentBlock +
      '<div class="field"><label>Observações do pedido</label><textarea name="notes" maxlength="2000"></textarea></div>' +
      '<div class="actions right"><button class="primary" type="submit">Salvar pedido</button></div></form>';
    S.modal("Novo pedido", body, true);
    S.updateEstimate();
  };

  S.openOrderPaymentForm = function (order) {
    var paid = Number(order.paid_amount || 0);
    var total = Number(order.total || 0);
    var balance = Math.max(0, total - paid);
    if (balance <= 0) {
      S.toast("Este pedido já está totalmente pago.", "error");
      return;
    }
    var body = '<form data-form="order-payment-v2" data-order-id="' + order.id + '">' +
      '<div class="note">Total: <strong>' + S.money(total) + '</strong> · recebido: <strong>' + S.money(paid) + '</strong> · falta: <strong>' + S.money(balance) + '</strong></div><br>' +
      '<div class="form-grid"><div class="field"><label>Valor recebido</label><input name="amount" type="number" min="0.01" max="' + balance.toFixed(2) + '" step="0.01" value="' + balance.toFixed(2) + '" required></div>' +
      '<div class="field"><label>Forma de pagamento</label><select name="payment_method">' + paymentOptions("pix") + '</select></div>' +
      '<div class="field"><label>Data/hora</label><input name="paid_at" type="datetime-local" value="' + S.localInput(new Date()) + '" required></div>' +
      '<div class="field"><label>Observação</label><input name="notes" maxlength="180" placeholder="Ex.: segunda parcela"></div></div>' +
      '<div class="actions right"><button class="primary" type="submit">Registrar pagamento</button></div></form>';
    S.modal("Registrar pagamento", body, true);
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

    return '<div class="table-wrap"><table class="table"><thead><tr><th>Pedido</th><th>Loja</th><th>Cliente</th><th>Status</th><th>Pagamento</th><th>Prazo</th><th>Total</th><th>Em aberto</th></tr></thead><tbody>' +
      rows.map(function (o) {
        var late = o.due_at && new Date(o.due_at) < new Date() && ["shipped", "delivered", "cancelled"].indexOf(o.status) === -1;
        var paid = Number(o.paid_amount || 0);
        var balance = Math.max(0, Number(o.total || 0) - paid);
        return '<tr><td><button class="link-btn" data-action="view-order" data-id="' + o.id + '">' + S.e(o.external_id || o.id.slice(0, 8)) + '</button></td><td>' +
          S.e(sm[o.store_id] || "—") + "</td><td>" + S.e(cm[o.customer_id] || "—") + "</td><td>" + S.statusBadge(o.status) + "</td><td>" +
          S.paymentBadge(o.payment_status) + '<div class="meta">Recebido ' + S.money(paid) + '</div></td><td class="' + (late ? "overdue" : "") + '">' + S.dt(o.due_at) + "</td><td>" + S.money(o.total) + '</td><td class="' + (balance > 0 ? "low" : "") + '">' + S.money(balance) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  };

  S.showOrder = async function (id) {
    var jobs = [
      S.sb.from("orders").select("*").eq("id", id).single(),
      S.sb.from("order_items").select("*").eq("order_id", id).order("created_at"),
      S.getCore()
    ];
    if (S.canAdmin()) {
      jobs.push(S.sb.from("financial_transactions").select("id,amount,status,payment_method,paid_at,description,created_at").eq("order_id", id).eq("kind", "income").order("created_at", { ascending: true }));
    }
    var both = await Promise.all(jobs);
    if (both[0].error) throw both[0].error;
    if (both[1].error) throw both[1].error;
    if (S.canAdmin() && both[3].error) throw both[3].error;

    var o = both[0].data;
    var items = both[1].data || [];
    var core = both[2];
    var payments = S.canAdmin() ? (both[3].data || []) : [];
    var store = (core.stores || []).find(function (x) { return x.id === o.store_id; });
    var customer = (core.customers || []).find(function (x) { return x.id === o.customer_id; });
    var next = S.transition[o.status];
    var paid = Number(o.paid_amount || 0);
    var balance = Math.max(0, Number(o.total || 0) - paid);

    var itemList = items.map(function (i) {
      return '<div class="list-item"><div><strong>' + S.e(i.name) + '</strong><div class="meta">' + S.e(i.sku) + " · " + i.quantity + " × " + S.money(i.unit_price) + "</div></div><strong>" + S.money(i.line_total) + "</strong></div>";
    }).join("");

    var paymentList = "";
    if (S.canAdmin()) {
      paymentList = payments.length ? payments.map(function (p) {
        var cancelled = p.status === "cancelled";
        return '<div class="list-item"><div><strong>' + S.e(S.paymentMethodLabel(p.payment_method)) + '</strong><div class="meta">' + S.dt(p.paid_at || p.created_at) + (p.description ? " · " + S.e(p.description) : "") + '</div></div><div><strong>' + S.money(p.amount) + '</strong><div class="meta">' + (cancelled ? "Estornado" : "Recebido") + "</div></div></div>";
      }).join("") : '<div class="muted">Nenhum pagamento registrado.</div>';
    }

    var actions = "";
    if (S.canWrite() && next) actions += '<button class="primary" data-action="status-order" data-id="' + o.id + '" data-status="' + next + '">Avançar para ' + S.e(S.statusLabel[next]) + "</button>";
    if (S.canWrite() && ["new", "picking", "packing", "ready"].indexOf(o.status) !== -1) actions += '<button class="danger-btn" data-action="status-order" data-id="' + o.id + '" data-status="cancelled">Cancelar pedido</button>';
    if (S.canAdmin() && balance > 0 && o.status !== "cancelled" && o.payment_status !== "refunded") actions += '<button class="secondary" data-action="record-payment-v2" data-id="' + o.id + '">Registrar pagamento</button>';
    if (S.canAdmin() && paid > 0 && ["partial", "paid"].indexOf(o.payment_status) !== -1) actions += '<button class="danger-btn" data-action="payment-order" data-id="' + o.id + '" data-status="refunded">Registrar reembolso</button>';
    if (S.canWrite()) actions += '<button class="ghost" data-action="edit-order-meta" data-id="' + o.id + '">Editar prazo/rastreio</button>';

    var body = '<div class="grid2"><div><div class="section-title">Itens</div><div class="list">' + itemList + '</div></div><div><div class="section-title">Resumo</div>' +
      '<div class="statline"><span>Status</span>' + S.statusBadge(o.status) + '</div><div class="statline"><span>Pagamento</span>' + S.paymentBadge(o.payment_status) + '</div>' +
      '<div class="statline"><span>Loja</span><strong>' + S.e(store ? store.name : "—") + '</strong></div><div class="statline"><span>Cliente</span><strong>' + S.e(customer ? customer.name : "—") + '</strong></div>' +
      '<div class="statline"><span>Venda</span><strong>' + S.dt(o.sold_at) + '</strong></div><div class="statline"><span>Prazo</span><strong>' + S.dt(o.due_at) + '</strong></div>' +
      '<div class="statline"><span>Subtotal</span><strong>' + S.money(o.subtotal) + '</strong></div><div class="statline"><span>Frete</span><strong>' + S.money(o.shipping) + '</strong></div>' +
      '<div class="statline"><span>Desconto</span><strong>' + S.money(o.discount) + '</strong></div><div class="statline"><span>Total</span><strong>' + S.money(o.total) + '</strong></div>' +
      '<div class="statline"><span>Recebido</span><strong>' + S.money(paid) + '</strong></div><div class="statline"><span>Saldo restante</span><strong>' + S.money(balance) + '</strong></div>' +
      '<div class="statline"><span>Rastreio</span><strong>' + S.e(o.tracking_code || "—") + "</strong></div></div></div>" +
      (S.canAdmin() ? '<div class="section-title">Histórico de pagamentos</div><div class="list">' + paymentList + "</div>" : "") +
      (o.notes ? '<div class="section-title">Observações</div><div class="note">' + S.e(o.notes) + "</div>" : "") +
      '<div class="section-title">Ações</div><div class="actions">' + actions + "</div>";

    S.modal("Pedido " + (o.external_id || o.id.slice(0, 8)), body, true);
  };

  S.financeTable = function (rows) {
    if (!rows.length) return S.empty("Nenhum lançamento", "Receitas de pedidos pagos aparecem automaticamente aqui.");
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Forma</th><th>Status</th><th>Valor</th><th></th></tr></thead><tbody>' +
      rows.map(function (x) {
        var status = x.status === "paid" ? S.badge("Pago", "ok") : x.status === "planned" ? S.badge("Planejado", "warn") : S.badge("Cancelado", "danger");
        return "<tr><td>" + S.day(x.occurred_on) + "</td><td>" + (x.kind === "income" ? S.badge("Receita", "ok") : S.badge("Despesa", "danger")) + "</td><td>" +
          S.e(x.category) + "</td><td>" + S.e(x.description) + (x.order_id ? ' <span class="muted">(pedido)</span>' : "") + "</td><td>" +
          (x.payment_method ? S.e(S.paymentMethodLabel(x.payment_method)) : "—") + "</td><td>" + status +
          '</td><td class="money ' + (x.kind === "income" ? "pos" : "neg") + '">' + (x.kind === "income" ? "+" : "-") + " " + S.money(x.amount) + "</td><td>" +
          (!x.order_id ? '<button class="ghost mini" data-action="delete-finance" data-id="' + x.id + '">Excluir</button>' : "") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  };

  document.addEventListener("change", function (ev) {
    var t = ev.target;
    if (t.classList.contains("order-product")) {
      var row = t.closest(".order-line");
      var opt = t.selectedOptions && t.selectedOptions[0];
      var price = row && row.querySelector(".order-price");
      var toggle = row && row.querySelector(".order-custom-price");
      if (price && opt && opt.dataset.price !== undefined) {
        price.value = Number(opt.dataset.price || 0).toFixed(2);
        price.dataset.standardPrice = price.value;
        price.readOnly = true;
      }
      if (toggle) toggle.checked = false;
      updatePriceHint(row);
      S.updateEstimate();
    } else if (t.classList.contains("order-custom-price")) {
      var customRow = t.closest(".order-line");
      var customPrice = customRow && customRow.querySelector(".order-price");
      if (!customPrice) return;
      customPrice.readOnly = !t.checked;
      if (!t.checked && customPrice.dataset.standardPrice !== undefined) customPrice.value = customPrice.dataset.standardPrice;
      updatePriceHint(customRow);
      S.updateEstimate();
      if (t.checked) customPrice.focus();
    }
  }, true);

  document.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-action='record-payment-v2']");
    if (!b) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    S.sb.from("orders").select("id,total,paid_amount,payment_status,status").eq("id", b.dataset.id).single().then(function (res) {
      if (res.error) throw res.error;
      S.openOrderPaymentForm(res.data);
    }).catch(function (err) {
      S.toast(S.errText(err), "error");
    });
  }, true);

  document.addEventListener("submit", async function (ev) {
    var form = ev.target.closest("form[data-form='order-v2'], form[data-form='order-payment-v2']");
    if (!form) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    S.busy(form, true);

    try {
      var f = Object.fromEntries(new FormData(form).entries());
      if (form.dataset.form === "order-v2") {
        var lines = Array.from(form.querySelectorAll(".order-line"));
        if (!lines.length) throw new Error("Adicione ao menos um item.");
        var items = lines.map(function (row) {
          return {
            product_id: row.querySelector(".order-product").value,
            quantity: Number(row.querySelector(".order-qty").value),
            unit_price: Number(row.querySelector(".order-price").value)
          };
        });
        if (items.some(function (x) { return !x.product_id || !Number.isInteger(x.quantity) || x.quantity <= 0 || !isFinite(x.unit_price) || x.unit_price < 0; })) {
          throw new Error("Revise os itens do pedido.");
        }
        if (new Set(items.map(function (x) { return x.product_id; })).size !== items.length) {
          throw new Error("O mesmo produto não pode aparecer duas vezes. Some as quantidades em uma única linha.");
        }

        var initialPayment = S.canAdmin() ? (Number(f.initial_payment) || 0) : 0;
        if (initialPayment < 0) throw new Error("O pagamento inicial não pode ser negativo.");
        var params = {
          p_organization_id: S.state.orgId,
          p_store_id: f.store_id || null,
          p_customer_id: f.customer_id || null,
          p_external_id: f.external_id || null,
          p_due_at: f.due_at ? S.zonedInputToIso(f.due_at) : null,
          p_sold_at: f.sold_at ? S.zonedInputToIso(f.sold_at) : new Date().toISOString(),
          p_shipping: Number(f.shipping) || 0,
          p_discount: Number(f.discount) || 0,
          p_tracking_code: f.tracking_code || null,
          p_notes: f.notes || null,
          p_items: items,
          p_initial_payment: initialPayment,
          p_payment_method: initialPayment > 0 ? f.payment_method : null,
          p_payment_paid_at: initialPayment > 0 && f.payment_paid_at ? S.zonedInputToIso(f.payment_paid_at) : null,
          p_payment_notes: initialPayment > 0 ? (f.payment_notes || null) : null
        };
        var order = await S.sb.rpc("create_order_with_payment", params);
        if (order.error) throw order.error;
        S.toast(initialPayment > 0 ? "Pedido salvo com pagamento registrado." : "Pedido salvo e estoque atualizado.");
        S.closeModal();
        S.state.page = "orders";
        S.renderShell();
        await S.pageOrders();
      } else {
        var amount = Number(f.amount);
        if (!isFinite(amount) || amount <= 0) throw new Error("Informe um valor de pagamento válido.");
        var pay = await S.sb.rpc("record_order_payment", {
          p_order_id: form.dataset.orderId,
          p_amount: amount,
          p_payment_method: f.payment_method,
          p_paid_at: f.paid_at ? S.zonedInputToIso(f.paid_at) : new Date().toISOString(),
          p_notes: f.notes || null
        });
        if (pay.error) throw pay.error;
        var orderId = form.dataset.orderId;
        S.toast("Pagamento registrado e saldo atualizado.");
        S.closeModal();
        await S.showOrder(orderId);
      }
    } catch (err) {
      S.toast(S.errText(err), "error");
    } finally {
      S.busy(form, false);
    }
  }, true);
})();
