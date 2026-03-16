# Campo Iluminado ✿

Esse é um jogo **dedicado à minha melhor amiga**. Que está comigo nos momentos bons e nos ruins. Te amo, minha mana!

---

## Sobre o jogo

**Campo Iluminado** é um jogo 2D de plataforma em que a personagem Alessandra percorre um cenário noturno cheio de flores dama-da-noite. O objetivo é **coletar todas as flores** para iluminar o campo de novo.

Pelo caminho há **memórias**, **mensagens** e **itens de música** que fazem a personagem dançar. A trilha principal é “Twenty One Pilots - Oldies Station (8-bit)”; nos cristais de música tocam outras faixas.

**Controles:** setas ou **A/D** para mover, **W** ou **Espaço** para pular, **E** para interagir com itens.

---

## Como rodar o projeto

### 1. Instalar dependências

Na pasta do projeto, use **npm** ou **pnpm**:

```bash
npm install
```

ou

```bash
pnpm install
```

### 2. Rodar em modo desenvolvimento

```bash
npm run dev
```

ou

```bash
pnpm dev
```

O jogo abre no browser (geralmente em `http://localhost:5173`).

### 3. Build para produção (opcional)

```bash
npm run build
```

Os ficheiros gerados ficam na pasta `dist/`.

---

## Deploy na Vercel

1. **Cria uma conta** em [vercel.com](https://vercel.com) (podes usar GitHub/GitLab/Bitbucket).

2. **Coloca o projeto no Git** (se ainda não estiver):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/TEU-USUARIO/TEU-REPO.git
   git push -u origin main
   ```

3. **Importa na Vercel:**
   - Em [vercel.com/new](https://vercel.com/new), clica em **Import Project**.
   - Escolhe o repositório do GitHub/GitLab/Bitbucket.
   - A Vercel detecta Vite automaticamente. O ficheiro `vercel.json` já define:
     - **Build Command:** `npm run build`
     - **Output Directory:** `dist`
     - **Rewrites:** todas as rotas vão para `index.html` (SPA).
   - Clica em **Deploy**.

4. **Pronto.** O jogo fica online com um URL tipo `teu-projeto.vercel.app`. Cada push na branch principal pode gerar um novo deploy automático.

Se usares **pnpm**, na Vercel vai a *Settings → General* e define **Install Command** como `pnpm install`.

---

Feito com React, TypeScript, Vite e muito carinho.
