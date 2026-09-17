alter table public.orders
  add column if not exists paid_amount numeric(14,2) not null default 0;

alter table public.orders
  drop constraint if exists orders_paid_amount_check;
alter table public.orders
  add constraint orders_paid_amount_check check (paid_amount >= 0);

alter table public.financial_transactions
  add column if not exists payment_method text,
  add column if not exists paid_at timestamptz;

alter table public.financial_transactions
  drop constraint if exists financial_transactions_payment_method_check;
alter table public.financial_transactions
  add constraint financial_transactions_payment_method_check
  check (
    payment_method is null or payment_method in (
      'pix','cash','credit_card','debit_card','bank_transfer','boleto','other'
    )
  );

create index if not exists financial_transactions_order_payment_idx
  on public.financial_transactions(order_id, kind, status)
  where order_id is not null;

create or replace function private.sync_order_payment_summary(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total numeric(14,2);
  v_paid numeric(14,2);
  v_current_status text;
begin
  if p_order_id is null then return; end if;

  select o.total, o.payment_status
    into v_total, v_current_status
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then return; end if;

  select coalesce(sum(f.amount), 0)::numeric(14,2)
    into v_paid
  from public.financial_transactions f
  where f.order_id = p_order_id
    and f.kind = 'income'
    and f.status = 'paid';

  v_paid := least(coalesce(v_total, 0), coalesce(v_paid, 0));

  update public.orders
     set paid_amount = v_paid,
         payment_status = case
           when v_current_status = 'refunded' then 'refunded'
           when coalesce(v_total,0) > 0 and v_paid >= v_total then 'paid'
           when v_paid > 0 then 'partial'
           else 'pending'
         end
   where id = p_order_id;
end;
$$;

revoke all on function private.sync_order_payment_summary(uuid) from public;
revoke all on function private.sync_order_payment_summary(uuid) from anon;
revoke all on function private.sync_order_payment_summary(uuid) from authenticated;

create or replace function private.financial_payment_summary_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.order_id is not null then
      perform private.sync_order_payment_summary(old.order_id);
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.order_id is distinct from new.order_id and old.order_id is not null then
    perform private.sync_order_payment_summary(old.order_id);
  end if;

  if new.order_id is not null then
    perform private.sync_order_payment_summary(new.order_id);
  end if;
  return new;
end;
$$;

revoke all on function private.financial_payment_summary_trigger() from public;
revoke all on function private.financial_payment_summary_trigger() from anon;
revoke all on function private.financial_payment_summary_trigger() from authenticated;

drop trigger if exists sync_order_payment_summary on public.financial_transactions;
create trigger sync_order_payment_summary
after insert or update or delete on public.financial_transactions
for each row execute function private.financial_payment_summary_trigger();

update public.financial_transactions
   set payment_method = coalesce(payment_method, 'other'),
       paid_at = coalesce(paid_at, created_at)
 where order_id is not null
   and kind = 'income'
   and status = 'paid';

update public.orders o
   set paid_amount = least(
     o.total,
     coalesce((
       select sum(f.amount)
       from public.financial_transactions f
       where f.order_id = o.id
         and f.kind = 'income'
         and f.status = 'paid'
     ), 0)
   );

update public.orders
   set payment_status = case
     when payment_status = 'refunded' then 'refunded'
     when total > 0 and paid_amount >= total then 'paid'
     when paid_amount > 0 then 'partial'
     else 'pending'
   end;

create or replace function private.record_order_payment_impl(
  p_order_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_paid_at timestamptz,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_payment_id uuid := gen_random_uuid();
  v_amount numeric(14,2);
  v_remaining numeric(14,2);
  v_method text := lower(btrim(coalesce(p_payment_method,'')));
  v_paid_at timestamptz := coalesce(p_paid_at, now());
  v_notes text := nullif(btrim(coalesce(p_notes,'')), '');
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then raise exception 'Order not found'; end if;
  if not private.has_org_role(v_order.organization_id, array['owner','admin']) then raise exception 'Forbidden'; end if;
  if v_order.status = 'cancelled' then raise exception 'Cannot receive payment for a cancelled order'; end if;
  if v_order.payment_status = 'refunded' then raise exception 'Refunded order cannot receive new payment'; end if;

  v_amount := round(coalesce(p_amount,0), 2);
  if v_amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  if v_method not in ('pix','cash','credit_card','debit_card','bank_transfer','boleto','other') then
    raise exception 'Invalid payment method';
  end if;

  v_remaining := greatest(round(v_order.total - v_order.paid_amount, 2), 0);
  if v_remaining <= 0 then raise exception 'Order is already fully paid'; end if;
  if v_amount > v_remaining then raise exception 'Payment exceeds remaining balance'; end if;

  insert into public.financial_transactions(
    id, organization_id, order_id, kind, category, description, amount,
    occurred_on, status, payment_method, paid_at, created_by
  ) values (
    v_payment_id, v_order.organization_id, v_order.id, 'income', 'Venda',
    case when v_notes is null then 'Pagamento do pedido'
         else left('Pagamento do pedido · ' || v_notes, 240) end,
    v_amount,
    (v_paid_at at time zone 'America/Sao_Paulo')::date,
    'paid', v_method, v_paid_at, (select auth.uid())
  );

  return v_payment_id;
end;
$$;

revoke all on function private.record_order_payment_impl(uuid,numeric,text,timestamptz,text) from public;
revoke all on function private.record_order_payment_impl(uuid,numeric,text,timestamptz,text) from anon;
grant execute on function private.record_order_payment_impl(uuid,numeric,text,timestamptz,text) to authenticated;

create or replace function public.record_order_payment(
  p_order_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_paid_at timestamptz default null,
  p_notes text default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.record_order_payment_impl(p_order_id,p_amount,p_payment_method,p_paid_at,p_notes)
$$;

revoke all on function public.record_order_payment(uuid,numeric,text,timestamptz,text) from public;
revoke all on function public.record_order_payment(uuid,numeric,text,timestamptz,text) from anon;
grant execute on function public.record_order_payment(uuid,numeric,text,timestamptz,text) to authenticated;

create or replace function public.create_order_with_payment(
  p_organization_id uuid,
  p_store_id uuid,
  p_customer_id uuid,
  p_external_id text,
  p_due_at timestamptz,
  p_sold_at timestamptz,
  p_shipping numeric,
  p_discount numeric,
  p_tracking_code text,
  p_notes text,
  p_items jsonb,
  p_initial_payment numeric default 0,
  p_payment_method text default null,
  p_payment_paid_at timestamptz default null,
  p_payment_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_initial numeric(14,2) := round(coalesce(p_initial_payment,0),2);
begin
  v_order_id := private.create_order_impl(
    p_organization_id,p_store_id,p_customer_id,p_external_id,'pending',p_due_at,p_sold_at,
    p_shipping,p_discount,p_tracking_code,p_notes,p_items
  );

  if v_initial < 0 then raise exception 'Initial payment cannot be negative'; end if;
  if v_initial > 0 then
    perform private.record_order_payment_impl(
      v_order_id,v_initial,p_payment_method,p_payment_paid_at,p_payment_notes
    );
  end if;

  return v_order_id;
end;
$$;

revoke all on function public.create_order_with_payment(uuid,uuid,uuid,text,timestamptz,timestamptz,numeric,numeric,text,text,jsonb,numeric,text,timestamptz,text) from public;
revoke all on function public.create_order_with_payment(uuid,uuid,uuid,text,timestamptz,timestamptz,numeric,numeric,text,text,jsonb,numeric,text,timestamptz,text) from anon;
grant execute on function public.create_order_with_payment(uuid,uuid,uuid,text,timestamptz,timestamptz,numeric,numeric,text,text,jsonb,numeric,text,timestamptz,text) to authenticated;

create or replace function private.set_order_payment_status_impl(p_order_id uuid, p_payment_status text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_ok boolean;
  v_remaining numeric(14,2);
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_payment_status not in ('pending','paid','partial','refunded') then raise exception 'Invalid payment status'; end if;

  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if not private.has_org_role(v_order.organization_id,array['owner','admin']) then raise exception 'Forbidden'; end if;
  if p_payment_status=v_order.payment_status then return p_payment_status; end if;

  v_ok=
    (v_order.payment_status='pending' and p_payment_status in ('partial','paid')) or
    (v_order.payment_status='partial' and p_payment_status in ('paid','refunded')) or
    (v_order.payment_status='paid' and p_payment_status='refunded');
  if not v_ok then raise exception 'Invalid payment transition'; end if;

  if p_payment_status='paid' then
    v_remaining := greatest(round(v_order.total - v_order.paid_amount,2),0);
    if v_remaining > 0 then
      insert into public.financial_transactions(
        organization_id,order_id,kind,category,description,amount,occurred_on,status,
        payment_method,paid_at,created_by
      ) values(
        v_order.organization_id,p_order_id,'income','Venda','Quitação manual do pedido',v_remaining,
        (now() at time zone 'America/Sao_Paulo')::date,'paid','other',now(),(select auth.uid())
      );
    end if;
    update public.orders set payment_status='paid', paid_amount=total where id=p_order_id;
  elsif p_payment_status='partial' then
    if v_order.paid_amount <= 0 then raise exception 'Record a payment amount before marking partial'; end if;
    update public.orders set payment_status='partial' where id=p_order_id;
  elsif p_payment_status='refunded' then
    update public.financial_transactions
       set status='cancelled'
     where order_id=p_order_id and kind='income' and status<>'cancelled';
    update public.orders set payment_status='refunded', paid_amount=0 where id=p_order_id;
  end if;

  return p_payment_status;
end;
$$;
