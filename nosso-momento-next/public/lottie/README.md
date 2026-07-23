README — Mascote Lottie do streak

Arquivo principal:
- `streak-mascote.json` — mascote-chama (olhos + fogo)

O app usa **1 JSON** e recolore o fogo por código em `lib/clima/streakAssets.ts`:
- cold → cinza
- ember → brasa
- alive / tiers → laranja → vermelho → rosa (quanto maior a streak)
- at_risk → mesma paleta, um pouco mais apagada + flicker CSS

Olhos marrons do JSON não são alterados.
