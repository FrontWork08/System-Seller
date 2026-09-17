(function(){
  "use strict";
  var S=window.SS;if(!S)return;
  var basePrint=S.printBusinessDocument;
  if(basePrint)S.printBusinessDocument=async function(type,id){
    if(!S.canWrite())throw new Error('Sua permissão não permite gerar documentos.');
    if(type==='receipt'&&!S.canAdmin())throw new Error('Recibos com histórico de pagamentos são restritos à administração.');
    return basePrint(type,id);
  };
  var basePage=S.pageDocuments;
  if(basePage)S.pageDocuments=async function(){
    await basePage();
    if(!S.canWrite()){
      document.querySelectorAll('[data-modular-action="doc-quote"],[data-modular-action="doc-receipt"],[data-modular-action="doc-work"]').forEach(function(el){el.remove();});
      return;
    }
    if(!S.canAdmin())document.querySelectorAll('[data-modular-action="doc-receipt"]').forEach(function(el){el.remove();});
  };
})();
