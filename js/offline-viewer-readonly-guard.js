(function(){
  "use strict";
  var S=window.SS;if(!S||!S.pageProduction)return;
  var base=S.pageProduction;
  S.pageProduction=async function(){
    var out=await base();
    if(navigator.onLine||S.canWrite())return out;
    document.querySelectorAll('form[data-modular-form="offline-production"]').forEach(function(form){
      form.querySelectorAll('select,input,textarea').forEach(function(el){el.disabled=true;});
      var submit=form.querySelector('button[type="submit"]');
      if(submit)submit.remove();
    });
    return out;
  };
  document.addEventListener('submit',function(ev){
    var form=ev.target.closest('form[data-modular-form="offline-production"]');
    if(!form||navigator.onLine||S.canWrite())return;
    ev.preventDefault();ev.stopImmediatePropagation();
  },true);
})();
