# Revisão de segurança — grelha final de UFCD

- Persistência: reutiliza `moduleFinalGrades`; sem tabela nova.
- Compatibilidade: campos novos opcionais e não indexados.
- Migração: não necessária; versão Dexie mantém-se.
- Sincronização/backup: registos completos já são serializados pelo mecanismo existente.
- Infraestrutura: zero alterações a Worker, D1, Durable Objects, bindings, polling ou APIs.
- UI: reutiliza proteção de rascunhos por guardar e mantém a vista detalhada existente.
