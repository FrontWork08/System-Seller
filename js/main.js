(function () {
  "use strict";
  var S = window.SS;

  function announceAuthResult() {
    if (S.state.authMarker === "confirmed") {
      S.toast("E-mail confirmado com sucesso. Sua conta está pronta para uso.");
      S.clearAuthMarker();
    } else if (S.state.authMarker === "recovery") {
      S.clearAuthMarker();
    }
  }

  async function init() {
    try {
      S.sb.auth.onAuthStateChange(function (event, session) {
        S.state.session = session;
        if (event === "PASSWORD_RECOVERY") {
          S.state.recovery = true;
          setTimeout(S.renderRecovery, 0);
        } else if (event === "SIGNED_IN" && session) {
          setTimeout(function () {
            S.loadContext().then(announceAuthResult).catch(function (err) { S.toast(S.errText(err), "error"); });
          }, 0);
        } else if (event === "SIGNED_OUT") {
          setTimeout(function () { S.renderAuth("login"); }, 0);
        }
      });

      var res = await S.sb.auth.getSession();
      if (res.error) throw res.error;
      S.state.session = res.data.session;
      if (S.state.session) {
        await S.loadContext();
        announceAuthResult();
      } else {
        S.renderAuth("login");
        if (S.state.authMarker === "confirmed") {
          S.toast("E-mail confirmado. Entre com sua senha para continuar.");
          S.clearAuthMarker();
        }
      }
    } catch (err) {
      S.app.innerHTML = S.empty("Falha ao iniciar o sistema", S.errText(err));
      S.toast(S.errText(err), "error");
    }
  }

  init();
})();
