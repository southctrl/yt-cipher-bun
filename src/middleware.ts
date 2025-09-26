import { validateAndNormalizePlayerUrl } from "./utils.ts";

type Next = (req: Request) => Promise<Response>;

export function withPlayerUrlValidation(handler: Next): Next {
    return async (req: Request) => {
        // Only need this check on POST requests
        if (req.method !== 'POST') {
            return await handler(req);
        }

        const originalReq = req.clone();
        try {
            const body = await req.json();
            if (!body.player_url) {
                return new Response(JSON.stringify({ error: "player_url is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
            }

            const normalizedUrl = validateAndNormalizePlayerUrl(body.player_url);
            
            // Reconstruct the request with the normalized URL
            const newBody = { ...body, player_url: normalizedUrl };
            const newReq = new Request(req.url, {
                method: req.method,
                headers: req.headers,
                body: JSON.stringify(newBody)
            });

            return await handler(newReq);
        } catch (error) {
            if (error instanceof SyntaxError) {
                 return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { "Content-Type": "application/json" } });
            }
            // Pass the original request if we cant get a body, the handler will error
            if (error.message.includes('could not be cloned')) {
                 return await handler(originalReq);
            }
            return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
    };
}