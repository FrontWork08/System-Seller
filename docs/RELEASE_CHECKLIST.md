# Checklist de liberação — System Seller

## Fluxo de conta

- [x] cadastro por e-mail e senha;
- [x] confirmação de e-mail volta para o domínio oficial;
- [x] SMTP próprio via Brevo;
- [x] recuperação de senha no frontend;
- [x] correção da corrida de criação de perfil;
- [ ] personalizar os modelos de e-mail no painel do Supabase;
- [ ] ativar proteção contra senhas vazadas no Auth.

## Operação

- [x] pedidos transacionais;
- [x] estoque e estorno;
- [x] clientes;
- [x] financeiro;
- [x] lojas/canais;
- [x] auditoria;
- [x] perfil e foto privada;
- [x] equipe com convites e permissões;
- [x] paginação e busca de pedidos no servidor;
- [x] backup operacional JSON.

## Publicação

- [x] deploy Vercel com headers de segurança;
- [x] página pública de divulgação em /divulgar;
- [x] painel principal marcado como noindex;
- [x] sitemap e robots para a página pública;
- [x] Política de Privacidade e Termos de Uso publicados;
- [x] canal de suporte, segurança e solicitação de exclusão de conta;
- [x] contato público: frontwork08@gmail.com;
- [ ] enviar sitemap/URL ao Google Search Console quando desejar indexação mais rápida.

## Marketplaces

- [x] arquitetura e canais Shopee/Mercado Livre sem simulação de integração;
- [ ] registrar aplicativos nas plataformas oficiais;
- [ ] configurar OAuth e segredos somente no backend;
- [ ] importar/sincronizar pedidos após homologação das APIs.
