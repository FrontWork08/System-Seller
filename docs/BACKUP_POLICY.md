# Política de backup — System Seller

O sistema possui um **backup operacional JSON restaurável** na área **Gestão > Backup**. Ele exporta os dados da empresa logada sem incluir chaves, senhas ou tokens de convite.

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

## Restauração

- somente o proprietário da empresa pode restaurar;
- o arquivo é validado e uma prévia é exibida antes da confirmação;
- lojas, clientes, produtos, pedidos, estoque, financeiro e equipe são substituídos pelo conteúdo do backup;
- a operação acontece em uma única transação: qualquer erro desfaz todas as alterações;
- membros da equipe só são recuperados quando suas contas ainda existem;
- o histórico de auditoria exportado permanece no arquivo para conferência, mas não é injetado na auditoria viva;
- um backup de uma empresa excluída pode ser restaurado em uma empresa nova e vazia.

## Backup gerenciado do banco

O JSON é complementar. Recuperação completa do banco, retenção automática e Point-in-Time Recovery dependem dos recursos habilitados no plano/projeto do Supabase e devem ser configurados separadamente na plataforma.

## Proteção

Os arquivos podem conter dados comerciais e pessoais de clientes. Guarde-os em local privado, com acesso restrito e, quando possível, criptografado.
