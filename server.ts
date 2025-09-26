import { serve, env } from 'bun'
import { initializeWorkers } from "./src/workerPool.ts";
import { initializeCache } from "./src/playerCache.ts";
import { handleDecryptSignature } from "./src/handlers/decryptSignature.ts";
import { handleGetSts } from "./src/handlers/getSts.ts";
import { withPlayerUrlValidation } from "./src/middleware.ts";

const API_TOKEN = env.API_TOKEN || "";
async function handler(req: Request): Promise<Response> {
    const authHeader = req.headers.get("authorization");
    if (API_TOKEN && API_TOKEN !== "") {
        if (authHeader !== API_TOKEN) {
            const error = authHeader ? 'Invalid API token' : 'Missing API token';
            return new Response(JSON.stringify({ error }), { status: 401, headers: { "Content-Type": "application/json" } });
        }
    }

    const { pathname } = new URL(req.url);

    let handle: (req: Request) => Promise<Response>;

    if (pathname === '/decrypt_signature') {
        handle = handleDecryptSignature;
    } else if (pathname === '/get_sts') {
        handle = handleGetSts;
    } else {
        return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    const composedHandler = withPlayerUrlValidation(handle);

    try {
        return await composedHandler(req);
    } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return new Response(JSON.stringify({ error: 'Internal Server Error', message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
}

const port = env.PORT || 8001;
const host = env.HOST || '0.0.0.0';

await initializeCache();
initializeWorkers();

console.log(`Server listening on http://${host}:${port}`);
serve({ fetch: handler, port: Number(port), hostname: host });
