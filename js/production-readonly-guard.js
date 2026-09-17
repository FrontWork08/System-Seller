(function(){
  "use strict";
  var S=window.SS;if(!S||!S.modal)return;
  var baseModal=S.modal;
  S.modal=function(title,body,wide){
    baseModal(title,body,wide);
    if(S.canWrite())return;
    var form=document.querySelector('.modal form[data-modular-form="production"]');
    if(!form)return;
    form.querySelectorAll('input,select,textarea').forEach(function(el){el.disabled=true;});
    var submit=form.querySelector('button[type="submit"]');
    if(submit)submit.remove();
    var actions=form.querySelector('.actions');
    if(actions&&!actions.children.length)actions.innerHTML='<span class="muted">Acesso somente para visualização.</span>';
  };
})();
