(function () {
  "use strict";
  var S = window.SS;
  if (!S || !S.calculate3DPricing) return;

  var activeRow = null;
  var decorateTimer = null;
  var baseSettingsPage = S.pageSettings;
  var baseInventory3DPage = S.pageInventory3D;

  function num(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function money(value) {
    return S.money(num(value));
  }

  function decodeSnapshot(value) {
    if (!value) return null;
    try { return JSON.parse(decodeURIComponent(value)); } catch (err) { return null; }
  }

  function encodeSnapshot(value) {
    return encodeURIComponent(JSON.stringify(value));
  }

  async function pricingConfig() {
    var cfg = await S.ensureOrgSettings(true);
    return cfg || {};
  }

  async function activeRolls() {
    var res = await S.sb.from("filament_rolls")
      .select("id,material,color,brand,initial_weight_g,remaining_weight_g,purchase_cost,status")
      .eq("organization_id", S.state.orgId)
      .eq("status", "active")
      .order("created_at", { ascending:false });
    if (res.error) throw res.error;
    return res.data || [];
  }

  function rollCostPerGram(roll) {
    var weight = num(roll && roll.initial_weight_g);
    return weight > 0 ? num(roll.purchase_cost) / weight : 0;
  }

  function rollOptions(rolls, selectedId) {
    var html = '<option value="">Sem rolo / custo manual</option>';
    rolls.forEach(function (roll) {
      var cost = rollCostPerGram(roll);
      html += '<option value="' + roll.id + '" data-cost-per-g="' + cost + '" data-material="' + S.e(roll.material || '') + '" data-color="' + S.e(roll.color || '') + '"' + (roll.id === selectedId ? ' selected' : '') + '>' +
        S.e((roll.material || 'Material') + ' · ' + (roll.color || 'Sem cor') + (roll.brand ? ' · ' + roll.brand : '') + ' · ' + num(roll.remaining_weight_g).toFixed(0) + ' g') + '</option>';
    });
    return html;
  }

  function configWarning(cfg) {
    var missing = [];
    if (num(cfg.electricity_price_per_kwh) <= 0) missing.push("energia");
    if (num(cfg.printer_power_watts) <= 0) missing.push("potência da impressora");
    if (num(cfg.machine_hour_cost) <= 0) missing.push("custo/hora da máquina");
    if (num(cfg.labor_hour_cost) <= 0) missing.push("mão de obra");
    if (!missing.length) return '';
    return '<div class="notice warning"><strong>Configuração parcial</strong><div class="muted">Preencha ' + S.e(missing.join(', ')) + ' em Configurações para o custo automático ficar completo.</div></div>';
  }

  function breakdownHtml() {
    return '<div class="section-title">Resultado automático</div>' +
      '<div class="metric-row">' +
      '<div class="metric"><small>Material</small><strong data-3d-out="material">R$ 0,00</strong></div>' +
      '<div class="metric"><small>Energia</small><strong data-3d-out="energy">R$ 0,00</strong></div>' +
      '<div class="metric"><small>Máquina</small><strong data-3d-out="machine">R$ 0,00</strong></div>' +
      '<div class="metric"><small>Mão de obra</small><strong data-3d-out="labor">R$ 0,00</strong></div>' +
      '</div>' +
      '<div class="statline"><span>Custo estimado</span><strong data-3d-out="cost">R$ 0,00</strong></div>' +
      '<div class="statline"><span>Preço sugerido</span><strong data-3d-out="suggested">R$ 0,00</strong></div>' +
      '<div class="statline"><span>Preço final</span><strong data-3d-out="final">R$ 0,00</strong></div>' +
      '<div class="statline"><span>Lucro estimado no preço final</span><strong data-3d-out="profit">R$ 0,00</strong></div>';
  }

  function buildInput(form, cfg, finalName) {
    var rollSelect = form.elements.filament_roll_id || form.elements.pricing_filament_roll_id;
    var option = rollSelect && rollSelect.selectedOptions ? rollSelect.selectedOptions[0] : null;
    var materialCostInput = form.elements.material_cost_per_g || form.elements.pricing_material_cost_per_g;
    var materialInput = form.elements.material_g || form.elements.pricing_estimated_material_g;
    var printInput = form.elements.print_minutes || form.elements.estimated_minutes;
    var laborInput = form.elements.labor_minutes || form.elements.pricing_labor_minutes;
    var marginInput = form.elements.margin_pct || form.elements.pricing_margin_pct;
    var finalInput = form.elements[finalName || "final_price"];

    var input = {
      material_g: num(materialInput && materialInput.value),
      material_cost_per_g: num(materialCostInput && materialCostInput.value, option ? num(option.dataset.costPerG) : 0),
      print_minutes: num(printInput && printInput.value),
      printer_power_watts: num(cfg.printer_power_watts),
      electricity_price_per_kwh: num(cfg.electricity_price_per_kwh),
      machine_hour_cost: num(cfg.machine_hour_cost),
      labor_minutes: num(laborInput && laborInput.value),
      labor_hour_cost: num(cfg.labor_hour_cost),
      margin_pct: num(marginInput && marginInput.value, num(cfg.default_3d_margin_pct, 30))
    };
    if (finalInput && finalInput.dataset.manual === "1" && finalInput.value !== "") input.final_price = num(finalInput.value);
    return input;
  }

  function currentRoll(form, rolls) {
    var select = form.elements.filament_roll_id || form.elements.pricing_filament_roll_id;
    if (!select || !select.value) return null;
    return rolls.find(function (r) { return r.id === select.value; }) || null;
  }

  function snapshot(input, result, roll) {
    return {
      version: 1,
      calculated_at: new Date().toISOString(),
      filament_roll_id: roll ? roll.id : null,
      filament_label: roll ? [roll.material, roll.color, roll.brand].filter(Boolean).join(' · ') : null,
      material_g: input.material_g,
      material_cost_per_g: input.material_cost_per_g,
      print_minutes: input.print_minutes,
      labor_minutes: input.labor_minutes,
      printer_power_watts: input.printer_power_watts,
      electricity_price_per_kwh: input.electricity_price_per_kwh,
      machine_hour_cost: input.machine_hour_cost,
      labor_hour_cost: input.labor_hour_cost,
      margin_pct: input.margin_pct,
      material_cost: result.material_cost,
      energy_cost: result.energy_cost,
      machine_cost: result.machine_cost,
      labor_cost: result.labor_cost,
      estimated_cost: result.estimated_cost,
      suggested_price: result.suggested_price,
      final_price: result.final_price
    };
  }

  function renderResult(form, result) {
    var map = {
      material: result.material_cost,
      energy: result.energy_cost,
      machine: result.machine_cost,
      labor: result.labor_cost,
      cost: result.estimated_cost,
      suggested: result.suggested_price,
      final: result.final_price,
      profit: result.final_price - result.estimated_cost
    };
    Object.keys(map).forEach(function (key) {
      var node = form.querySelector('[data-3d-out="' + key + '"]');
      if (node) node.textContent = money(map[key]);
    });
  }

  function recalc(form, cfg, rolls, finalName) {
    var input = buildInput(form, cfg, finalName);
    var result = S.calculate3DPricing(input);
    var finalInput = form.elements[finalName || "final_price"];
    if (finalInput && finalInput.dataset.manual !== "1") finalInput.value = result.suggested_price.toFixed(2);
    var roll = currentRoll(form, rolls);
    var data = snapshot(input, result, roll);
    form.dataset.pricingResult = encodeSnapshot(data);
    renderResult(form, result);
    return data;
  }

  function setMaterialCostFromRoll(form) {
    var select = form.elements.filament_roll_id || form.elements.pricing_filament_roll_id;
    var costInput = form.elements.material_cost_per_g || form.elements.pricing_material_cost_per_g;
    if (!select || !costInput || !select.selectedOptions || !select.selectedOptions[0]) return;
    var opt = select.selectedOptions[0];
    if (select.value) {
      costInput.value = num(opt.dataset.costPerG).toFixed(4);
      costInput.dataset.fromRoll = "1";
      var material = form.elements.material;
      var color = form.elements.color;
      if (material && !material.value && opt.dataset.material) material.value = opt.dataset.material;
      if (color && !color.value && opt.dataset.color) color.value = opt.dataset.color;
    } else if (costInput.dataset.fromRoll === "1") {
      costInput.value = "0";
      delete costInput.dataset.fromRoll;
    }
  }

  async function openRowCalculator(row) {
    var cfg = await pricingConfig();
    if (!cfg.enable_3d) throw new Error("Ative o módulo 3D nas configurações da empresa.");
    var rolls = await activeRolls();
    activeRow = row;
    var old = decodeSnapshot(row.dataset.threeDPricing) || {};
    var selectedRoll = old.filament_roll_id || '';
    var initialCost = old.material_cost_per_g;
    if (initialCost == null && selectedRoll) {
      var roll = rolls.find(function (r) { return r.id === selectedRoll; });
      initialCost = rollCostPerGram(roll);
    }
    var body = '<form data-modular-form="3d-price-calculator">' + configWarning(cfg) +
      '<div class="note">O sistema calcula o preço por unidade usando material + energia + máquina + mão de obra/acabamento. O <strong>Preço final</strong> continua livre para edição.</div><br>' +
      '<div class="form-grid">' +
      '<div class="field span2"><label>Rolo/material</label><select name="filament_roll_id">' + rollOptions(rolls, selectedRoll) + '</select></div>' +
      '<div class="field"><label>Material estimado (g)</label><input name="material_g" type="number" min="0" step="0.01" value="' + num(old.material_g) + '"></div>' +
      '<div class="field"><label>Custo do material por g</label><input name="material_cost_per_g" type="number" min="0" step="0.0001" value="' + num(initialCost).toFixed(4) + '"></div>' +
      '<div class="field"><label>Tempo de impressão (min)</label><input name="print_minutes" type="number" min="0" step="1" value="' + num(old.print_minutes) + '"></div>' +
      '<div class="field"><label>Mão de obra/acabamento (min)</label><input name="labor_minutes" type="number" min="0" step="1" value="' + num(old.labor_minutes) + '"></div>' +
      '<div class="field"><label>Margem desejada (%)</label><input name="margin_pct" type="number" min="0" max="99.99" step="0.01" value="' + num(old.margin_pct, num(cfg.default_3d_margin_pct, 30)) + '"></div>' +
      '<div class="field"><label>Preço final</label><input name="final_price" type="number" min="0" step="0.01" value="' + (old.final_price == null ? '' : num(old.final_price).toFixed(2)) + '"><button class="ghost mini" type="button" data-three-d-action="use-suggested">Usar sugerido</button></div>' +
      '</div>' + breakdownHtml() +
      '<div class="actions right"><button class="primary" type="submit">Aplicar preço ao item</button></div></form>';
    S.modal("Calculadora automática 3D", body, true);
    var form = document.querySelector('form[data-modular-form="3d-price-calculator"]');
    if (!form) return;
    if (old.final_price != null) form.elements.final_price.dataset.manual = "1";
    if (selectedRoll) setMaterialCostFromRoll(form);
    recalc(form, cfg, rolls, "final_price");
  }

  function applyToRow(row, data) {
    if (!row) throw new Error("O item do pedido/orçamento não está mais disponível.");
    var orderInput = row.querySelector('.order-price');
    var quoteInput = row.querySelector('.quote-price');
    var input = orderInput || quoteInput;
    if (!input) throw new Error("Campo de preço não encontrado.");
    input.value = num(data.final_price).toFixed(2);
    row.dataset.threeDPricing = encodeSnapshot(data);
    var button = row.querySelector('.three-d-price-btn');
    if (button) button.textContent = 'Recalcular 3D';
    if (orderInput) {
      var toggle = row.querySelector('.order-custom-price');
      if (toggle) toggle.checked = true;
      orderInput.readOnly = false;
      var hint = row.querySelector('.order-price-hint');
      if (hint) hint.textContent = 'Preço 3D · custo ' + money(data.estimated_cost) + ' · sugerido ' + money(data.suggested_price) + ' · final ' + money(data.final_price) + '.';
      if (S.updateEstimate) S.updateEstimate();
    } else {
      quoteInput.dispatchEvent(new Event('input', { bubbles:true }));
    }
  }

  async function decorateRows() {
    var cfg = S.state.data.orgSettings || null;
    if (!cfg && S.state.orgId && S.ensureOrgSettings) {
      try { cfg = await S.ensureOrgSettings(false); } catch (err) { return; }
    }
    if (!cfg || !cfg.enable_3d) return;
    document.querySelectorAll('.order-line, .quote-line').forEach(function (row) {
      if (row.querySelector('.three-d-price-btn')) return;
      var price = row.querySelector('.order-price, .quote-price');
      if (!price) return;
      var field = price.closest('.field') || row;
      field.insertAdjacentHTML('beforeend', '<button class="ghost mini three-d-price-btn" type="button" data-three-d-action="price-row">Calcular preço 3D</button>');
    });
  }

  function scheduleDecorate() {
    clearTimeout(decorateTimer);
    decorateTimer = setTimeout(function () { decorateRows().catch(function () {}); decorateOrder3DForms().catch(function () {}); }, 20);
  }

  function settingsPanel(cfg) {
    return '<div class="panel" style="margin-top:16px"><div class="panel-head"><div><h3>Precificação automática 3D</h3><p class="muted">Parâmetros usados no custo e no preço sugerido. Valores zerados não entram no cálculo.</p></div></div><div class="panel-body">' +
      '<form data-modular-form="3d-pricing-settings" class="form-grid">' +
      '<div class="field"><label>Energia (R$/kWh)</label><input name="electricity_price_per_kwh" type="number" min="0" step="0.0001" value="' + num(cfg.electricity_price_per_kwh) + '"></div>' +
      '<div class="field"><label>Potência da impressora (W)</label><input name="printer_power_watts" type="number" min="0" step="0.01" value="' + num(cfg.printer_power_watts) + '"></div>' +
      '<div class="field"><label>Custo da máquina (R$/h)</label><input name="machine_hour_cost" type="number" min="0" step="0.01" value="' + num(cfg.machine_hour_cost) + '"></div>' +
      '<div class="field"><label>Mão de obra/acabamento (R$/h)</label><input name="labor_hour_cost" type="number" min="0" step="0.01" value="' + num(cfg.labor_hour_cost) + '"></div>' +
      '<div class="field"><label>Margem padrão (%)</label><input name="default_3d_margin_pct" type="number" min="0" max="99.99" step="0.01" value="' + num(cfg.default_3d_margin_pct, 30) + '"></div>' +
      '<div class="span2 actions"><button class="primary" type="submit">Salvar precificação 3D</button></div>' +
      '</form></div></div>';
  }

  if (baseSettingsPage) {
    S.pageSettings = async function () {
      await baseSettingsPage();
      var page = document.getElementById('page');
      if (!page || !S.canAdmin()) return;
      var cfg = await pricingConfig();
      page.insertAdjacentHTML('beforeend', settingsPanel(cfg));
    };
  }

  if (baseInventory3DPage) {
    S.pageInventory3D = async function () {
      await baseInventory3DPage();
      var cfg = await pricingConfig();
      if (!cfg.enable_3d) return;
      var page = document.getElementById('page');
      if (!page) return;
      var head = page.querySelector('.page-head');
      if (head) head.insertAdjacentHTML('afterend', '<div class="notice"><strong>Precificação automática ativa</strong><div class="muted">Material + energia + máquina + mão de obra/acabamento → custo estimado → preço sugerido por margem real → preço final editável.</div></div>');
      var res = await S.sb.from('order_3d_details').select('order_id,estimated_cost,suggested_price,final_price').eq('organization_id', S.state.orgId);
      if (res.error) return;
      var map = {};
      (res.data || []).forEach(function (d) { map[d.order_id] = d; });
      page.querySelectorAll('[data-modular-action="edit-3d-order"]').forEach(function (button) {
        var d = map[button.dataset.id];
        if (!d || d.final_price == null) return;
        var parent = button.parentElement;
        if (parent && !parent.querySelector('.three-d-price-summary')) {
          parent.insertAdjacentHTML('beforeend', '<small class="muted three-d-price-summary">Custo ' + money(d.estimated_cost) + ' · sugerido ' + money(d.suggested_price) + ' · final ' + money(d.final_price) + '</small>');
        }
      });
    };
  }

  async function decorateOrder3DForm(form) {
    if (!form || form.querySelector('.three-d-order-pricing')) return;
    var cfg = await pricingConfig();
    if (!cfg.enable_3d) return;
    var rolls = await activeRolls();
    var orderId = form.dataset.id;
    var res = await S.sb.from('order_3d_details').select('*').eq('order_id', orderId).maybeSingle();
    if (res.error) throw res.error;
    var d = res.data || {};
    var old = d.pricing_snapshot || {};
    var selectedRoll = old.filament_roll_id || '';
    var costPerG = old.material_cost_per_g;
    if (costPerG == null && selectedRoll) costPerG = rollCostPerGram(rolls.find(function (r) { return r.id === selectedRoll; }));
    var html = '<div class="three-d-order-pricing"><div class="section-title">Precificação automática</div>' + configWarning(cfg) +
      '<div class="form-grid">' +
      '<div class="field span2"><label>Rolo/material para o cálculo</label><select name="pricing_filament_roll_id">' + rollOptions(rolls, selectedRoll) + '</select></div>' +
      '<div class="field"><label>Material estimado (g)</label><input name="pricing_estimated_material_g" type="number" min="0" step="0.01" value="' + num(d.estimated_material_g, num(old.material_g)) + '"></div>' +
      '<div class="field"><label>Custo do material por g</label><input name="pricing_material_cost_per_g" type="number" min="0" step="0.0001" value="' + num(costPerG).toFixed(4) + '"></div>' +
      '<div class="field"><label>Mão de obra/acabamento (min)</label><input name="pricing_labor_minutes" type="number" min="0" step="1" value="' + num(d.labor_minutes, num(old.labor_minutes)) + '"></div>' +
      '<div class="field"><label>Margem desejada (%)</label><input name="pricing_margin_pct" type="number" min="0" max="99.99" step="0.01" value="' + num(d.pricing_margin_pct, num(old.margin_pct, num(cfg.default_3d_margin_pct, 30))) + '"></div>' +
      '<div class="field"><label>Preço final</label><input name="pricing_final_price" type="number" min="0" step="0.01" value="' + (d.final_price == null ? '' : num(d.final_price).toFixed(2)) + '"><button class="ghost mini" type="button" data-three-d-action="use-order-suggested">Usar sugerido</button></div>' +
      '</div>' + breakdownHtml() +
      '<div class="note">O valor é salvo como histórico do trabalho 3D. Ele não reescreve automaticamente pedidos antigos; em novos pedidos/orçamentos use o botão <strong>Calcular preço 3D</strong> no item.</div></div>';
    var submit = form.querySelector('button[type="submit"]');
    if (submit) submit.insertAdjacentHTML('beforebegin', html);
    else form.insertAdjacentHTML('beforeend', html);
    if (d.final_price != null) form.elements.pricing_final_price.dataset.manual = '1';
    form.dataset.pricingConfig = encodeSnapshot(cfg);
    form.dataset.pricingRolls = encodeSnapshot(rolls);
    if (selectedRoll) setMaterialCostFromRoll(form);
    recalc(form, cfg, rolls, 'pricing_final_price');
  }

  async function decorateOrder3DForms() {
    var forms = Array.from(document.querySelectorAll('form[data-modular-form="order-3d"]'));
    for (var i = 0; i < forms.length; i++) await decorateOrder3DForm(forms[i]);
  }

  document.addEventListener('click', async function (ev) {
    var button = ev.target.closest('[data-three-d-action]');
    if (!button) return;
    try {
      var action = button.dataset.threeDAction;
      if (action === 'price-row') {
        await openRowCalculator(button.closest('.order-line, .quote-line'));
      } else if (action === 'use-suggested') {
        var form = button.closest('form[data-modular-form="3d-price-calculator"]');
        if (!form) return;
        form.elements.final_price.dataset.manual = '0';
        form.elements.final_price.value = '';
        var cfg = await pricingConfig();
        var rolls = await activeRolls();
        recalc(form, cfg, rolls, 'final_price');
      } else if (action === 'use-order-suggested') {
        var orderForm = button.closest('form[data-modular-form="order-3d"]');
        if (!orderForm) return;
        orderForm.elements.pricing_final_price.dataset.manual = '0';
        orderForm.elements.pricing_final_price.value = '';
        recalc(orderForm, decodeSnapshot(orderForm.dataset.pricingConfig) || {}, decodeSnapshot(orderForm.dataset.pricingRolls) || [], 'pricing_final_price');
      }
    } catch (err) {
      S.toast(S.errText(err), 'error');
    }
  });

  document.addEventListener('input', function (ev) {
    var calc = ev.target.closest('form[data-modular-form="3d-price-calculator"]');
    var order3d = ev.target.closest('form[data-modular-form="order-3d"]');
    try {
      if (calc) {
        if (ev.target.name === 'final_price') ev.target.dataset.manual = '1';
        recalc(calc, S.state.data.orgSettings || {}, [], 'final_price');
      } else if (order3d && order3d.querySelector('.three-d-order-pricing')) {
        if (ev.target.name === 'pricing_final_price') ev.target.dataset.manual = '1';
        recalc(order3d, decodeSnapshot(order3d.dataset.pricingConfig) || {}, decodeSnapshot(order3d.dataset.pricingRolls) || [], 'pricing_final_price');
      }
    } catch (err) {
      // Validation is surfaced on submit/click; keep typing fluid.
    }
  });

  document.addEventListener('change', function (ev) {
    var form = ev.target.closest('form[data-modular-form="3d-price-calculator"], form[data-modular-form="order-3d"]');
    if (!form) return;
    if (ev.target.name === 'filament_roll_id' || ev.target.name === 'pricing_filament_roll_id') setMaterialCostFromRoll(form);
    try {
      if (form.dataset.modularForm === '3d-price-calculator') recalc(form, S.state.data.orgSettings || {}, [], 'final_price');
      else recalc(form, decodeSnapshot(form.dataset.pricingConfig) || {}, decodeSnapshot(form.dataset.pricingRolls) || [], 'pricing_final_price');
    } catch (err) {}
  });

  document.addEventListener('submit', async function (ev) {
    var form = ev.target;
    if (form.matches('form[data-modular-form="3d-price-calculator"]')) {
      ev.preventDefault();
      S.busy(form, true);
      try {
        var cfg = await pricingConfig();
        var rolls = await activeRolls();
        var data = recalc(form, cfg, rolls, 'final_price');
        applyToRow(activeRow, data);
        S.closeModal();
        S.toast('Preço 3D aplicado ao item.');
      } catch (err) {
        S.toast(S.errText(err), 'error');
      } finally {
        if (document.body.contains(form)) S.busy(form, false);
      }
      return;
    }

    if (form.matches('form[data-modular-form="3d-pricing-settings"]')) {
      ev.preventDefault();
      if (!S.canAdmin()) return S.toast('Apenas administradores podem alterar a precificação 3D.', 'error');
      S.busy(form, true);
      try {
        var f = Object.fromEntries(new FormData(form).entries());
        var values = {
          electricity_price_per_kwh: num(f.electricity_price_per_kwh),
          printer_power_watts: num(f.printer_power_watts),
          machine_hour_cost: num(f.machine_hour_cost),
          labor_hour_cost: num(f.labor_hour_cost),
          default_3d_margin_pct: num(f.default_3d_margin_pct),
          updated_at: new Date().toISOString()
        };
        if (values.default_3d_margin_pct >= 100) throw new Error('A margem padrão precisa ser menor que 100%.');
        var save = await S.sb.from('organization_settings').update(values).eq('organization_id', S.state.orgId);
        if (save.error) throw save.error;
        S.state.data.orgSettings = Object.assign({}, S.state.data.orgSettings || {}, values);
        S.toast('Precificação 3D atualizada.');
      } catch (err) {
        S.toast(S.errText(err), 'error');
      } finally {
        if (document.body.contains(form)) S.busy(form, false);
      }
      return;
    }

    if (form.matches('form[data-modular-form="order-3d"]') && form.querySelector('.three-d-order-pricing')) {
      try {
        var cfg2 = decodeSnapshot(form.dataset.pricingConfig) || await pricingConfig();
        var rolls2 = decodeSnapshot(form.dataset.pricingRolls) || [];
        var data2 = recalc(form, cfg2, rolls2, 'pricing_final_price');
        var save2 = await S.sb.from('order_3d_details').upsert({
          order_id: form.dataset.id,
          organization_id: S.state.orgId,
          estimated_material_g: num(data2.material_g),
          labor_minutes: Math.round(num(data2.labor_minutes)),
          material_cost: num(data2.material_cost),
          energy_cost: num(data2.energy_cost),
          machine_cost: num(data2.machine_cost),
          labor_cost: num(data2.labor_cost),
          estimated_cost: num(data2.estimated_cost),
          suggested_price: num(data2.suggested_price),
          final_price: num(data2.final_price),
          pricing_margin_pct: num(data2.margin_pct),
          pricing_snapshot: data2,
          pricing_calculated_at: data2.calculated_at,
          updated_at: new Date().toISOString()
        }, { onConflict:'order_id' });
        if (save2.error) throw save2.error;
      } catch (err) {
        S.toast('Os dados básicos foram salvos, mas a precificação 3D falhou: ' + S.errText(err), 'error');
      }
    }
  });

  var observer = new MutationObserver(scheduleDecorate);
  observer.observe(document.documentElement, { childList:true, subtree:true });
  scheduleDecorate();
})();
