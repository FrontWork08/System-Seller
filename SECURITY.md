# Segurança

## Princípios

- RLS habilitado nas tabelas expostas usadas pela aplicação.
- Separação multiempresa por organização e membership.
- Nenhuma service_role ou chave secreta fica no frontend.
- A chave sb_publishable é pública por design; autorização real é feita no banco por RLS.
- Pedidos alteram pedido, itens, estoque e financeiro em transação única no PostgreSQL.
- Cancelamentos estornam estoque pelo backend.
- Ajustes de estoque passam por RPC e geram livro de movimentações.
- Auditoria registra mudanças críticas.
- Financeiro e auditoria são restritos a proprietário/administrador.
- CSP, HSTS, anti-clickjacking, nosniff, Referrer Policy e Permissions Policy estão configurados para deploy na Vercel.
- Exportação CSV protege células iniciadas por =, +, - e @ contra formula injection.

## Segredos

Nunca commite service_role, chaves secretas de Shopee/Mercado Livre, SMTP, tokens OAuth ou senhas.

## Produção

Antes de convidar clientes externos:
1. use domínio HTTPS oficial;
2. configure Site URL e Redirect URLs no Supabase Auth;
3. configure SMTP próprio e confiável para confirmação/recuperação de conta;
4. configure backups e retenção adequados ao plano do banco.
