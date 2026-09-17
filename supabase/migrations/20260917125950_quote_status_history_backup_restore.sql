create or replace function private.restore_quote_status_history_backup_v2_impl(p_organization_id uuid, p_backup jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_restored integer := 0;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.organizations where id=p_organization_id and owner_user_id=v_user) then
    raise exception 'only the organization owner can restore a backup';
  end if;

  -- Backups v2 gerados antes desta correção não possuem esta chave.
  -- Nesse caso preservamos o histórico mínimo recriado pelo trigger ao restaurar os orçamentos.
  if not (p_backup ? 'quote_status_history') then
    return jsonb_build_object('quote_status_history_rows', 0, 'quote_status_history_legacy_backup', true);
  end if;

  if jsonb_typeof(coalesce(p_backup->'quote_status_history', '[]'::jsonb)) <> 'array' then
    raise exception 'invalid backup section: quote_status_history';
  end if;
  if jsonb_array_length(coalesce(p_backup->'quote_status_history', '[]'::jsonb)) > 100000 then
    raise exception 'backup section is too large: quote_status_history';
  end if;

  delete from public.quote_status_history
  where organization_id = p_organization_id;

  insert into public.quote_status_history(
    id, organization_id, quote_id, status, notes, changed_by, changed_at
  )
  select
    x.id,
    p_organization_id,
    x.quote_id,
    x.status,
    x.notes,
    case
      when x.changed_by is null then null
      when exists(select 1 from auth.users u where u.id=x.changed_by) then x.changed_by
      else v_user
    end,
    coalesce(x.changed_at, now())
  from jsonb_to_recordset(coalesce(p_backup->'quote_status_history', '[]'::jsonb)) as x(
    id uuid,
    organization_id uuid,
    quote_id uuid,
    status text,
    notes text,
    changed_by uuid,
    changed_at timestamptz
  )
  where exists(
    select 1 from public.quotes q
    where q.id=x.quote_id and q.organization_id=p_organization_id
  );

  get diagnostics v_restored = row_count;
  return jsonb_build_object('quote_status_history_rows', v_restored, 'quote_status_history_legacy_backup', false);
end $$;

create or replace function public.restore_workspace_backup_v2(p_organization_id uuid, p_backup jsonb)
returns jsonb
language plpgsql
set search_path=''
as $$
declare
  v_result jsonb;
  v_pricing jsonb;
  v_quote_history jsonb;
begin
  v_result := private.restore_workspace_backup_v2_impl(p_organization_id, p_backup);
  v_pricing := private.restore_3d_pricing_backup_v2_impl(p_organization_id, p_backup);
  v_quote_history := private.restore_quote_status_history_backup_v2_impl(p_organization_id, p_backup);
  return coalesce(v_result, '{}'::jsonb)
    || coalesce(v_pricing, '{}'::jsonb)
    || coalesce(v_quote_history, '{}'::jsonb);
end $$;

revoke all on function public.restore_workspace_backup_v2(uuid,jsonb) from public;
grant execute on function public.restore_workspace_backup_v2(uuid,jsonb) to authenticated;
