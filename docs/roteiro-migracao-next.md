# Roteiro de Migracao para Next.js (sem trocar DNS)

Data base: 2026-05-27

## Objetivo
Publicar a versao Next no mesmo dominio/projeto de deploy, mantendo a versao estatica atual empacotada em backup para rollback rapido.

## Fase 1 - Backup (concluida)
Pasta criada:
- nosso-momento-backup/producao-estatica-2026-05-27

Conteudo salvo:
- index.html
- assets/
- styles/
- scripts/
- tailwind.config.js
- manifest.json
- sw.js
- firebase.json
- vercel.json
- package.json
- README.md
- qa-checklist.md
- dist/

## Fase 2 - Freeze no Git
1. Revisar status atual:
   - git status --short
2. Criar commit de snapshot (sem limpar alteracoes):
   - git add nosso-momento-backup docs/roteiro-migracao-next.md
   - git commit -m "chore: backup da producao estatica antes da migracao para next"
3. Criar tag de referencia:
   - git tag prod-static-2026-05-27

## Fase 3 - Publicar Next sem mover pastas (recomendado)
Opcao A (Vercel):
1. Manter o repositorio como esta.
2. No projeto atual da Vercel, configurar Root Directory = nosso-momento-next
3. Build command: npm run build
4. Output: .next (padrao Next)
5. Deploy.

Opcao B (mover Next para raiz):
1. Ja com backup pronto, mover conteudo de nosso-momento-next para raiz.
2. Ajustar firebase.json/vercel.json para Next (hoje estao para app estatico).
3. Deploy no mesmo projeto de dominio.

## Fase 4 - Hardening curto (gate de Go/No-Go)
Executar com 2 usuarios reais:
- login
- troca de conexao ativa
- desafios (pergunta, escolha, roleta)
- extrato
- foguinhos por parceiro no header

Critico:
- monitorar logs da processInput durante os testes
- zerar erros criticos recorrentes

## Fase 5 - Rollback
Se houver incidente:
1. Reaplicar configuracao anterior de build estatico
2. Deploy do snapshot estatico
3. Validar rota principal e login

## Observacoes
- Nao apagar a pasta nosso-momento-next antes do Go-live estabilizar.
- Nao remover arquivos estaticos da raiz antes do smoke completo em producao.
