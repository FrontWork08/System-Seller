# System Seller

Sistema web multiempresa para gestão de pedidos, orçamentos, produção, estoque, clientes, prazos e financeiro.

- Aplicação: https://system-seller.vercel.app
- Página pública: https://system-seller.vercel.app/divulgar

## O que funciona

- autenticação por e-mail e senha, confirmação de cadastro e recuperação de acesso;
- isolamento entre empresas com Row Level Security;
- empresas, lojas/canais, clientes, produtos e equipe com `owner`, `admin`, `operator` e `viewer`;
- pedidos com vários itens, preço personalizado, frete, desconto, prazo, rastreio e pagamento parcial;
- saldo em aberto, vencimento de cobrança, histórico de pagamentos e comprovantes privados;
- preços especiais salvos por cliente/produto sem reescrever o histórico de vendas;
- orçamentos com validade opcional, aprovação, histórico de status e conversão idempotente para pedido;
- fluxo de produção com etapas configuráveis, responsável, planejamento, duração, notas e histórico;
- calendário semanal com inícios, finais planejados e prazos de entrega;
- custos por pedido/item e cálculo de lucro bruto sem alterar automaticamente preços já registrados;
- dashboard e relatórios com receita, recebíveis, custos, lucro, ticket médio, atrasos, estoque e produção;
- exportação CSV protegida contra células executáveis no fluxo existente;
- módulo opcional de impressão 3D por empresa;
- estoque 3D com rolos, material, cor, peso, custo, consumo transacional e alerta de material baixo;
- precificação automática de trabalhos 3D com custo de material, energia, máquina e mão de obra/acabamento;
- margem 3D configurável por empresa, preço sugerido por margem real e preço final sempre editável;
- aplicação do preço calculado diretamente em novos itens de pedido e orçamento, sem reescrever histórico antigo;
- snapshot da composição do preço 3D salvo no trabalho para auditoria e restauração de backup;
- anexos privados em pedidos, orçamentos e pagamentos usando Supabase Storage com URLs assinadas;
- central de notificações para atrasos, pagamentos pendentes, estoque baixo, material 3D e produção parada;
- fila de e-mail comercial processada por Supabase Edge Function; credenciais do provedor ficam fora do navegador;
- mensagens de cobrança copiáveis, preparadas para futura integração de canais sem integrar WhatsApp nesta versão;
- documentos de orçamento, recibo/extrato e ordem de produção com snapshot imutável e impressão/salvamento em PDF;
- PWA instalável com Service Worker;
- cache operacional offline para pedidos, orçamentos, produção e prazos;
- criação offline controlada de pedidos/orçamentos, notas e mudanças de etapa, com idempotência e resolução explícita de conflitos;
- backup JSON v2 e backup portátil ZIP com anexos privados, mantendo compatibilidade com JSON v1;
- estoque mínimo e ajustes com livro de movimentações;
- baixa de estoque transacional na criação do pedido e estorno no cancelamento;
- pagamento e reembolso vinculados ao financeiro;
- receitas e despesas manuais;
- auditoria de alterações críticas;
- foto de perfil em bucket privado com URL assinada;
- exclusão segura de produtos sem apagar o histórico;
- interface responsiva com quatro temas de aparência;
- página pública com SEO, sitemap, robots, Política de Privacidade, Termos de Uso e suporte;
- canal público de contato e solicitação de exclusão: frontwork08@gmail.com;
- Shopee e Mercado Livre disponíveis apenas como canais cadastráveis, sem simular integração automática.

## Arquitetura modular

O núcleo existente continua responsável por autenticação, organizações, clientes/produtos, pedidos, estoque, pagamentos/financeiro, equipe, auditoria e restauração do formato antigo. A expansão adiciona módulos JavaScript independentes e tabelas/RPCs separados para orçamentos, produção, calendário, custos, anexos, 3D, notificações, documentos e sincronização offline.

Operações críticas de múltiplos registros permanecem no banco por RPC transacional. Todos os dados duráveis pertencentes a uma empresa carregam `organization_id` e são protegidos por RLS.

## Segurança e integridade

O frontend usa apenas credencial pública apropriada para aplicações web. Chaves privilegiadas e credenciais de e-mail ficam fora do navegador.

Arquivos comerciais são armazenados em bucket privado `business-files`, com caminho iniciado pelo ID da organização, políticas de Storage e acesso autenticado/assinado. O limite atual por arquivo é 15 MB.

O modo offline não executa pagamentos, reembolsos, alterações de equipe, exclusões, consumo autoritativo de estoque ou restauração de backup. Essas operações exigem conexão.

## Validação

O GitHub Actions executa testes unitários da precificação 3D, valida sintaxe de todos os JavaScript, referências dos módulos no HTML/PWA, presença dos fluxos críticos e ausência de marcadores de credenciais privilegiadas no frontend.

O Supabase Security Advisor é executado após mudanças de schema/RLS. O aviso conhecido e independente desta expansão é a opção de proteção contra senhas vazadas do Auth.

## Backup

A área **Gestão > Backup** oferece:

- **JSON rápido v2**, com dados do núcleo e módulos;
- **ZIP portátil**, contendo `backup.json` e os anexos privados disponíveis;
- restauração compatível com JSON v1 e v2;
- preservação dos parâmetros e snapshots de precificação 3D na restauração v2.

Detalhes em `docs/BACKUP_POLICY.md`.

## E-mails

E-mails de autenticação continuam usando a configuração SMTP do Supabase/Brevo. E-mails comerciais da aplicação são enfileirados no banco e enviados pela Edge Function `process-business-email`, mantendo a chave do Brevo somente no ambiente server-side.

## Deploy e SEO

A Vercel publica a aplicação diretamente deste repositório. `vercel.json` adiciona headers de segurança.

- `/` é o painel autenticado e usa `noindex,nofollow`;
- `/divulgar` é a página pública indexável;
- `/sitemap.xml` aponta para a página pública.

## Fora do escopo desta versão

- integração automática com Shopee;
- integração automática com Mercado Livre;
- envio via WhatsApp;
- gravações financeiras ou de estoque crítico offline.

## Checklist de liberação

Consulte `docs/RELEASE_CHECKLIST.md`.
