# Guia de Publicação no Cloudflare com Sincronização via GitHub

Este projeto já está **100% preparado e otimizado** para publicação no **Cloudflare Pages** com sincronização contínua a partir do **GitHub**.

---

## 🏆 Por que o Cloudflare Pages é a melhor opção para este app?

Para esta aplicação (React 19 + Vite 6 + Tailwind CSS + PWA + Player CAST MidiaCall), o **Cloudflare Pages** é a solução ideal porque:

1. **Sincronização Nativa com GitHub**: Cada `git push` na sua branch `main` gera automaticamente uma nova compilação e deploy em menos de 1 minuto na rede mundial da Cloudflare.
2. **Alta Performance & Edge CDN**: O carregamento nas Smart TVs, TV Boxes, tablets e computadores é instantâneo via CDN global da Cloudflare.
3. **Suporte Completo a PWA & Cache Offline**: Os Service Workers (`sw.js`) e manifests já contam com headers corretos de cache (`_headers`).
4. **Roteamento SPA sem erros 404**: O arquivo `public/_redirects` já garante que links diretos como `/?token=...` ou sub-rotas sejam carregados pelo `index.html`.
5. **Cloudflare Pages Functions**: O arquivo `functions/api/[[path]].ts` funciona como um proxy de borda (Edge Reverse Proxy), permitindo encaminhar chamadas `/api/*` e eventos SSE para o servidor de dados se você hospedar o backend separadamente.

---

## 🚀 Passo a Passo para Publicar

### 1. Enviar o Código para o seu Repositório no GitHub

Se você estiver utilizando o Google AI Studio:
1. Abra o menu de configurações (ou ícone de exportação no canto superior/lateral).
2. Clique em **Export to GitHub** (ou baixe o arquivo ZIP e faça upload no seu repositório GitHub).
3. Certifique-se de que o repositório contenha todos os arquivos do projeto (incluindo `package.json`, `vite.config.ts`, `public/`, etc.).

---

### 2. Conectar o Repositório no Cloudflare Pages

1. Acesse o painel da Cloudflare: **[dash.cloudflare.com](https://dash.cloudflare.com)**.
2. No menu lateral esquerdo, clique em **Workers & Pages** (ou **Compute > Pages**).
3. Clique no botão azul **Create application** (Criar aplicativo).
4. Selecione a aba **Pages** e clique em **Connect to Git** (Conectar ao Git).
5. Autorize o acesso à sua conta do GitHub e selecione o repositório do projeto.
6. Clique em **Begin setup** (Iniciar configuração).

---

### 3. Definir as Configurações de Compilação (Build Settings)

Na tela de configuração do projeto no Cloudflare Pages, preencha:

| Campo | Valor Recomendado |
| :--- | :--- |
| **Project name** | `cast-midiacall` (ou o nome que preferir) |
| **Production branch** | `main` (ou `master`) |
| **Framework preset** | `Vite` |
| **Build command** | `npm run build` *(ou `npm run build:pages`)* |
| **Build output directory** | `dist` |
| **Root directory** | `/` *(deixar vazio ou `/`)* |

#### Variáveis de Ambiente (Environment variables):
Se o seu backend com banco de dados e socket em tempo real estiver hospedado (por exemplo no Cloud Run, Railway, Render, VPS ou servidor Node.js):
- **Nome da variável**: `BACKEND_URL`
- **Valor**: `https://seu-backend.com` *(sem barra no final)*

> **Nota**: Se você também quiser compilar o frontend já sabendo a URL pública da API, pode adicionar opcionalmente a variável `VITE_API_URL = https://seu-backend.com`. O arquivo de Edge Proxy `functions/api/[[path]].ts` já faz esse roteamento de forma transparente e livre de erros de CORS!

7. Clique em **Save and Deploy** (Salvar e implantar).

---

### 4. Pronto! O app está no ar!

- A Cloudflare iniciará o build automaticamente e fornecerá um domínio gratuito do tipo:
  `https://cast-midiacall.pages.dev`
- Todas as vezes que você alterar o código no GitHub e fizer `git push`, a Cloudflare atualizará a aplicação automaticamente em produção.

---

## 🌐 Configurando seu Domínio Próprio (Opcional)

No Cloudflare Pages você pode colocar um domínio próprio (ex: `painel.suaempresa.com.br` ou `tv.minhaclinica.com`):
1. No painel do seu projeto no Cloudflare Pages, vá na aba **Custom domains** (Domínios personalizados).
2. Clique em **Set up a custom domain**.
3. Digite o seu domínio ou subdomínio.
4. O Cloudflare gera o certificado SSL/TLS gratuito e cuida de toda a segurança automaticamente.

---

## 📁 Arquivos de Configuração Criados no Projeto

- `public/_redirects`: Regra SPA `/* /index.html 200` para que links diretos de players (`/?token=...`) nunca retornem erro 404.
- `public/_headers`: Políticas de segurança, headers para manifest PWA e controle de expiração dos Service Workers.
- `functions/api/[[path]].ts`: Edge Function do Cloudflare Pages que faz proxy inteligente de `/api/*` para o seu backend.
- `wrangler.toml`: Arquivo de compatibilidade com a CLI Wrangler do Cloudflare.
- `.github/workflows/cloudflare-pages.yml`: Workflow do GitHub Actions pronto para uso caso prefira CI/CD via API token.
