(function(){
  "use strict";
  var S=window.SS;if(!S)return;
  function isoDay(d){return d.toISOString().slice(0,10);}
  function startOfWeek(ref){var d=new Date(ref);var day=(d.getDay()+6)%7;d.setHours(0,0,0,0);d.setDate(d.getDate()-day);return d;}
  function sameDay(a,b){return a&&new Date(a).toLocaleDateString('en-CA',{timeZone:S.cfg.timezone})===b;}
  S.state.calendarView=S.state.calendarView||{offset:0,mode:'week'};
  S.pageCalendar=async function(){
    var page=document.getElementById('page');var v=S.state.calendarView||{offset:0,mode:'week'};
    var base=startOfWeek(new Date());base.setDate(base.getDate()+v.offset*7);
    var end=new Date(base);end.setDate(end.getDate()+7);
    var parts=await Promise.all([
      S.sb.from('order_production').select('*').eq('organization_id',S.state.orgId),
      S.sb.from('orders').select('id,external_id,customer_id,due_at,status').eq('organization_id',S.state.orgId).neq('status','cancelled'),
      S.sb.from('production_stages').select('*').eq('organization_id',S.state.orgId),
      S.getCore()
    ]);for(var i=0;i<3;i++)if(parts[i].error)throw parts[i].error;
    var prod=parts[0].data||[],orders=parts[1].data||[],stages=parts[2].data||[],core=parts[3];var pm={},sm={},cm={};prod.forEach(function(x){pm[x.order_id]=x;});stages.forEach(function(x){sm[x.id]=x.name;});core.customers.forEach(function(x){cm[x.id]=x.name;});
    var today=S.todayIso();var days=[];for(var j=0;j<7;j++){var d=new Date(base);d.setDate(d.getDate()+j);days.push(d);}
    var html=days.map(function(d){var key=isoDay(d);var events=[];orders.forEach(function(o){var p=pm[o.id]||{};if(sameDay(p.planned_start,key))events.push({kind:'Início',o:o,p:p});if(sameDay(p.planned_finish,key))events.push({kind:'Fim',o:o,p:p});if(sameDay(o.due_at,key))events.push({kind:'Entrega',o:o,p:p});});return '<section class="calendar-day"><h4>'+new Intl.DateTimeFormat('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit',timeZone:S.cfg.timezone}).format(d)+'</h4>'+events.map(function(e){var late=e.o.due_at&&new Date(e.o.due_at)<new Date()&&e.o.status!=='delivered';return '<button class="calendar-event '+(late?'overdue ':'')+(key===today?'today':'')+'" data-modular-action="calendar-production" data-id="'+e.o.id+'"><strong>'+S.e(e.kind+' · '+(e.o.external_id||('#'+e.o.id.slice(0,8))))+'</strong><div>'+S.e(cm[e.o.customer_id]||'Sem cliente')+'</div><small>'+S.e(sm[e.p.stage_id]||'Sem etapa')+(e.p.estimated_minutes?' · '+e.p.estimated_minutes+' min':'')+'</small></button>';}).join('')+'</section>';}).join('');
    page.innerHTML='<div class="page-head"><div><h2>Calendário de produção</h2><p>Inícios, finais planejados e prazos de entrega em uma única visão.</p></div><div class="actions"><button class="ghost" data-modular-action="calendar-prev">← Semana anterior</button><button class="secondary" data-modular-action="calendar-today">Hoje</button><button class="ghost" data-modular-action="calendar-next">Próxima semana →</button></div></div><div class="calendar-grid">'+html+'</div>';
  };
  document.addEventListener('click',async function(ev){var b=ev.target.closest('[data-modular-action]');if(!b)return;try{if(b.dataset.modularAction==='calendar-prev'){S.state.calendarView.offset--;await S.pageCalendar();}else if(b.dataset.modularAction==='calendar-next'){S.state.calendarView.offset++;await S.pageCalendar();}else if(b.dataset.modularAction==='calendar-today'){S.state.calendarView.offset=0;await S.pageCalendar();}else if(b.dataset.modularAction==='calendar-production'){S.state.page='production';S.renderShell();await S.loadPage();setTimeout(function(){var fake=document.createElement('button');fake.dataset.modularAction='edit-production';fake.dataset.id=b.dataset.id;fake.style.display='none';document.body.appendChild(fake);fake.click();fake.remove();},0);}}catch(err){S.toast(S.errText(err),'error');}});
})();
