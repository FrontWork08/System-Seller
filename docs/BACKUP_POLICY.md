# Política de backup — System Seller

O System Seller oferece dois formatos de backup na área **Gestão > Backup**. Ambos são restritos ao proprietário da empresa e nunca incluem senhas, chaves privadas ou tokens de autenticação.

## 1. Backup rápido JSON

O JSON é indicado para cópias frequentes e restauração dos registros do sistema. A versão atual do formato é **schema_version 2** e continua aceitando backups antigos **schema_version 1**.

O snapshot v2 inclui:

- empresa e configurações da organização;
- lojas/canais, clientes e produtos;
- pedidos, itens, pagamentos e movimentações de estoque;
- orçamentos e itens de orçamento;
- preços especiais por cliente/produto;
- etapas, estado atual e histórico de produção;
- custos operacionais;
- metadados de anexos privados;
- notificações e fila de e-mails;
- módulo 3D, rolos e movimentos de material;
- snapshots imutáveis de documentos gerados;
- mutações offline e conflitos de sincronização;
- equipe e auditoria do núcleo existente.

O JSON contém um manifesto dos arquivos privados, mas não duplica os bytes dos anexos.

## 2. Backup portátil ZIP

O botão **Baixar backup completo ZIP** cria um arquivo contendo:

- `backup.json` com o snapshot v2;
- os arquivos privados disponíveis do bucket `business-files`, preservando seus caminhos por organização/registro;
- manifesto indicando quais arquivos foram incluídos e quais não puderam ser obtidos.

Durante a restauração de um ZIP, o banco é restaurado primeiro e os arquivos incluídos são reenviados ao Storage privado. Arquivos ausentes ou com falha são informados ao usuário em vez de serem ignorados silenciosamente.

## Rotina recomendada

- **Semanal:** gerar um JSON rápido e guardar fora do computador principal.
- **Antes de mudanças grandes:** gerar também um ZIP portátil.
- **Mensal:** conferir um backup e verificar pedidos, produtos, financeiro, orçamentos e anexos.
- Sugestão de retenção: 8 cópias semanais e 12 mensais, ajustando conforme o volume e as obrigações do negócio.

## Restauração

- somente o proprietário da empresa pode restaurar;
- o arquivo é validado e uma prévia é exibida antes da confirmação;
- a restauração v2 preserva vínculos entre orçamento/pedido, produção, preços especiais, custos, 3D, anexos e documentos;
- a parte de banco é executada de forma transacional pelo Supabase;
- membros da equipe só são recuperados quando suas contas ainda existem;
- arquivos do ZIP são restaurados após a transação do banco e falhas individuais são reportadas;
- backups v1 continuam suportados pelo fluxo de compatibilidade existente.

## Backup gerenciado do banco

Os arquivos exportados pelo aplicativo são complementares. Retenção automática, recuperação completa do projeto e Point-in-Time Recovery dependem dos recursos habilitados no projeto Supabase e devem ser configurados separadamente na plataforma.

## Proteção

Os backups podem conter dados comerciais, dados pessoais de clientes e arquivos enviados para pedidos. Guarde-os em local privado, com acesso restrito e, quando possível, criptografado.
