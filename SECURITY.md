# Segurança

## Princípios

- RLS habilitado nas tabelas expostas usadas pela aplicação.
- Separação multiempresa por organização e membership.
- Nenhuma service_role ou chave secreta fica no frontend.
- A chave sb_publishable é pública por design; autorização real é feita no banco por RLS.
- Pedidos alteram pedido, itens, estoque e financeiro em transação única no PostgreSQL.
- Cancelamentos estornam estoque pelo backend.
- Ajustes de estoque passam por RPC e geram livro de movimentações.
- Convites e gestão de equipe passam por funções controladas no backend.
- Funções privilegiadas de equipe ficam no schema privado e não têm EXECUTE público.
- O papel owner não pode ser removido/rebaixado pela gestão de equipe.
- Auditoria registra mudanças críticas.
- Financeiro e auditoria são restritos a proprietário/administrador.
- Registros operacionais centrais não podem sofrer hard delete pelo navegador.
- Usuários web não podem escrever integration_status de lojas; conexão só pode ser promovida por backend confiável.
- Fotos de perfil ficam em bucket privado e são exibidas por URLs assinadas.
- CSP, HSTS, anti-clickjacking, nosniff, Referrer Policy e Permissions Policy estão configurados para deploy na Vercel.
- Exportação CSV protege células iniciadas por =, +, - e @ contra formula injection.
- O painel autenticado é marcado como noindex; somente a página pública de divulgação deve ser indexada.

## Segredos

Nunca commite service_role, chaves secretas de Shopee/Mercado Livre, chave SMTP, tokens OAuth, senhas ou tokens privados.

## Estado atual dos advisors

O Security Advisor do Supabase não aponta falhas de schema/RLS. Existe um aviso de configuração do Auth: **Leaked Password Protection Disabled**.

Essa proteção deve ser habilitada no painel de Authentication antes de uma liberação ampla de clientes, quando disponível para o projeto/plano.

Os avisos de índices não utilizados são informativos em um banco novo e não significam falha de segurança.

## Produção

Já configurado:

1. HTTPS oficial na Vercel;
2. Site URL e Redirect URLs do Supabase Auth apontando para System Seller;
3. SMTP próprio via Brevo;
4. backup operacional JSON;
5. headers de segurança;
6. isolamento multiempresa e papéis.

Pendente de configuração externa:

1. habilitar proteção contra senhas vazadas no Supabase Auth;
2. aplicar os modelos de e-mail em português de `docs/EMAIL_TEMPLATES.md`;
3. definir retenção/backup gerenciado do banco conforme o plano do Supabase;
4. manter rastreamento de links desativado para mensagens de autenticação sempre que o provedor permitir, evitando reescrita dos links do Supabase.
