# Checklist de QA rápido

1. **Layout geral**
   - Abrir `dist/index.html` e validar hero, cards e seções em desktop (≥1280px) e mobile (≤414px).
   - Confirmar que o gradiente do hero e os botões exibem hover/focus corretos.

2. **Formulários**
   - Enviar e-mail válido e conferir mensagem de sucesso.
   - Simular campo em branco para validar feedback de erro e foco automático.

3. **Interações**
   - Disparar toasts e checar animações de entrada/saída.
   - Navegar pela barra inferior e confirmar estados ativos/badges.

4. **Assets**
   - Verificar se imagens e ícones em `assets/` carregam normalmente.
   - Confirmar presença de `firebase-messaging-sw.js` na raiz de `dist/`.

5. **Build**
   - Rodar `npm run build` e garantir ausência de erros.
   - Executar `npx update-browserslist-db@latest` quando surgir aviso nas builds.
