(function(){
  "use strict";
  var S=window.SS;if(!S)return;
  function lock3DModal(){
    if(S.canWrite())return;
    var form=document.querySelector('.modal form[data-modular-form="filament-roll"],.modal form[data-modular-form="consume-filament"],.modal form[data-modular-form="order-3d"]');
    if(!form)return;
    form.querySelectorAll('input,select,textarea').forEach(function(el){el.disabled=true;});
    form.querySelectorAll('button[type="submit"],[data-three-d-action="use-order-suggested"]').forEach(function(el){el.remove();});
  }
  var basePage=S.pageInventory3D;
  if(basePage)S.pageInventory3D=async function(){
    await basePage();
    if(S.canWrite())return;
    ['new-roll','consume-roll','edit-roll'].forEach(function(action){
      document.querySelectorAll('[data-modular-action="'+action+'"]').forEach(function(el){el.remove();});
    });
  };
  var baseModal=S.modal;
  if(baseModal)S.modal=function(title,body,wide){baseModal(title,body,wide);lock3DModal();};
  var observer=new MutationObserver(lock3DModal);
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
