# nosso-momento
Nosso Momento é um app web para casais que permite a conexão entre parceiros através de um sistema de pareamento por número de telefone. Após o pareamento, os casais podem interagir em um ambiente seguro e compartilhado.

## Ambiente de build estático
- Instalar dependências: `npm install`
- Gerar pacote minificado: `npm run build`
- Saída fica em `dist/` com HTML minificado, `assets/tailwind.css` purgado e demais assets copiados.

## Validação rápida pós-build
- Abrir `dist/index.html` (Live Server ou `npx serve dist`) e conferir responsividade (desktop/mobile).
- Testar fluxo do formulário, toasts, carrinho e navegação inferior.
- Garantir que assets de `assets/` e `firebase-messaging-sw.js` estão presentes na saída.

## Atualização de browserslist
- Rodar `npx update-browserslist-db@latest` periodicamente para manter o target de build alinhado.
