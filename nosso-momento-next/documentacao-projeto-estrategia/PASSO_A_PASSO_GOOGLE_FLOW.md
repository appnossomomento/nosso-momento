# Passo a passo — Google Flow (rostos de Ana e Pedro)

Use este guia **antes** de gerar os comerciais do [BRIEFING_CRIATIVOS_CAMPANHA.md](BRIEFING_CRIATIVOS_CAMPANHA.md). O vídeo só entra depois que os dois personagens estiverem salvos no mesmo projeto.

Fonte da interface: ajuda oficial do Google Flow (Characters, Ingredients, Veo 3.1).

---

## 1. Entrar e criar o projeto

1. Acesse [Google Flow](https://flow.google.com) no computador, com a conta Google do Nosso Momento.
2. Clique em **New project**.
3. Nomeie o projeto como `Nosso Momento comerciais`.

Tudo que você gerar fica neste projeto. Ana e Pedro só existem aqui. Outro projeto não herda os personagens.

---

## 2. Gerar o rosto da Ana

1. No menu da esquerda, clique em **Characters**.
2. Clique em **New character**.
3. No campo de descrição, cole:

```
Photorealistic portrait of a Brazilian woman, 29 years old, warm olive skin, long dark wavy hair over one shoulder, small gold hoop earrings, natural makeup, realistic pores, looking at the camera with a calm tired expression, plain dark charcoal background, soft window light, head and shoulders only, no text, no logos
```

4. Não envie foto. Deixe o Flow gerar a imagem.
5. Clique em **Generate**.
6. Gere de novo até aparecer um rosto que você queira ver em todos os comerciais. Descarte o que parecer modelo de catálogo, pele de plástico ou sorriso de propaganda.
7. Quando gostar de uma, gere uma segunda imagem, de três quartos:

```
Same woman, three-quarter view looking slightly left, same long dark wavy hair, same gold hoop earrings, same olive skin, same plain dark background, photorealistic, head and shoulders, no text
```

8. Selecione as duas melhores (frente e três quartos). O personagem precisa de pelo menos uma imagem.
9. Nome: `Ana`.
10. Voz: pode pular. O áudio desses comerciais entra no CapCut. Se o Flow exigir voz, escolha uma feminina baixa e calma.
11. No campo de info, cole:

```
29, Brazilian, camel knit sweater in the living-room scenes. Same face in every shot.
```

12. Clique em **Done**, no canto superior direito.

---

## 3. Gerar o rosto do Pedro

Repita: **Characters** → **New character**.

Frente:

```
Photorealistic portrait of a Brazilian man, 31 years old, light brown skin, short dark curly hair, thin faded beard, heather grey t-shirt, realistic pores, looking at the camera, quiet expression, plain dark charcoal background, soft window light, head and shoulders only, no text, no logos
```

Três quartos:

```
Same man, three-quarter view looking slightly right, same short dark curly hair, same thin faded beard, same grey t-shirt, same plain dark background, photorealistic, head and shoulders, no text
```

- Nome: `Pedro`.
- Voz: pule, ou uma masculina baixa se for obrigatório.
- Info:

```
31, Brazilian, grey t-shirt at home. Same face in every shot.
```

Clique em **Done**.

---

## 4. Testar se o rosto trava

Ainda no mesmo projeto, no prompt de vídeo:

1. Clique no nome do modelo.
2. Escolha **Video** e depois **Video Ingredients** (ou só escreva `@Ana`).
3. Modelo: **Veo 3.1 Lite** ou **Fast**. **Quality não aceita personagem.**
4. Duração: **8 segundos**. Ingredients só funciona em 8 s nesses modelos.
5. Proporção: **9:16**.
6. Cole este teste:

```
@Ana and @Pedro sit side by side on a dark sofa at night, each looking at their own phone, São Paulo apartment, cold TV light, photorealistic, no on-screen text, no logos
```

7. Clique em **Generate**.

Se os dois rostos baterem com os retratos, está travado. Se um rosto mudar, não siga para o comercial: volte em **Characters**, abra o personagem e troque a imagem de referência pela que ficou mais fiel.

---

## 5. Regras que evitam retrabalho

- Fundo liso nos retratos. Cena, sofá e luz só entram no vídeo.
- No mesmo take, no máximo um retrato de cada. Veo 3.1 Lite/Fast aceita cerca de 3 imagens de referência no total. Duas fotos da Ana e duas do Pedro no mesmo vídeo estouram o limite.
- O texto do vídeo não pode contradizer a foto. Se a Ana foi salva de suéter camel, o prompt do sofá também pede suéter camel.
- Não peça logo, texto na tela nem a interface do app. Isso entra no CapCut.
- Os prompts dos comerciais (V1 a V6) estão na seção 8 do briefing. Comece pelo **V1-A** só depois que o teste do sofá sair com as duas caras certas.

---

## 6. Próximo passo

No mesmo projeto, cole o prompt **V1-A** da seção 8 do briefing. Se o rosto falhar nesse take, regenere com `@Ana` e `@Pedro` sem mudar a descrição dos personagens.
