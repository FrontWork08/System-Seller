(function(){
  "use strict";
  var S=window.SS;if(!S)return;
  var basePage=S.pageInventory3D;
  if(basePage)S.pageInventory3D=async function(){
    await basePage();
    if(S.canWrite())return;
    ['new-roll','consume-roll','edit-roll'].forEach(function(action){
      document.querySelectorAll('[data-modular-action="'+action+'"]').forEach(function(el){el.remove();});
    });
  };
  var baseModal=S.modal;
  if(baseModal)S.modal=function(title,body,wide){
    baseModal(title,body,wide);
    if(S.canWrite())return;
    var form=document.querySelector('.modal form[data-modular-form="filament-roll"],.modal form[data-modular-form="consume-filament"],.modal form[data-modular-form="order-3d"]');
    if(!form)return;
    form.querySelectorAll('input,select,textarea').forEach(function(el){el.disabled=true;});
    var submit=form.querySelector('button[type="submit"]');
    if(submit)submit.remove();
  };
})();
