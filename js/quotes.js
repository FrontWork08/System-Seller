(function () {
  "use strict";
  var S = window.SS;
  if (!S) return;

  var labels = { draft:"Rascunho", sent:"Enviado", approved:"Aprovado", rejected:"Rejeitado", cancelled:"Cancelado", converted:"Convertido" };
  function badge(status) {
    var type = status === "approved" || status === "converted" ? "ok" : status === "rejected" || status === "cancelled" ? "danger" : status === "sent" ? "info" : "";
    return S.badge(labels[status] || status, type);
  }
  function productOptions(products) {
    return products.filter(function (p) { return p.active; }).map(function (p) {
      return '<option value="' + p.id + '" data-price="' + Number(p.price) + '">' + S.e(p.sku + ' · ' + p.name) + '</option>';
    }).join('');
  }
  function quoteLine(products) {
    return '<div class="order-line quote-line"><div class="field"><label>Produto</label><select class="quote-product" required><option value="">Selecione</option>' + productOptions(products) + '</select></div>' +
      '<div class="field"><label>Qtd.</label><input class="quote-qty" type="number" min="1" step="1" value="1" required></div>' +
      '<div class="field"><label>Preço</label><input class="quote-price" type="number" min="0" step="0.01" value="0" required><small class="meta quote-price-hint"></small></div>' +
      '<button class="danger-btn mini" type="button" data-modular-action="remove-quote-line">×</button></div>';
  }
  function updateTotal() {
    var form = document.getElementById("quoteForm");
    if (!form) return;
    var subtotal = 0;
    form.querySelectorAll('.quote-line').forEach(function (row) {
      subtotal += (Number(row.querySelector('.quote-qty').value) || 0) * (Number(row.querySelector('.quote-price').value) || 0);
    });
    var total = Math.max(0, subtotal + (Number(form.elements.shipping.value) || 0) - (Number(form.elements.discount.value) || 0));
    var out = document.getElementById('quoteTotal');
    if (out) out.textContent = S.money(total);
  }
  async function applyPrice(row) {
    if (!row) return;
    var form = document.getElementById('quoteForm');
    var select = row.querySelector('.quote-product');
    var input = row.querySelector('.quote-price');
    var hint = row.querySelector('.quote-price-hint');
    var opt = select && select.selectedOptions[0];
    if (!opt || !select.value) return;
    var standard = Number(opt.dataset.price || 0);
    var customer = form && form.elements.customer_id ? form.elements.customer_id.value : '';
    var special = customer ? await S.getCustomerPrice(customer, select.value) : null;
    input.value = Number(special == null ? standard : special).toFixed(2);
    if (hint) hint.textContent = special == null ? 'Preço padrão' : 'Preço especial do cliente';
    updateTotal();
  }

  S.pageQuotes = async function () {
    var page = document.getElementById('page');
    var core = await S.getCore();
    var res = await S.sb.from('quotes').select('*').eq('organization_id', S.state.orgId).order('created_at', { ascending:false });
    if (res.error) throw res.error;
    var cm = {}, sm = {};
    core.customers.forEach(function (x) { cm[x.id] = x.name; });
    core.stores.forEach(function (x) { sm[x.id] = x.name; });
    var rows = res.data || [];
    page.innerHTML = '<div class="page-head"><div><h2>Orçamentos</h2><p>Crie, aprove e converta orçamentos em pedidos sem duplicação.</p></div>' + (S.canWrite() ? '<button class="primary" data-modular-action="new-quote">+ Novo orçamento</button>' : '') + '</div>' +
      '<div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Orçamento</th><th>Cliente</th><th>Loja</th><th>Status</th><th>Validade</th><th>Total</th><th>Criado</th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (q) {
        var expired = q.valid_until && q.status !== 'converted' && q.status !== 'cancelled' && new Date(q.valid_until + 'T23:59:59') < new Date();
        return '<tr><td><button class="link-btn" data-modular-action="view-quote" data-id="' + q.id + '">#' + q.id.slice(0,8) + '</button></td><td>' + S.e(cm[q.customer_id] || '—') + '</td><td>' + S.e(sm[q.store_id] || '—') + '</td><td>' + badge(q.status) + '</td><td class="' + (expired ? 'quote-expired' : '') + '">' + (q.valid_until ? S.day(q.valid_until) : 'Sem vencimento') + (expired ? ' · expirado' : '') + '</td><td>' + S.money(q.total) + '</td><td>' + S.dt(q.created_at) + '</td></tr>';
      }).join('') : '<tr><td colspan="7"><div class="empty"><strong>Nenhum orçamento</strong>Crie o primeiro orçamento para um cliente.</div></td></tr>') + '</tbody></table></div></div>';
  };

  S.openQuoteForm = async function () {
    var core = await S.getCore();
    var active = core.products.filter(function (x) { return x.active; });
    if (!active.length) throw new Error('Cadastre ao menos um produto ativo antes de criar um orçamento.');
    var stores = '<option value="">Sem loja</option>' + core.stores.filter(function (x) { return x.active; }).map(function (x) { return '<option value="' + x.id + '">' + S.e(x.name) + '</option>'; }).join('');
    var customers = '<option value="">Sem cliente</option>' + core.customers.map(function (x) { return '<option value="' + x.id + '">' + S.e(x.name) + '</option>'; }).join('');
    S.modal('Novo orçamento', '<form data-modular-form="quote-create" id="quoteForm"><div class="form-grid">' +
      '<div class="field"><label>Cliente</label><select name="customer_id"><option value="">Sem cliente</option>' + customers.replace('<option value="">Sem cliente</option>','') + '</select></div>' +
      '<div class="field"><label>Loja / canal</label><select name="store_id">' + stores + '</select></div>' +
      '<div class="field"><label>Validade</label><input name="valid_until" type="date"></div>' +
      '<div class="field"><label>Prazo de entrega</label><input name="delivery_due_at" type="datetime-local"></div>' +
      '<div class="field"><label>Frete</label><input name="shipping" type="number" min="0" step="0.01" value="0"></div>' +
      '<div class="field"><label>Desconto</label><input name="discount" type="number" min="0" step="0.01" value="0"></div></div>' +
      '<div class="section-title">Itens</div><div id="quoteLines">' + quoteLine(active) + '</div><button class="ghost" type="button" data-modular-action="add-quote-line">+ Adicionar item</button>' +
      '<div class="section-title">Resumo</div><div class="statline"><span>Total</span><strong id="quoteTotal">' + S.money(0) + '</strong></div>' +
      '<div class="field"><label>Observações</label><textarea name="notes" maxlength="2000"></textarea></div>' +
      '<div class="actions right"><button class="primary" type="submit">Salvar orçamento</button></div></form>', true);
  };

  S.showQuote = async function (id) {
    var jobs = await Promise.all([
      S.sb.from('quotes').select('*').eq('id', id).eq('organization_id', S.state.orgId).single(),
      S.sb.from('quote_items').select('*').eq('quote_id', id).order('created_at'),
      S.sb.from('quote_status_history').select('*').eq('quote_id', id).order('changed_at', { ascending:false }),
      S.getCore()
    ]);
    if (jobs[0].error) throw jobs[0].error;
    if (jobs[1].error) throw jobs[1].error;
    if (jobs[2].error) throw jobs[2].error;
    var q = jobs[0].data, items = jobs[1].data || [], hist = jobs[2].data || [], core = jobs[3];
    var customer = core.customers.find(function (x) { return x.id === q.customer_id; });
    var store = core.stores.find(function (x) { return x.id === q.store_id; });
    var actions = '';
    if (S.canWrite() && q.status !== 'converted') {
      if (q.status === 'draft') actions += '<button class="secondary" data-modular-action="quote-status" data-id="' + q.id + '" data-status="sent">Marcar enviado</button>';
      if (q.status === 'draft' || q.status === 'sent') actions += '<button class="primary" data-modular-action="quote-status" data-id="' + q.id + '" data-status="approved">Aprovar</button>';
      if (q.status !== 'cancelled') actions += '<button class="danger-btn" data-modular-action="quote-status" data-id="' + q.id + '" data-status="cancelled">Cancelar</button>';
      if (q.status === 'approved') actions += '<button class="primary" data-modular-action="convert-quote" data-id="' + q.id + '">Converter em pedido</button>';
    }
    actions += '<button class="ghost" data-modular-action="print-quote" data-id="' + q.id + '">Imprimir / salvar PDF</button>';
    var body = '<div class="actions">' + actions + '</div><div class="section-title">Resumo</div>' +
      '<div class="modular-grid"><div class="card"><div class="k">Cliente</div><div class="s">' + S.e(customer ? customer.name : '—') + '</div></div><div class="card"><div class="k">Loja</div><div class="s">' + S.e(store ? store.name : '—') + '</div></div><div class="card"><div class="k">Status</div><div class="s">' + badge(q.status) + '</div></div></div>' +
      '<div class="section-title">Itens</div><div class="table-wrap"><table class="table"><thead><tr><th>Item</th><th>Qtd.</th><th>Preço</th><th>Total</th></tr></thead><tbody>' + items.map(function (x) { return '<tr><td>' + S.e(x.sku + ' · ' + x.name) + '</td><td>' + x.quantity + '</td><td>' + S.money(x.unit_price) + '</td><td>' + S.money(x.line_total) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="statline"><span>Subtotal</span><strong>' + S.money(q.subtotal) + '</strong></div><div class="statline"><span>Frete</span><strong>' + S.money(q.shipping) + '</strong></div><div class="statline"><span>Desconto</span><strong>-' + S.money(q.discount) + '</strong></div><div class="statline"><span>Total</span><strong>' + S.money(q.total) + '</strong></div>' +
      '<div class="section-title">Observações</div><div class="note">' + S.e(q.notes || 'Sem observações.') + '</div>' +
      '<div class="section-title">Anexos</div><div id="quoteAttachments"></div>' +
      '<div class="section-title">Histórico</div><div class="compact-list">' + (hist.length ? hist.map(function (h) { return '<div><strong>' + S.e(labels[h.status] || h.status) + '</strong><small class="muted">' + S.dt(h.changed_at) + '</small></div>'; }).join('') : '<div class="muted">Sem histórico registrado.</div>') + '</div>';
    S.modal('Orçamento #' + q.id.slice(0,8), body, true);
    if (S.renderAttachmentsPanel) await S.renderAttachmentsPanel('quote', q.id, 'quoteAttachments');
  };

  document.addEventListener('click', async function (ev) {
    var b = ev.target.closest('[data-modular-action]');
    if (!b) return;
    try {
      var action = b.dataset.modularAction;
      if (action === 'new-quote') await S.openQuoteForm();
      else if (action === 'add-quote-line') {
        var core = await S.getCore();
        document.getElementById('quoteLines').insertAdjacentHTML('beforeend', quoteLine(core.products));
      } else if (action === 'remove-quote-line') {
        var rows = document.querySelectorAll('.quote-line');
        if (rows.length <= 1) return;
        b.closest('.quote-line').remove(); updateTotal();
      } else if (action === 'view-quote') await S.showQuote(b.dataset.id);
      else if (action === 'quote-status') {
        var r = await S.sb.rpc('set_quote_status', { p_quote_id:b.dataset.id, p_status:b.dataset.status });
        if (r.error) throw r.error;
        S.toast('Status do orçamento atualizado.'); await S.showQuote(b.dataset.id);
      } else if (action === 'convert-quote') {
        if (!confirm('Converter este orçamento em pedido?')) return;
        var c = await S.sb.rpc('convert_quote_to_order', { p_quote_id:b.dataset.id });
        if (c.error) throw c.error;
        S.toast('Orçamento convertido em pedido.'); S.closeModal(); S.state.page='orders'; S.renderShell(); await S.loadPage();
      } else if (action === 'print-quote' && S.printBusinessDocument) await S.printBusinessDocument('quote', b.dataset.id);
    } catch (err) { S.toast(S.errText(err), 'error'); }
  });

  document.addEventListener('change', async function (ev) {
    var t = ev.target;
    try {
      if (t.classList.contains('quote-product')) await applyPrice(t.closest('.quote-line'));
      else if (t.closest('#quoteForm') && t.name === 'customer_id') {
        var rows = document.querySelectorAll('.quote-line');
        for (var i=0;i<rows.length;i++) if (rows[i].querySelector('.quote-product').value) await applyPrice(rows[i]);
      }
    } catch (err) { S.toast(S.errText(err),'error'); }
  });
  document.addEventListener('input', function (ev) { if (ev.target.closest('#quoteForm')) updateTotal(); });

  document.addEventListener('submit', async function (ev) {
    var form = ev.target.closest('form[data-modular-form="quote-create"]');
    if (!form) return;
    ev.preventDefault(); S.busy(form,true);
    try {
      var f = Object.fromEntries(new FormData(form).entries());
      var items = Array.from(form.querySelectorAll('.quote-line')).map(function (row) { return { product_id:row.querySelector('.quote-product').value, quantity:Number(row.querySelector('.quote-qty').value), unit_price:Number(row.querySelector('.quote-price').value) }; });
      if (!items.length || items.some(function (x) { return !x.product_id || !Number.isInteger(x.quantity) || x.quantity <= 0 || x.unit_price < 0; })) throw new Error('Revise os itens do orçamento.');
      if (new Set(items.map(function (x) { return x.product_id; })).size !== items.length) throw new Error('O mesmo produto não pode aparecer duas vezes.');
      var payload = { store_id:f.store_id || null, customer_id:f.customer_id || null, valid_until:f.valid_until || null, delivery_due_at:f.delivery_due_at ? S.zonedInputToIso(f.delivery_due_at) : null, shipping:Number(f.shipping)||0, discount:Number(f.discount)||0, notes:f.notes||null, items:items };
      if (!navigator.onLine && S.queueOfflineMutation) {
        await S.queueOfflineMutation('quote_create', payload, null);
        S.toast('Orçamento salvo na fila offline.');
      } else {
        var res = await S.sb.rpc('create_quote', { p_organization_id:S.state.orgId, p_store_id:payload.store_id, p_customer_id:payload.customer_id, p_valid_until:payload.valid_until, p_delivery_due_at:payload.delivery_due_at, p_shipping:payload.shipping, p_discount:payload.discount, p_notes:payload.notes, p_items:payload.items });
        if (res.error) throw res.error;
        S.toast('Orçamento criado.');
      }
      S.closeModal(); await S.pageQuotes();
    } catch (err) { S.toast(S.errText(err),'error'); }
    finally { if (document.body.contains(form)) S.busy(form,false); }
  });
})();
