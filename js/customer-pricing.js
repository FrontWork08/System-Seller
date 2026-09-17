(function () {
  "use strict";
  var S = window.SS;
  if (!S) return;

  S.customerPriceMap = async function (customerId) {
    if (!customerId) return {};
    var res = await S.sb.from("customer_product_prices").select("id,customer_id,product_id,unit_price").eq("organization_id", S.state.orgId).eq("customer_id", customerId);
    if (res.error) throw res.error;
    var map = {};
    (res.data || []).forEach(function (x) { map[x.product_id] = x; });
    return map;
  };

  S.getCustomerPrice = async function (customerId, productId) {
    if (!customerId || !productId) return null;
    var res = await S.sb.from("customer_product_prices").select("unit_price").eq("organization_id", S.state.orgId).eq("customer_id", customerId).eq("product_id", productId).maybeSingle();
    if (res.error) throw res.error;
    return res.data ? Number(res.data.unit_price) : null;
  };

  S.pageCustomerPricing = async function () {
    var page = document.getElementById("page");
    var core = await S.getCore();
    var prices = await S.fetchAll("customer_product_prices", "*", "updated_at");
    var cm = {}, pm = {};
    core.customers.forEach(function (x) { cm[x.id] = x.name; });
    core.products.forEach(function (x) { pm[x.id] = x; });
    page.innerHTML = '<div class="page-head"><div><h2>Preços especiais</h2><p>Preço preferencial por cliente e produto. O histórico dos pedidos não é alterado.</p></div>' +
      (S.canWrite() ? '<button class="primary" data-modular-action="new-special-price">+ Novo preço</button>' : '') + '</div>' +
      '<div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Cliente</th><th>Produto</th><th>Preço padrão</th><th>Preço especial</th><th>Atualizado</th><th></th></tr></thead><tbody>' +
      (prices.length ? prices.map(function (x) {
        var p = pm[x.product_id] || {};
        return '<tr><td>' + S.e(cm[x.customer_id] || 'Cliente removido') + '</td><td>' + S.e(p.name || 'Produto removido') + '</td><td>' + S.money(p.price || 0) + '</td><td><span class="price-chip">' + S.money(x.unit_price) + '</span></td><td>' + S.dt(x.updated_at) + '</td><td>' + (S.canWrite() ? '<button class="link-btn" data-modular-action="edit-special-price" data-id="' + x.id + '" data-customer="' + x.customer_id + '" data-product="' + x.product_id + '" data-price="' + Number(x.unit_price) + '">Editar</button> <button class="link-btn" data-modular-action="delete-special-price" data-id="' + x.id + '">Excluir</button>' : '') + '</td></tr>';
      }).join('') : '<tr><td colspan="6"><div class="empty"><strong>Nenhum preço especial</strong>Cadastre um preço específico para um cliente quando necessário.</div></td></tr>') +
      '</tbody></table></div></div>';
  };

  async function openForm(data) {
    data = data || {};
    var core = await S.getCore();
    var customers = core.customers.map(function (x) { return '<option value="' + x.id + '"' + (x.id === data.customer_id ? ' selected' : '') + '>' + S.e(x.name) + '</option>'; }).join('');
    var products = core.products.filter(function (x) { return x.active; }).map(function (x) { return '<option value="' + x.id + '"' + (x.id === data.product_id ? ' selected' : '') + '>' + S.e(x.sku + ' · ' + x.name) + '</option>'; }).join('');
    S.modal(data.id ? 'Editar preço especial' : 'Novo preço especial', '<form data-modular-form="special-price"' + (data.id ? ' data-id="' + data.id + '"' : '') + '>' +
      '<div class="field"><label>Cliente</label><select name="customer_id" required><option value="">Selecione</option>' + customers + '</select></div>' +
      '<div class="field"><label>Produto</label><select name="product_id" required><option value="">Selecione</option>' + products + '</select></div>' +
      '<div class="field"><label>Preço especial</label><input name="unit_price" type="number" min="0" step="0.01" value="' + Number(data.unit_price || 0) + '" required></div>' +
      '<button class="primary" type="submit">Salvar preço</button></form>');
  }

  document.addEventListener("click", async function (ev) {
    var btn = ev.target.closest("[data-modular-action]");
    if (!btn) return;
    try {
      if (btn.dataset.modularAction === "new-special-price") await openForm();
      else if (btn.dataset.modularAction === "edit-special-price") await openForm({ id: btn.dataset.id, customer_id: btn.dataset.customer, product_id: btn.dataset.product, unit_price: Number(btn.dataset.price) });
      else if (btn.dataset.modularAction === "delete-special-price") {
        if (!confirm("Excluir este preço especial?")) return;
        var del = await S.sb.from("customer_product_prices").delete().eq("id", btn.dataset.id).eq("organization_id", S.state.orgId);
        if (del.error) throw del.error;
        S.toast("Preço especial removido.");
        await S.pageCustomerPricing();
      }
    } catch (err) { S.toast(S.errText(err), "error"); }
  });

  document.addEventListener("submit", async function (ev) {
    var form = ev.target.closest('form[data-modular-form="special-price"]');
    if (!form) return;
    ev.preventDefault();
    S.busy(form, true);
    try {
      var f = Object.fromEntries(new FormData(form).entries());
      var obj = { organization_id: S.state.orgId, customer_id: f.customer_id, product_id: f.product_id, unit_price: Number(f.unit_price), created_by: S.state.session.user.id, updated_at: new Date().toISOString() };
      if (!obj.customer_id || !obj.product_id || obj.unit_price < 0) throw new Error("Revise os dados do preço especial.");
      var res = form.dataset.id ? await S.sb.from("customer_product_prices").update({ customer_id: obj.customer_id, product_id: obj.product_id, unit_price: obj.unit_price, updated_at: obj.updated_at }).eq("id", form.dataset.id).eq("organization_id", S.state.orgId) : await S.sb.from("customer_product_prices").upsert(obj, { onConflict: "organization_id,customer_id,product_id" });
      if (res.error) throw res.error;
      S.closeModal();
      S.toast("Preço especial salvo.");
      await S.pageCustomerPricing();
    } catch (err) { S.toast(S.errText(err), "error"); }
    finally { if (document.body.contains(form)) S.busy(form, false); }
  });
})();
