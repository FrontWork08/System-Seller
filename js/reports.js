(function(){
  "use strict";
  var S=window.SS;if(!S)return;
  function firstOfMonth(){return S.todayIso().slice(0,7)+'-01';}
  function nextDay(value){var p=String(value).split('-').map(Number),d=new Date(Date.UTC(p[0],p[1]-1,p[2]+1));return d.toISOString().slice(0,10);}
  function csv(v){v=String(v==null?'':v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
  function download(name,text){var blob=new Blob([text],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},1000);}
  S.state.reportRange=S.state.reportRange||{start:firstOfMonth(),end:S.todayIso()};

  async function data(range){
    var start=S.zonedInputToIso(range.start+'T00:00');
    var end=S.zonedInputToIso(nextDay(range.end)+'T00:00');
    var parts=await Promise.all([
      S.sb.from('orders').select('*').eq('organization_id',S.state.orgId).gte('sold_at',start).lt('sold_at',end).neq('status','cancelled'),
      S.sb.from('order_items').select('*').eq('organization_id',S.state.orgId),
      S.sb.from('order_costs').select('*').eq('organization_id',S.state.orgId).gte('occurred_on',range.start).lte('occurred_on',range.end),
      S.sb.from('products').select('*').eq('organization_id',S.state.orgId),
      S.sb.from('order_production').select('*').eq('organization_id',S.state.orgId),
      S.getCore()
    ]);
    for(var i=0;i<5;i++)if(parts[i].error)throw parts[i].error;
    return {orders:parts[0].data||[],items:parts[1].data||[],costs:parts[2].data||[],products:parts[3].data||[],prod:parts[4].data||[],core:parts[5]};
  }

  function summarize(d){
    var ids=new Set(d.orders.map(function(o){return o.id;}));
    var items=d.items.filter(function(i){return ids.has(i.order_id);});
    var revenue=d.orders.reduce(function(a,o){return a+Number(o.total||0);},0);
    var received=d.orders.reduce(function(a,o){return a+Number(o.paid_amount||0);},0);
    var costs=d.costs.reduce(function(a,c){return a+Number(c.amount||0);},0);
    var productTotals={},customerTotals={},storeTotals={};
    items.forEach(function(i){var x=productTotals[i.product_id]||(productTotals[i.product_id]={qty:0,total:0});x.qty+=Number(i.quantity||0);x.total+=Number(i.line_total||0);});
    d.orders.forEach(function(o){customerTotals[o.customer_id]=(customerTotals[o.customer_id]||0)+Number(o.total||0);storeTotals[o.store_id]=(storeTotals[o.store_id]||0)+Number(o.total||0);});
    return {
      revenue:revenue,received:received,receivable:Math.max(0,revenue-received),costs:costs,profit:revenue-costs,
      average:d.orders.length?revenue/d.orders.length:0,
      overdue:d.orders.filter(function(o){return o.due_at&&new Date(o.due_at)<new Date()&&o.status!=='delivered';}).length,
      low:d.products.filter(function(p){return Number(p.stock)<=Number(p.min_stock);}).length,
      workload:d.prod.filter(function(p){return p.stage_id;}).length,
      productTotals:productTotals,customerTotals:customerTotals,storeTotals:storeTotals
    };
  }

  function topRows(map,names){return Object.keys(map).sort(function(a,b){var av=typeof map[a]==='object'?map[a].total:map[a],bv=typeof map[b]==='object'?map[b].total:map[b];return bv-av;}).slice(0,8).map(function(id){var v=map[id],total=typeof v==='object'?v.total:v;return '<div class="list-item"><span>'+S.e(names[id]||'Sem identificação')+'</span><strong>'+S.money(total)+'</strong></div>';}).join('')||'<div class="muted">Sem dados no período.</div>';}
  function metric(label,value,cls){return '<div class="metric"><small>'+label+'</small><strong'+(cls?' class="'+cls+'"':'')+'>'+value+'</strong></div>';}

  S.pageReports=async function(){
    if(!S.canAdmin())throw new Error('Acesso restrito à administração.');
    var page=document.getElementById('page'),r=S.state.reportRange,d=await data(r),s=summarize(d),cm={},sm={},pm={};
    d.core.customers.forEach(function(x){cm[x.id]=x.name;});d.core.stores.forEach(function(x){sm[x.id]=x.name;});d.core.products.forEach(function(x){pm[x.id]=x.name;});
    page.innerHTML='<div class="page-head"><div><h2>Relatórios</h2><p>Indicadores operacionais e financeiros por período.</p></div><button class="secondary" data-modular-action="export-report">Exportar CSV</button></div>'+
      '<form data-modular-form="report-range" class="toolbar"><div class="field"><label>De</label><input name="start" type="date" value="'+S.e(r.start)+'"></div><div class="field"><label>Até</label><input name="end" type="date" value="'+S.e(r.end)+'"></div><button class="primary" type="submit">Aplicar</button></form>'+
      '<div class="metric-row">'+metric('Receita',S.money(s.revenue))+metric('A receber',S.money(s.receivable))+metric('Custos',S.money(s.costs))+metric('Lucro bruto',S.money(s.profit),s.profit>=0?'profit-positive':'profit-negative')+'</div>'+
      '<div class="metric-row">'+metric('Ticket médio',S.money(s.average))+metric('Pedidos atrasados',s.overdue)+metric('Estoque baixo',s.low)+metric('Carga de produção',s.workload)+'</div>'+
      '<div class="modular-grid"><div class="panel"><div class="panel-head"><h3>Produtos mais vendidos</h3></div><div class="panel-body list">'+topRows(s.productTotals,pm)+'</div></div><div class="panel"><div class="panel-head"><h3>Clientes por vendas</h3></div><div class="panel-body list">'+topRows(s.customerTotals,cm)+'</div></div><div class="panel"><div class="panel-head"><h3>Vendas por canal</h3></div><div class="panel-body list">'+topRows(s.storeTotals,sm)+'</div></div></div>';
  };

  S.exportReportCsv=async function(){
    var r=S.state.reportRange,d=await data(r),s=summarize(d),lines=[['Métrica','Valor'],['Receita',s.revenue.toFixed(2)],['Recebido',s.received.toFixed(2)],['A receber',s.receivable.toFixed(2)],['Custos',s.costs.toFixed(2)],['Lucro bruto',s.profit.toFixed(2)],['Ticket médio',s.average.toFixed(2)],['Pedidos atrasados',s.overdue],['Estoque baixo',s.low],['Carga de produção',s.workload]];
    download('system-seller-relatorio-'+r.start+'-a-'+r.end+'.csv','\ufeff'+lines.map(function(row){return row.map(csv).join(';');}).join('\n'));
  };

  document.addEventListener('submit',async function(ev){var form=ev.target.closest('form[data-modular-form="report-range"]');if(!form)return;ev.preventDefault();var f=Object.fromEntries(new FormData(form).entries());if(!f.start||!f.end||f.end<f.start)return S.toast('Revise o período do relatório.','error');S.state.reportRange={start:f.start,end:f.end};await S.pageReports();});
  document.addEventListener('click',async function(ev){var b=ev.target.closest('[data-modular-action="export-report"]');if(!b)return;try{await S.exportReportCsv();}catch(err){S.toast(S.errText(err),'error');}});

  var baseDashboard=S.pageDashboard;
  if(baseDashboard)S.pageDashboard=async function(){
    await baseDashboard();
    if(!S.canAdmin())return;
    try{
      var d=await data({start:firstOfMonth(),end:S.todayIso()}),s=summarize(d),page=document.getElementById('page');if(!page)return;
      page.insertAdjacentHTML('beforeend','<div class="section-title">Operação e rentabilidade do mês</div><div class="metric-row">'+metric('A receber',S.money(s.receivable))+metric('Lucro bruto',S.money(s.profit),s.profit>=0?'profit-positive':'profit-negative')+metric('Atrasados',s.overdue)+metric('Produção ativa',s.workload)+'</div>');
    }catch(e){console.warn('KPI expansion',e);}
  };
})();
