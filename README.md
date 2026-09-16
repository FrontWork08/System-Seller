# System Seller

Sistema web multiempresa para gestão de pedidos, estoque, clientes, prazos e financeiro.

## O que funciona

- autenticação por e-mail e senha, cadastro e recuperação de acesso;
- isolamento entre empresas com Row Level Security;
- empresas, lojas, clientes e produtos;
- estoque mínimo e ajustes com livro de movimentações;
- pedidos com vários itens, frete, desconto, prazo e rastreio;
- baixa de estoque transacional na criação do pedido;
- cancelamento com estorno automático de estoque;
- pagamento e reembolso vinculados ao financeiro;
- receitas e despesas manuais;
- auditoria de alterações críticas;
- hard delete de empresa, produto, cliente e loja bloqueado no navegador;
- estado de integração de marketplace não pode ser forjado pelo cliente web;
- exportação CSV protegida contra células executáveis;
- interface responsiva;
- Shopee e Mercado Livre disponíveis como canais, sem simular integração antes das APIs oficiais.

## Segurança e integridade

O frontend usa apenas a credencial pública própria para aplicações web. Credenciais privilegiadas ficam fora do navegador. A autorização é aplicada no banco por RLS e por funções transacionais.

Papéis disponíveis: owner, admin, operator e viewer. Financeiro e auditoria ficam restritos a owner/admin.

Ao criar um pedido, o backend valida organização e itens, bloqueia os produtos, valida saldo, grava pedido/itens, reduz estoque, registra movimentações e, quando aplicável, cria a receita. Se uma etapa falhar, a transação inteira é revertida.

## Validação realizada

O backend foi testado em uma transação de QA revertida ao final, cobrindo criação de empresa, isolamento entre duas empresas, produto, pedido, baixa de estoque, financeiro, cancelamento, estorno e auditoria.

O Security Advisor do Supabase foi executado após as migrações sem alertas de segurança. Índices de apoio para foreign keys também foram adicionados.

## Deploy

A Vercel pode importar diretamente este repositório; vercel.json adiciona headers de segurança. O workflow em .github/workflows/pages.yml também prepara deploy via GitHub Pages.

Antes de liberar clientes externos, configure domínio HTTPS oficial, Site URL e Redirect URLs do Supabase Auth, SMTP confiável para confirmação/recuperação de conta e uma política de backup adequada ao negócio.

## Marketplaces

Shopee e Mercado Livre permanecem com integração não conectada até que OAuth e credenciais oficiais sejam configurados. Nenhum pedido fictício ou sincronização simulada é usada.
