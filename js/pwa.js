(function () {
  "use strict";
  var S = window.SS;
  if (!S) return;
  S.installPrompt = null;
  window.addEventListener("beforeinstallprompt", function (ev) {
    ev.preventDefault();
    S.installPrompt = ev;
  });
  S.installPwa = async function () {
    if (!S.installPrompt) return S.toast("A instalação já pode estar disponível no menu do navegador.", "error");
    await S.installPrompt.prompt();
    await S.installPrompt.userChoice;
    S.installPrompt = null;
  };
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/service-worker.js").catch(function (err) {
        console.warn("Service worker", err);
      });
    });
  }
})();
