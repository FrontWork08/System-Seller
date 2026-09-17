(function(){
  "use strict";
  var S=window.SS;if(!S)return;
  function customer(form){return form&&form.elements.customer_id?String(form.elements.customer_id.value||""):"";}
  function render(row,standard,special){
    var input=row.querySelector(".order-price"),toggle=row.querySelector(".order-custom-price"),hint=row.querySelector(".order-price-hint");
    if(!input)return;
    var has=special!==null&&special!==undefined&&isFinite(Number(special));
    var effective=has?Number(special):Number(standard||0);
    input.dataset.standardPrice=effective.toFixed(2);
    input.dataset.catalogPrice=Number(standard||0).toFixed(2);
    input.dataset.priceSource=has?"customer":"catalog";
    if(!toggle||!toggle.checked){input.value=effective.toFixed(2);input.readOnly=true;}
    if(hint){
      if(toggle&&toggle.checked)hint.textContent="Preço personalizado neste pedido · base "+S.money(effective)+(has?" (especial do cliente).":".");
      else if(has)hint.textContent="Preço especial do cliente: "+S.money(effective)+" · padrão "+S.money(standard)+".";
      else hint.textContent="Preço padrão do produto: "+S.money(standard)+".";
    }
    S.updateEstimate();
  }
  async function apply(row,map){
    if(!row)return;
    var form=row.closest("#orderForm"),select=row.querySelector(".order-product");
    if(!form||!select||!select.value)return;
    var productId=select.value,customerId=customer(form),opt=select.selectedOptions&&select.selectedOptions[0];
    var standard=opt&&opt.dataset.price!==undefined?Number(opt.dataset.price||0):0,special=null;
    if(customerId){
      if(map)special=map[productId]?Number(map[productId].unit_price):null;
      else if(S.getCustomerPrice)special=await S.getCustomerPrice(customerId,productId);
    }
    if(select.value!==productId||customer(form)!==customerId)return;
    render(row,standard,special);
  }
  async function refresh(form){
    var customerId=customer(form),map=customerId&&S.customerPriceMap?await S.customerPriceMap(customerId):{};
    var rows=Array.from(form.querySelectorAll(".order-line"));
    for(var i=0;i<rows.length;i++){
      var toggle=rows[i].querySelector(".order-custom-price"),select=rows[i].querySelector(".order-product");
      if(select&&select.value&&!(toggle&&toggle.checked))await apply(rows[i],map);
    }
  }
  document.addEventListener("change",async function(ev){
    var t=ev.target;
    try{
      if(t.classList.contains("order-product")&&t.closest("#orderForm"))await apply(t.closest(".order-line"));
      else if(t.name==="customer_id"&&t.closest("#orderForm"))await refresh(t.closest("#orderForm"));
    }catch(err){S.toast(S.errText(err),"error");}
  },true);
})();
