(function(){
  "use strict";
  var S=window.SS;if(!S||!S.refreshOperationalNotifications)return;
  var base=S.refreshOperationalNotifications;
  S.refreshOperationalNotifications=async function(){
    if(!S.canWrite())return 0;
    return base();
  };
})();
