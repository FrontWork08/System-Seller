# System Seller

Sistema web multiempresa para gestão de pedidos, estoque, clientes, prazos e financeiro.

- Aplicação: https://system-seller.vercel.app
- Página pública: https://system-seller.vercel.app/divulgar

## O que funciona

- autenticação por e-mail e senha, confirmação de cadastro e recuperação de acesso;
- SMTP próprio via Brevo;
- isolamento entre empresas com Row Level Security;
- empresas, lojas, clientes e produtos;
- equipe com owner, admin, operator e viewer;
- convites de equipe por link temporário, alteração de permissão e remoção;
- estoque mínimo e ajustes com livro de movimentações;
- pedidos com vários itens, frete, desconto, prazo e rastreio;
- baixa de estoque transacional na criação do pedido;
- cancelamento com estorno automático de estoque;
- pagamento e reembolso vinculados ao financeiro;
- receitas e despesas manuais;
- paginação e busca de pedidos no servidor;
- auditoria de alterações críticas;
- backup operacional JSON por empresa;
- foto de perfil em bucket privado com URL assinada;
- exclusão segura de produtos: remove do catálogo sem apagar pedidos e movimentações, com opção de restaurar;
- hard delete de empresa, cliente e loja bloqueado no navegador;
- estado de integração de marketplace não pode ser forjado pelo cliente web;
- exportação CSV protegida contra células executáveis;
- interface responsiva com quatro temas de aparência (azul, grafite, esmeralda e âmbar);
- página pública com SEO, sitemap e robots separados do painel;
- Política de Privacidade, Termos de Uso e central de suporte;
- canal público de contato e solicitação de exclusão: frontwork08@gmail.com;
- Shopee e Mercado Livre disponíveis como canais, sem simular integração antes das APIs oficiais.

## Segurança e integridade

O frontend usa apenas a credencial pública própria para aplicações web. Credenciais privilegiadas ficam fora do navegador. A autorização é aplicada no banco por RLS e por funções transacionais.

Papéis disponíveis: owner, admin, operator e viewer. Financeiro, equipe administrativa, backup e auditoria ficam restritos conforme o papel.

Ao criar um pedido, o backend valida organização e itens, bloqueia os produtos, valida saldo, grava pedido/itens, reduz estoque, registra movimentações e, quando aplicável, cria a receita. Se uma etapa falhar, a transação inteira é revertida.

Convites de equipe são criados e resgatados por funções controladas no backend. O proprietário não pode ser removido ou rebaixado, e administradores não podem gerenciar outros administradores.

## Validação realizada

O backend foi testado com transações de QA revertidas ao final, cobrindo criação de empresa, isolamento entre empresas, pedido, baixa de estoque, financeiro, cancelamento, estorno, auditoria, criação/leitura de convites de equipe e acesso do backup às tabelas protegidas.

Os arquivos JavaScript e a configuração da Vercel passam por validação de sintaxe. O Supabase Security Advisor está sem alertas de schema/RLS; permanece um aviso de configuração do Auth para habilitar proteção contra senhas vazadas.

## Backup

A área **Gestão > Backup** gera um snapshot JSON portátil da empresa. Consulte `docs/BACKUP_POLICY.md`.

Esse arquivo é complementar aos backups gerenciados do banco; retenção automática e Point-in-Time Recovery dependem da configuração/plano do provedor.

## E-mails

Os modelos em português estão documentados em `docs/EMAIL_TEMPLATES.md`. O SMTP já usa Brevo. A configuração dos modelos hospedados é aplicada no painel/Management API do Supabase Auth.

## Deploy e SEO

A Vercel publica a aplicação diretamente deste repositório. `vercel.json` adiciona headers de segurança.

- `/` é o painel autenticado e usa `noindex,nofollow`;
- `/divulgar` é a página pública indexável;
- `/sitemap.xml` aponta para a página pública.

## Marketplaces

Shopee e Mercado Livre permanecem com integração automática não conectada até que OAuth, credenciais e homologação das APIs oficiais sejam configurados. Nenhum pedido fictício ou sincronização simulada é usada.

## Checklist de liberação

Consulte `docs/RELEASE_CHECKLIST.md`.
