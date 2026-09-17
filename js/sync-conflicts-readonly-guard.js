(function(){
  "use strict";
  var S=window.SS;if(!S||!S.pageNotifications)return;
  var base=S.pageNotifications;
  S.pageNotifications=async function(){
    await base();
    if(S.canWrite())return;
    document.querySelectorAll('[data-modular-action="conflict-apply-offline"],[data-modular-action="conflict-keep-server"]').forEach(function(el){el.remove();});
  };
})();
