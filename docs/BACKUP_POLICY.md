# Política de backup — System Seller

O sistema possui um **backup operacional JSON** na área **Gestão > Backup**. Ele exporta os dados da empresa logada sem incluir chaves, senhas ou tokens de convite.

## Conteúdo do snapshot

- empresa;
- lojas;
- clientes;
- produtos;
- pedidos;
- itens dos pedidos;
- movimentações de estoque;
- lançamentos financeiros;
- equipe, sem expor e-mails no arquivo;
- auditoria.

## Rotina recomendada

- **Semanal:** gerar um snapshot e guardar fora do computador principal.
- **Antes de mudanças grandes:** exportar antes de importações, integrações ou alterações em massa.
- **Mensal:** abrir um snapshot e conferir se pedidos, produtos e financeiro estão presentes.

Sugestão de retenção para o backup operacional: manter as últimas 8 cópias semanais e 12 cópias mensais, ajustando conforme o volume e as obrigações do negócio.

## Backup gerenciado do banco

O JSON é complementar. Recuperação completa do banco, retenção automática e Point-in-Time Recovery dependem dos recursos habilitados no plano/projeto do Supabase e devem ser configurados separadamente na plataforma.

## Proteção

Os arquivos podem conter dados comerciais e pessoais de clientes. Guarde-os em local privado, com acesso restrito e, quando possível, criptografado.
