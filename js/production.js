(function () {
  "use strict";
  var S = window.SS;
  if (!S) return;

  async function loadProduction() {
    var parts = await Promise.all([
      S.sb.from('production_stages').select('*').eq('organization_id',S.state.orgId).order('position'),
      S.sb.from('order_production').select('*').eq('organization_id',S.state.orgId).order('updated_at',{ascending:false}),
      S.sb.from('orders').select('id,external_id,customer_id,status,payment_status,total,due_at,updated_at,created_at').eq('organization_id',S.state.orgId).neq('status','cancelled').order('created_at',{ascending:false}),
      S.getCore()
    ]);
    for (var i=0;i<3;i++) if (parts[i].error) throw parts[i].error;
    return { stages:parts[0].data||[], production:parts[1].data||[], orders:parts[2].data||[], core:parts[3] };
  }

  S.pageProduction = async function () {
    var page = document.getElementById('page');
    var data = await loadProduction();
    var pm={}, cm={};
    data.production.forEach(function(x){pm[x.order_id]=x;});
    data.core.customers.forEach(function(x){cm[x.id]=x.name;});
    var columns = data.stages.filter(function(s){return s.active;}).map(function(stage){
      var orders = data.orders.filter(function(o){return pm[o.id] && pm[o.id].stage_id===stage.id;});
      return '<section class="stage-column"><header><h3>'+S.e(stage.name)+'</h3><span class="badge">'+orders.length+'</span></header><div class="stage-list">'+
        (orders.length?orders.map(function(o){var p=pm[o.id];var late=o.due_at&&new Date(o.due_at)<new Date();return '<button class="stage-card" data-modular-action="edit-production" data-id="'+o.id+'"><strong>'+S.e(o.external_id||('#'+o.id.slice(0,8)))+'</strong><small>'+S.e(cm[o.customer_id]||'Sem cliente')+'</small><small'+(late?' class="overdue"':'')+'>'+ (p.planned_finish?'Fim '+S.dt(p.planned_finish):(o.due_at?'Entrega '+S.dt(o.due_at):'Sem prazo'))+'</small></button>';}).join(''):'<div class="muted">Nenhum pedido</div>')+
        '</div></section>';
    }).join('');
    var unassigned=data.orders.filter(function(o){return !pm[o.id]||!pm[o.id].stage_id;});
    page.innerHTML='<div class="page-head"><div><h2>Produção</h2><p>Acompanhe etapas, responsáveis, prazos e histórico operacional.</p></div><div class="actions">'+(S.canAdmin()?'<button class="secondary" data-modular-action="manage-stages">Gerenciar etapas</button>':'')+'</div></div>'+
      (unassigned.length?'<div class="panel" style="margin-bottom:14px"><div class="panel-head"><h3>Sem etapa de produção</h3></div><div class="panel-body compact-list">'+unassigned.slice(0,20).map(function(o){return '<div><button class="link-btn" data-modular-action="edit-production" data-id="'+o.id+'">'+S.e(o.external_id||('#'+o.id.slice(0,8)))+'</button> · '+S.e(cm[o.customer_id]||'Sem cliente')+'</div>';}).join('')+'</div></div>':'')+
      '<div class="stage-board">'+columns+'</div>';
  };

  async function openProduction(orderId) {
    var parts=await Promise.all([
      S.sb.from('orders').select('*').eq('id',orderId).eq('organization_id',S.state.orgId).single(),
      S.sb.from('order_production').select('*').eq('order_id',orderId).maybeSingle(),
      S.sb.from('production_stage_history').select('*').eq('order_id',orderId).order('entered_at',{ascending:false}),
      S.sb.from('production_stages').select('*').eq('organization_id',S.state.orgId).order('position'),
      S.sb.rpc('list_team_members',{p_org:S.state.orgId})
    ]);
    if(parts[0].error)throw parts[0].error;if(parts[1].error)throw parts[1].error;if(parts[2].error)throw parts[2].error;if(parts[3].error)throw parts[3].error;if(parts[4].error)throw parts[4].error;
    var o=parts[0].data,p=parts[1].data||{},hist=parts[2].data||[],stages=parts[3].data||[],members=parts[4].data||[];
    var stageOpts='<option value="">Sem etapa</option>'+stages.filter(function(s){return s.active||s.id===p.stage_id;}).map(function(s){return '<option value="'+s.id+'"'+(s.id===p.stage_id?' selected':'')+'>'+S.e(s.name)+'</option>';}).join('');
    var memberOpts='<option value="">Sem responsável</option>'+members.map(function(m){return '<option value="'+m.user_id+'"'+(m.user_id===p.responsible_user_id?' selected':'')+'>'+S.e(m.full_name||m.email||m.user_id.slice(0,8))+'</option>';}).join('');
    S.modal('Produção · '+(o.external_id||('#'+o.id.slice(0,8))),'<form data-modular-form="production" data-order-id="'+o.id+'" data-base="'+S.e(p.updated_at||'')+'"><div class="form-grid">'+
      '<div class="field"><label>Etapa</label><select name="stage_id">'+stageOpts+'</select></div><div class="field"><label>Responsável</label><select name="responsible_user_id">'+memberOpts+'</select></div>'+
      '<div class="field"><label>Início planejado</label><input name="planned_start" type="datetime-local" value="'+S.localInput(p.planned_start)+'"></div><div class="field"><label>Fim planejado</label><input name="planned_finish" type="datetime-local" value="'+S.localInput(p.planned_finish)+'"></div>'+
      '<div class="field"><label>Duração estimada (min)</label><input name="estimated_minutes" type="number" min="0" step="1" value="'+(p.estimated_minutes==null?'':Number(p.estimated_minutes))+'"></div><div class="field"><label>Entrega do pedido</label><input value="'+S.e(o.due_at?S.dt(o.due_at):'Sem prazo')+'" disabled></div>'+
      '<div class="field span2"><label>Notas operacionais</label><textarea name="notes" maxlength="2000">'+S.e(p.notes||'')+'</textarea></div></div><div class="actions"><button class="primary" type="submit">Salvar produção</button></div></form>'+
      '<div class="section-title">Histórico de etapas</div><div class="compact-list">'+(hist.length?hist.map(function(h){return '<div><strong>'+S.e(h.stage_name_snapshot)+'</strong><small class="muted">Entrou '+S.dt(h.entered_at)+(h.exited_at?' · saiu '+S.dt(h.exited_at):' · atual')+'</small></div>';}).join(''):'<div class="muted">Ainda sem histórico.</div>')+'</div>',true);
  }

  async function manageStages(){
    var res=await S.sb.from('production_stages').select('*').eq('organization_id',S.state.orgId).order('position');if(res.error)throw res.error;
    var rows=res.data||[];
    S.modal('Gerenciar etapas','<div class="actions"><button class="primary" data-modular-action="new-stage">+ Nova etapa</button></div><div class="section-title">Etapas</div><div class="compact-list">'+rows.map(function(s){return '<div><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><span><strong>'+S.e(s.name)+'</strong><small class="muted">Posição '+s.position+' · '+(s.active?'ativa':'inativa')+'</small></span><span class="actions"><button class="ghost mini" data-modular-action="move-stage" data-id="'+s.id+'" data-dir="-1">↑</button><button class="ghost mini" data-modular-action="move-stage" data-id="'+s.id+'" data-dir="1">↓</button><button class="secondary mini" data-modular-action="edit-stage" data-id="'+s.id+'" data-name="'+S.e(s.name)+'" data-active="'+s.active+'">Editar</button><button class="danger-btn mini" data-modular-action="delete-stage" data-id="'+s.id+'">Excluir</button></span></div></div>';}).join('')+'</div>',true);
  }
  function openStageForm(stage){stage=stage||{};S.modal(stage.id?'Editar etapa':'Nova etapa','<form data-modular-form="stage"'+(stage.id?' data-id="'+stage.id+'"':'')+'><div class="field"><label>Nome</label><input name="name" maxlength="80" value="'+S.e(stage.name||'')+'" required></div><div class="field"><label>Situação</label><select name="active"><option value="true"'+(stage.active!==false?' selected':'')+'>Ativa</option><option value="false"'+(stage.active===false?' selected':'')+'>Inativa</option></select></div><button class="primary" type="submit">Salvar etapa</button></form>');}

  document.addEventListener('click',async function(ev){var b=ev.target.closest('[data-modular-action]');if(!b)return;try{var a=b.dataset.modularAction;if(a==='edit-production')await openProduction(b.dataset.id);else if(a==='manage-stages')await manageStages();else if(a==='new-stage')openStageForm();else if(a==='edit-stage')openStageForm({id:b.dataset.id,name:b.dataset.name,active:b.dataset.active==='true'});else if(a==='move-stage'){var m=await S.sb.rpc('move_production_stage',{p_stage_id:b.dataset.id,p_direction:Number(b.dataset.dir)});if(m.error)throw m.error;await manageStages();}else if(a==='delete-stage'){if(!confirm('Excluir esta etapa? Só é permitido quando não há histórico ou pedido usando-a.'))return;var d=await S.sb.rpc('delete_production_stage',{p_stage_id:b.dataset.id});if(d.error)throw d.error;await manageStages();}}catch(err){S.toast(S.errText(err),'error');}});

  document.addEventListener('submit',async function(ev){var form=ev.target.closest('form[data-modular-form]');if(!form)return;if(form.dataset.modularForm!=='production'&&form.dataset.modularForm!=='stage')return;ev.preventDefault();S.busy(form,true);try{var f=Object.fromEntries(new FormData(form).entries());if(form.dataset.modularForm==='stage'){var r=await S.sb.rpc('save_production_stage',{p_stage_id:form.dataset.id||null,p_organization_id:S.state.orgId,p_name:String(f.name).trim(),p_active:f.active==='true'});if(r.error)throw r.error;S.closeModal();S.toast('Etapa salva.');await S.pageProduction();}else{var payload={order_id:form.dataset.orderId,stage_id:f.stage_id||null,planned_start:f.planned_start?S.zonedInputToIso(f.planned_start):null,planned_finish:f.planned_finish?S.zonedInputToIso(f.planned_finish):null,estimated_minutes:f.estimated_minutes===''?null:Number(f.estimated_minutes),responsible_user_id:f.responsible_user_id||null,notes:f.notes||null};if(payload.planned_start&&payload.planned_finish&&new Date(payload.planned_finish)<new Date(payload.planned_start))throw new Error('O fim planejado não pode ser anterior ao início.');if(!navigator.onLine&&S.queueOfflineMutation){await S.queueOfflineMutation('production_update',payload,form.dataset.base||null);S.toast('Alteração de produção adicionada à fila offline.');}else{var u=await S.sb.rpc('upsert_order_production',{p_order_id:payload.order_id,p_stage_id:payload.stage_id,p_planned_start:payload.planned_start,p_planned_finish:payload.planned_finish,p_estimated_minutes:payload.estimated_minutes,p_responsible_user_id:payload.responsible_user_id,p_notes:payload.notes});if(u.error)throw u.error;S.toast('Produção atualizada.');}S.closeModal();await S.pageProduction();}}catch(err){S.toast(S.errText(err),'error');}finally{if(document.body.contains(form))S.busy(form,false);}});
})();
