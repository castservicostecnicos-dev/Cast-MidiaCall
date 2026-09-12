/**
 * Cloudflare Pages Function: API Edge Reverse Proxy
 * 
 * Automatically routes all `/api/*` requests to your backend server (if BACKEND_URL is set in Cloudflare Pages).
 * Supports full HTTP methods (GET, POST, PUT, DELETE), JSON payloads, authorization headers, and SSE streaming.
 */

interface Env {
  BACKEND_URL?: string;
}

export const onRequest = async (context: {
  request: Request;
  env: Env;
  params: { path?: string[] };
}): Promise<Response> => {
  const { request, env } = context;
  const backendUrl = (env.BACKEND_URL || '').trim();

  // If BACKEND_URL is configured in Cloudflare Pages Settings -> Environment Variables
  if (backendUrl) {
    const url = new URL(request.url);
    const targetUrl = new URL(`${backendUrl.replace(/\/$/, '')}${url.pathname}${url.search}`);

    const forwardHeaders = new Headers(request.headers);
    // Ensure Host header matches destination
    forwardHeaders.set('Host', targetUrl.host);

    const isBodyAllowed = request.method !== 'GET' && request.method !== 'HEAD';

    try {
      const response = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: forwardHeaders,
        body: isBodyAllowed ? request.body : undefined,
        redirect: 'manual',
      });

      // Clone response and preserve SSE / streaming headers if applicable
      const resHeaders = new Headers(response.headers);
      resHeaders.set('Access-Control-Allow-Origin', '*');
      resHeaders.set('Access-Control-Allow-Headers', '*');
      resHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: resHeaders,
      });
    } catch (err: any) {
      return new Response(
        JSON.stringify({
          error: 'Falha na conexão com o servidor backend.',
          details: err?.message || String(err),
          target: targetUrl.toString(),
        }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  }

  // Fallback response if BACKEND_URL is not yet defined
  const url = new URL(request.url);

  if (url.pathname === '/api/health') {
    return new Response(
      JSON.stringify({
        status: 'ok',
        edge: 'Cloudflare Pages Edge',
        timestamp: Date.now(),
        backend_configured: false,
        message:
          'Frontend ativo no Cloudflare Pages! Para conectar com o banco de dados e APIs em tempo real, defina a variável de ambiente BACKEND_URL no painel do Cloudflare Pages (Configurações > Variáveis de ambiente).',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  return new Response(
    JSON.stringify({
      error: 'Backend não configurado',
      message:
        'O aplicativo está rodando no Cloudflare Pages. Para que o login, mídias e chamadas funcionem com o servidor, configure a variável de ambiente BACKEND_URL no painel do Cloudflare Pages (ex: https://meu-backend.com) ou informe VITE_API_URL no momento da compilação.',
      path: url.pathname,
    }),
    {
      status: 503,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
};
