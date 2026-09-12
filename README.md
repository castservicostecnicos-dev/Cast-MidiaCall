# 📺 CAST MidiaCall - Sistema de Gerenciamento e Projeção em Telas

Sistema completo CAST MidiaCall de sinalização digital, painéis e chamada de senhas em tempo real, desenvolvido com **React 19**, **Vite**, **Tailwind CSS** e suporte a **PWA (Progressive Web App)** com cache offline para Smart TVs, TV Boxes, mini PCs e totens verticais ou horizontais.

---

## ⚡ Conectando e Publicando no Cloudflare Pages via GitHub

Este repositório já está configurado com todos os arquivos necessários para compilação e publicação automática no **Cloudflare Pages** com sincronização direta a partir do **GitHub**.

### 1. Exportar / Enviar o Código para o GitHub
1. No menu superior/lateral do Google AI Studio, clique em **Export to GitHub** (ou faça o download do ZIP e envie para o seu repositório no GitHub).
2. Certifique-se de que a branch principal seja `main` ou `master`.

---

### 2. Conectar o Repositório no Dashboard do Cloudflare Pages

1. Acesse o painel da Cloudflare: **[dash.cloudflare.com](https://dash.cloudflare.com)**.
2. No menu lateral esquerdo, navegue até **Workers & Pages** (ou **Compute > Workers & Pages**).
3. Clique no botão azul **Create application** (Criar aplicativo).
4. Selecione a aba **Pages** e clique em **Connect to Git** (Conectar ao Git).
5. Selecione a sua conta do GitHub e escolha o repositório deste projeto.
6. Clique em **Begin setup** (Iniciar configuração).

---

### 3. Configurações de Compilação (Build Settings)

Na tela de configuração do projeto, preencha os campos exatamente como abaixo:

| Campo | Valor |
| :--- | :--- |
| **Project name** | `cast-midiacall` *(ou o nome de sua preferência)* |
| **Production branch** | `main` *(ou `master`)* |
| **Framework preset** | `Vite` |
| **Build command** | `npm run build` *(ou `npm run build:pages`)* |
| **Build output directory** | `dist` |
| **Root directory** | `/` *(deixar vazio ou `/`)* |

#### Variáveis de Ambiente (Environment variables):
Ainda na mesma tela, expanda a seção **Environment variables (advanced)** e adicione:

- **`NODE_VERSION`**: `20` *(garante a versão LTS estável do Node no ambiente de compilação)*
- **`BACKEND_URL`** *(Opcional)*: `https://seu-backend.com` *(Se a API e o banco de dados estiverem rodando em outro servidor, o Edge Function `functions/api/[[path]].ts` fará o proxy reverso de `/api/*` automaticamente)*
- **`VITE_API_URL`** *(Opcional)*: `https://seu-backend.com` *(Se preferir que o frontend faça chamadas diretas via CORS)*

---

### 4. Salvar e Concluir o Deploy

1. Clique em **Save and Deploy** (Salvar e implantar).
2. O Cloudflare Pages irá baixar as dependências, compilar o frontend com Vite e gerar a distribuição global.
3. Ao finalizar, você receberá uma URL pública gratuita (ex: `https://cast-midiacall.pages.dev`).
4. **Sincronização Contínua**: Toda vez que você fizer `git push` no GitHub, o Cloudflare Pages atualizará a aplicação automaticamente em produção!

---

## 🌐 Adicionando Domínio Personalizado (Opcional)

1. No painel do seu projeto no Cloudflare Pages, vá na aba **Custom domains**.
2. Clique em **Set up a custom domain**.
3. Digite o domínio ou subdomínio desejado (ex: `tv.suaempresa.com.br`).
4. A Cloudflare configurará as entradas de DNS e gerará o certificado SSL/TLS gratuito automaticamente.

---

## 🛠️ Deploy Manual via Wrangler CLI (Alternativa sem Git)

Caso queira fazer o deploy diretamente do seu terminal usando o Wrangler:

```bash
# 1. Instalar dependências
npm install

# 2. Compilar o projeto
npm run build:pages

# 3. Publicar no Cloudflare Pages
npx wrangler pages deploy dist --project-name=cast-midiacall
```

---

## 📁 Arquivos de Suporte ao Cloudflare no Repositório

- **`wrangler.toml`**: Configuração central do Cloudflare Pages e Workers.
- **`public/_redirects`**: Regra de SPA (`/* /index.html 200`) que garante que links diretos com parâmetros (ex: `/?token=...`) funcionem sem erro 404.
- **`public/_headers`**: Cabeçalhos de segurança e políticas de cache para o Service Worker (`sw.js`) e manifesto do PWA.
- **`functions/api/[[path]].ts`**: Edge Function (proxy reverso) que redireciona chamadas da API `/api/*` para o servidor backend.
- **`.github/workflows/cloudflare-pages.yml`**: Workflow opcional para deploy automatizado via GitHub Actions.

---

## 💻 Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Iniciar servidor local de desenvolvimento (Frontend + Backend)
npm run dev

# Compilar para produção
npm run build
```
