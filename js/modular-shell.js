(function () {
  "use strict";
  var S = window.SS;
  if (!S) return;

  var baseLoadPage = S.loadPage;

  S.ensureOrgSettings = async function (force) {
    if (!S.state.orgId) return null;
    if (!force && S.state.data.orgSettings && S.state.data.orgSettings.organization_id === S.state.orgId) {
      return S.state.data.orgSettings;
    }
    var res = await S.sb.from("organization_settings").select("*").eq("organization_id", S.state.orgId).maybeSingle();
    if (res.error) throw res.error;
    if (!res.data) {
      var created = await S.sb.rpc("ensure_default_production_stages", { p_organization_id: S.state.orgId });
      if (created.error) throw created.error;
      res = await S.sb.from("organization_settings").select("*").eq("organization_id", S.state.orgId).single();
      if (res.error) throw res.error;
    }
    S.state.data.orgSettings = res.data;
    return res.data;
  };

  S.navItems = function () {
    var settings = S.state.data.orgSettings || {};
    var items = [
      ["dashboard", "▦", "Visão geral", "Operação"],
      ["orders", "◫", "Pedidos", "Operação"],
      ["quotes", "◇", "Orçamentos", "Operação"],
      ["production", "⚙", "Produção", "Operação"],
      ["calendar", "▣", "Calendário", "Operação"],
      ["customers", "◎", "Clientes", "Comercial"],
      ["customer-pricing", "R$", "Preços especiais", "Comercial"],
      ["documents", "▤", "Documentos", "Comercial"],
      ["products", "□", "Produtos / estoque", "Estoque"]
    ];
    if (settings.enable_3d) items.push(["inventory-3d", "◈", "Estoque 3D", "Estoque"]);
    if (S.canAdmin()) {
      items.push(["finance", "R$", "Receitas / despesas", "Financeiro"]);
      items.push(["costs", "∑", "Custos e lucro", "Financeiro"]);
      items.push(["reports", "▥", "Relatórios", "Financeiro"]);
    }
    items.push(["stores", "⌂", "Lojas / canais", "Gestão"]);
    if (S.canAdmin()) items.push(["team", "♙", "Equipe", "Gestão"]);
    items.push(["notifications", "●", "Notificações", "Gestão"]);
    if (S.canAdmin()) items.push(["backup", "⇩", "Backup", "Gestão"]);
    if (S.canAdmin()) items.push(["audit", "≡", "Auditoria", "Gestão"]);
    if (S.canAdmin()) items.push(["settings", "⚙", "Configurações", "Gestão"]);
    items.push(["profile", "◉", "Perfil", "Conta"]);
    return items;
  };

  S.pageSettings = async function () {
    var page = document.getElementById("page");
    var cfg = await S.ensureOrgSettings(true);
    page.innerHTML = '<div class="page-head"><div><h2>Configurações da empresa</h2><p>Módulos e parâmetros operacionais da organização.</p></div></div>' +
      '<div class="panel"><div class="panel-body"><form data-modular-form="org-settings" class="form-grid">' +
      '<div class="field"><label>Módulo de impressão 3D</label><select name="enable_3d"><option value="false"' + (!cfg.enable_3d ? ' selected' : '') + '>Desativado</option><option value="true"' + (cfg.enable_3d ? ' selected' : '') + '>Ativado</option></select></div>' +
      '<div class="field"><label>Alerta de filamento baixo (g)</label><input name="low_filament_threshold_g" type="number" min="0" step="1" value="' + Number(cfg.low_filament_threshold_g || 0) + '"></div>' +
      '<div class="field"><label>Produção parada após (horas)</label><input name="stalled_stage_hours" type="number" min="1" step="1" value="' + Number(cfg.stalled_stage_hours || 72) + '"></div>' +
      '<div class="field"><label>E-mail comercial</label><input name="business_email" type="email" maxlength="200" value="' + S.e(cfg.business_email || '') + '"></div>' +
      '<div class="field"><label>Telefone comercial</label><input name="business_phone" maxlength="80" value="' + S.e(cfg.business_phone || '') + '"></div>' +
      '<div class="field"><label>CPF/CNPJ da empresa</label><input name="business_document" maxlength="80" value="' + S.e(cfg.business_document || '') + '"></div>' +
      '<div class="field span2"><label>Endereço</label><input name="business_address" maxlength="240" value="' + S.e(cfg.business_address || '') + '"></div>' +
      '<div class="field span2"><label>Rodapé de documentos</label><textarea name="document_footer" maxlength="500">' + S.e(cfg.document_footer || '') + '</textarea></div>' +
      '<div class="span2 actions"><button class="primary" type="submit">Salvar configurações</button></div>' +
      '</form></div></div>';
  };

  document.addEventListener("submit", async function (ev) {
    var form = ev.target.closest('form[data-modular-form="org-settings"]');
    if (!form) return;
    ev.preventDefault();
    if (!S.canAdmin()) return S.toast("Apenas administradores podem alterar configurações.", "error");
    S.busy(form, true);
    try {
      var f = Object.fromEntries(new FormData(form).entries());
      var obj = {
        enable_3d: f.enable_3d === "true",
        low_filament_threshold_g: Math.max(0, Number(f.low_filament_threshold_g) || 0),
        stalled_stage_hours: Math.max(1, Number(f.stalled_stage_hours) || 72),
        business_email: String(f.business_email || "").trim() || null,
        business_phone: String(f.business_phone || "").trim() || null,
        business_document: String(f.business_document || "").trim() || null,
        business_address: String(f.business_address || "").trim() || null,
        document_footer: String(f.document_footer || "").trim() || null,
        updated_at: new Date().toISOString()
      };
      var res = await S.sb.from("organization_settings").update(obj).eq("organization_id", S.state.orgId);
      if (res.error) throw res.error;
      S.state.data.orgSettings = Object.assign({}, S.state.data.orgSettings || {}, obj, { organization_id: S.state.orgId });
      S.toast("Configurações atualizadas.");
      S.renderShell();
      await S.pageSettings();
    } catch (err) {
      S.toast(S.errText(err), "error");
    } finally {
      if (document.body.contains(form)) S.busy(form, false);
    }
  });

  S.loadPage = async function () {
    try {
      var before = S.state.data.orgSettings && S.state.data.orgSettings.organization_id === S.state.orgId;
      await S.ensureOrgSettings(false);
      if (!before && document.querySelector(".shell")) S.renderShell();
      var routes = {
        quotes: S.pageQuotes,
        production: S.pageProduction,
        calendar: S.pageCalendar,
        "customer-pricing": S.pageCustomerPricing,
        costs: S.pageCosts,
        reports: S.pageReports,
        documents: S.pageDocuments,
        "inventory-3d": S.pageInventory3D,
        notifications: S.pageNotifications,
        settings: S.pageSettings
      };
      var fn = routes[S.state.page];
      if (fn) {
        var page = document.getElementById("page");
        if (page) page.innerHTML = '<div class="boot"><div class="spinner"></div><p>Carregando…</p></div>';
        await fn();
        return;
      }
      await baseLoadPage();
    } catch (err) {
      var pageEl = document.getElementById("page");
      if (pageEl) pageEl.innerHTML = S.empty("Não foi possível carregar", S.errText(err));
      S.toast(S.errText(err), "error");
    }
  };
})();
