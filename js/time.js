(function () {
  "use strict";
  var S = window.SS;
  S.day = function (value) {
    if (!value) return "—";
    var raw = String(value);
    var match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return match[3] + "/" + match[2] + "/" + match[1];
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: S.cfg.timezone }).format(new Date(value));
  };
  S.zonedInputToIso = function (value) {
    if (!value) return null;
    var m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
    if (!m) throw new Error("Data ou horário inválido.");
    var target = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), 0, 0);
    var guess = target;
    for (var i = 0; i < 3; i += 1) {
      var p = S.tzParts(new Date(guess));
      var shown = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), 0, 0);
      guess += target - shown;
    }
    return new Date(guess).toISOString();
  };
})();
