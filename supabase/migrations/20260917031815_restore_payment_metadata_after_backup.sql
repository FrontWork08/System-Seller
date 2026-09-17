create or replace function private.restore_payment_metadata_impl(
  p_organization_id uuid,
  p_backup jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1 from public.organizations o
    where o.id = p_organization_id
      and o.owner_user_id = (select auth.uid())
  ) then
    raise exception 'only the organization owner can restore payment metadata';
  end if;

  update public.financial_transactions f
     set payment_method = x.payment_method,
         paid_at = x.paid_at
    from jsonb_to_recordset(p_backup->'financial_transactions') as x(
      id uuid,
      payment_method text,
      paid_at timestamptz
    )
   where f.id = x.id
     and f.organization_id = p_organization_id;
end;
$$;

revoke all on function private.restore_payment_metadata_impl(uuid,jsonb) from public;
revoke all on function private.restore_payment_metadata_impl(uuid,jsonb) from anon;
grant execute on function private.restore_payment_metadata_impl(uuid,jsonb) to authenticated;

create or replace function public.restore_workspace_backup(
  p_organization_id uuid,
  p_backup jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  v_result := private.restore_workspace_backup_impl(p_organization_id, p_backup);
  perform private.restore_payment_metadata_impl(p_organization_id, p_backup);
  return v_result;
end;
$$;

revoke all on function public.restore_workspace_backup(uuid, jsonb) from public;
revoke all on function public.restore_workspace_backup(uuid, jsonb) from anon;
grant execute on function public.restore_workspace_backup(uuid, jsonb) to authenticated;
