# Supabase

Projeto vinculado: tkdokwisgeqmflixvmff (System-Seller).

Migrações aplicadas:
1. seller_workspace_backend_storage
2. seller_explicit_deny_browser_access
3. production_core_schema
4. production_security_workflows
5. production_fk_indexes
6. production_browser_hardening

O núcleo de produção usa organizations, memberships, stores, customers, products, orders, order_items, inventory_movements, financial_transactions e audit_logs.

A tabela antiga seller_workspace permanece sem acesso de navegador e não é usada pelo frontend atual.

RPCs públicas controladas:
- create_workspace
- adjust_stock
- create_order
- change_order_status
- set_order_payment_status
- update_order_metadata

O Security Advisor foi executado depois das migrações sem alertas de segurança. O Performance Advisor não aponta mais foreign keys sem índice; em banco vazio, índices aparecem como unused até haver carga real.


A Edge Function legada seller-storage foi aposentada: a versão atual exige JWT e responde 410, não lendo nem gravando o armazenamento antigo.
