(function () {
  "use strict";
  var S = window.SS;

  S.renderAuth = function (mode) {
    mode = mode || "login";
    if (S.state.recovery && S.state.session) return S.renderRecovery();

    var form = "";
    if (mode === "login") {
      form = '<form data-form="login"><div class="field"><label>E-mail</label><input name="email" type="email" autocomplete="email" required></div>' +
        '<div class="field"><label>Senha</label><input name="password" type="password" autocomplete="current-password" required></div>' +
        '<button class="primary full" type="submit">Entrar</button><div class="login-foot"><button class="link-btn" type="button" data-action="auth-mode" data-mode="forgot">Esqueci minha senha</button></div></form>';
    } else if (mode === "signup") {
      form = '<form data-form="signup"><div class="field"><label>E-mail</label><input name="email" type="email" autocomplete="email" required></div>' +
        '<div class="field"><label>Senha</label><input name="password" type="password" minlength="10" autocomplete="new-password" required></div>' +
        '<div class="field"><label>Confirmar senha</label><input name="confirm" type="password" minlength="10" autocomplete="new-password" required></div>' +
        '<div class="note">Use ao menos 10 caracteres. Confirme seu e-mail antes do primeiro acesso quando a confirmação estiver habilitada.</div><br>' +
        '<button class="primary full" type="submit">Criar conta</button></form>';
    } else {
      form = '<form data-form="forgot"><div class="field"><label>E-mail da conta</label><input name="email" type="email" autocomplete="email" required></div>' +
        '<button class="primary full" type="submit">Enviar link de redefinição</button><div class="login-foot"><button class="link-btn" type="button" data-action="auth-mode" data-mode="login">Voltar ao login</button></div></form>';
    }

    var title = mode === "login" ? "Acesse sua operação" : mode === "signup" ? "Crie sua conta" : "Recuperar acesso";
    var sub = mode === "login" ? "Pedidos, estoque e financeiro em um só lugar." : mode === "signup" ? "Sua empresa fica isolada das demais por permissões no banco." : "Enviaremos um link seguro para redefinir a senha.";
    var tabs = mode === "forgot" ? "" : '<div class="tabs"><button class="tab ' + (mode === "login" ? "active" : "") + '" data-action="auth-mode" data-mode="login">Entrar</button><button class="tab ' + (mode === "signup" ? "active" : "") + '" data-action="auth-mode" data-mode="signup">Criar conta</button></div>';

    S.app.innerHTML = '<div class="auth-wrap"><section class="auth-hero"><div class="brand"><img class="brand-logo" src="./assets/system-seller-logo.png" alt="System Seller"></div>' +
      '<div class="auth-copy"><h1>Controle a operação sem perder o controle do dinheiro.</h1><p>Gestão real de pedidos, estoque, clientes, prazos e caixa. Sem dados demonstrativos: tudo é gravado no banco da sua empresa.</p></div>' +
      '<div class="feature-row"><div class="feature"><strong>Estoque transacional</strong><span>Baixa e estorno ligados ao pedido.</span></div><div class="feature"><strong>Multiempresa</strong><span>Cada cliente acessa somente seus dados.</span></div><div class="feature"><strong>Auditoria</strong><span>Alterações importantes ficam registradas.</span></div></div></section>' +
      '<section class="auth-card-wrap"><div class="auth-card"><div class="brand auth-brand-mobile"><img class="brand-logo" src="./assets/system-seller-logo.png" alt="System Seller"></div><h2>' + title + '</h2><p class="sub">' + sub + "</p>" + tabs + form + "</div></section></div>";
  };

  S.renderEmailConfirmation = function (email) {
    S.state.pendingEmail = String(email || "").trim();
    S.app.innerHTML = '<div class="auth-wrap"><section class="auth-hero"><div class="brand"><img class="brand-logo" src="./assets/system-seller-logo.png" alt="System Seller"></div>' +
      '<div class="auth-copy"><h1>Sua operação começa com uma conta segura.</h1><p>Antes de liberar o acesso aos dados da empresa, confirmamos que o e-mail realmente pertence a você.</p></div>' +
      '<div class="feature-row"><div class="feature"><strong>Confirmação obrigatória</strong><span>Evita cadastros com e-mails indevidos.</span></div><div class="feature"><strong>Acesso protegido</strong><span>Seu ambiente só é criado após a validação.</span></div><div class="feature"><strong>Dados isolados</strong><span>Cada empresa acessa somente seus próprios registros.</span></div></div></section>' +
      '<section class="auth-card-wrap"><div class="auth-card confirm-card"><div class="brand auth-brand-mobile"><img class="brand-logo" src="./assets/system-seller-logo.png" alt="System Seller"></div><div class="confirm-icon" aria-hidden="true">✉</div><div class="confirm-kicker">Conta criada</div><h2>Confirme seu e-mail</h2>' +
      '<p class="sub">Enviamos um link de confirmação para:</p><div class="confirm-email">' + S.e(S.state.pendingEmail) + '</div>' +
      '<div class="confirm-steps"><div><b>1</b><span>Abra sua caixa de entrada.</span></div><div><b>2</b><span>Toque em <strong>Confirmar e-mail</strong>.</span></div><div><b>3</b><span>Você voltará ao System Seller com o acesso liberado.</span></div></div>' +
      '<div class="note">Não encontrou? Verifique também Spam, Lixo eletrônico e Promoções. O link pode levar alguns instantes para chegar.</div>' +
      '<div class="confirm-actions"><button class="primary full" type="button" data-action="resend-confirmation">Reenviar e-mail de confirmação</button>' +
      '<button class="secondary full" type="button" data-action="auth-mode" data-mode="login">Já confirmei · ir para o login</button>' +
      '<button class="link-btn" type="button" data-action="auth-mode" data-mode="signup">Usar outro e-mail</button></div></div></section></div>';
  };

  S.renderRecovery = function () {
    S.app.innerHTML = '<section class="panel recovery"><div class="panel-body"><div class="brand"><img class="brand-logo" src="./assets/system-seller-logo.png" alt="System Seller"></div>' +
      '<h2>Defina uma nova senha</h2><p class="muted">O link de recuperação foi validado. Escolha uma nova senha forte.</p>' +
      '<form data-form="recovery"><div class="field"><label>Nova senha</label><input name="password" type="password" minlength="10" autocomplete="new-password" required></div>' +
      '<div class="field"><label>Confirmar senha</label><input name="confirm" type="password" minlength="10" autocomplete="new-password" required></div>' +
      '<button class="primary" type="submit">Atualizar senha</button></form></div></section>';
  };

  S.renderOnboarding = function () {
    S.app.innerHTML = '<div class="auth-card-wrap"><section class="auth-card"><div class="brand"><img class="brand-logo" src="./assets/system-seller-logo.png" alt="System Seller"></div>' +
      '<h2>Cadastre sua empresa</h2><p class="sub">Isso cria o espaço isolado onde pedidos, estoque, clientes e financeiro serão guardados.</p>' +
      '<form data-form="onboarding"><div class="field"><label>Nome da empresa</label><input name="name" maxlength="120" required placeholder="Ex.: Minha Loja"></div>' +
      '<button class="primary full" type="submit">Criar ambiente da empresa</button></form></section></div>';
  };

  S.loadProfile = async function () {
    var user = S.state.session && S.state.session.user;
    if (!user) {
      S.state.profile = null;
      return null;
    }

    var res = await S.sb.from("profiles").select("id,full_name,avatar_path,theme").eq("id", user.id).maybeSingle();
    if (res.error) throw res.error;

    var profile = res.data;
    if (!profile) {
      var ensured = await S.sb.from("profiles").upsert(
        { id: user.id },
        { onConflict: "id", ignoreDuplicates: true }
      );
      if (ensured.error) throw ensured.error;

      var fetched = await S.sb.from("profiles").select("id,full_name,avatar_path,theme").eq("id", user.id).single();
      if (fetched.error) throw fetched.error;
      profile = fetched.data;
    }

    profile.avatar_url = null;
    if (profile.avatar_path) {
      var signed = await S.sb.storage.from("profile-photos").createSignedUrl(profile.avatar_path, 43200);
      if (!signed.error && signed.data && signed.data.signedUrl) profile.avatar_url = signed.data.signedUrl;
    }
    S.state.profile = profile;
    if (profile.theme) S.applyTheme(profile.theme, false);
    return profile;
  };

  S.loadContext = async function () {
    if (S.state.inviteToken) {
      var redeem = await S.sb.rpc("redeem_team_invite", { p_token: S.state.inviteToken });
      if (redeem.error) throw redeem.error;
      S.state.orgId = redeem.data || S.state.orgId;
      S.clearInviteMarker();
      S.toast("Convite aceito. Você já faz parte da equipe.");
    }

    await S.loadProfile();
    var memberships = await S.sb.from("memberships").select("organization_id,role");
    if (memberships.error) throw memberships.error;
    var orgs = await S.sb.from("organizations").select("id,name,owner_user_id").order("name");
    if (orgs.error) throw orgs.error;

    S.state.orgs = orgs.data || [];
    S.state.roles = {};
    (memberships.data || []).forEach(function (x) { S.state.roles[x.organization_id] = x.role; });

    if (!S.state.orgId || !S.state.orgs.some(function (o) { return o.id === S.state.orgId; })) {
      S.state.orgId = S.state.orgs[0] ? S.state.orgs[0].id : null;
    }

    var org = S.currentOrg();
    S.state.role = S.state.roles[S.state.orgId] || (org && org.owner_user_id === S.state.session.user.id ? "owner" : null);

    if (!S.state.orgId) {
      S.renderOnboarding();
    } else {
      S.renderShell();
      await S.loadPage();
    }
  };
})();
