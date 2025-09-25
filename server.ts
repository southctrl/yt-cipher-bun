import { serve } from "https://deno.land/std@0.140.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.140.0/crypto/mod.ts";
import { ensureDir } from "https://deno.land/std@0.140.0/fs/ensure_dir.ts";
import { join } from "https://deno.land/std@0.140.0/path/mod.ts";
import type { Input as MainInput, Output as MainOutput } from "./ejs/src/main.ts";

const API_BEARER_TOKEN = Deno.env.get("API_BEARER_TOKEN");

if (!API_BEARER_TOKEN) {
    console.error("FATAL: API_BEARER_TOKEN environment variable not set.");
    Deno.exit(1);
}

const CACHE_DIR = join(Deno.cwd(), 'player_cache');
const CONCURRENCY = parseInt(Deno.env.get("MAX_THREADS") || "", 10) || navigator.hardwareConcurrency || 1;

// This is a heavy CPU task, mostly from the AST done in ejs
// Create a popl of worker threads to assign tasks to
interface WorkerWithStatus extends Worker {
    isIdle?: boolean;
}
const workers: WorkerWithStatus[] = [];
const taskQueue: {
    data: MainInput;
    resolve: (output: MainOutput) => void;
    reject: (error: any) => void;
}[] = [];

function dispatch() {
    const idleWorker = workers.find(w => w.isIdle);
    if (!idleWorker || taskQueue.length === 0) {
        return;
    }

    const task = taskQueue.shift()!;
    idleWorker.isIdle = false;

    const messageHandler = (e: MessageEvent) => {
        idleWorker.removeEventListener("message", messageHandler);
        idleWorker.isIdle = true;

        const { type, data } = e.data;
        if (type === 'success') {
            task.resolve(data);
        } else {
            const err = new Error(data.message);
            err.stack = data.stack;
            task.reject(err);
        }
        dispatch(); // keep checking
    };

    idleWorker.addEventListener("message", messageHandler);
    idleWorker.postMessage(task.data);
}

function execInPool(data: MainInput): Promise<MainOutput> {
    return new Promise((resolve, reject) => {
        taskQueue.push({ data, resolve, reject });
        dispatch();
    });
}

for (let i = 0; i < CONCURRENCY; i++) {
    const worker: WorkerWithStatus = new Worker(new URL("./worker.ts", import.meta.url).href, { type: "module" });
    worker.isIdle = true;
    workers.push(worker);
}

interface SignatureRequest {
    encrypted_signature: string;
    n_param: string;
    player_url: string;
    video_id: string;
}

interface SignatureResponse {
    decrypted_signature: string;
    decrypted_n_sig: string;
}

async function getPlayerFilePath(playerUrl: string): Promise<string> {
    // This hash of the player script url will mean that diff region scripts are treated as unequals, even for the same version #
    // I dont think I have ever seen 2 scripts of the same version differ between regions but if they ever do this will catch it
    // As far as player script access, I haven't ever heard about YT ratelimiting those either so ehh
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(playerUrl));
    const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    const filePath = join(CACHE_DIR, `${hash}.js`);

    try {
        await Deno.stat(filePath);
        return filePath;
    } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
            console.log(`Cache miss for player: ${playerUrl}. Fetching...`);
            const response = await fetch(playerUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch player from ${playerUrl}: ${response.statusText}`);
            }
            const playerContent = await response.text();
            await Deno.writeTextFile(filePath, playerContent);
            console.log(`Saved player to cache: ${filePath}`);
            return filePath;
        }
        throw error;
    }
}

async function handler(req: Request): Promise<Response> {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Invalid or missing bearer token' }), { status: 403, headers: { "Content-Type": "application/json" } });
    }
    const token = authHeader.substring('Bearer '.length);
    if (token !== API_BEARER_TOKEN) {
        return new Response(JSON.stringify({ error: 'Invalid or missing bearer token' }), { status: 403, headers: { "Content-Type": "application/json" } });
    }

    if (req.method !== 'POST' || new URL(req.url).pathname !== '/decrypt_signature') {
        return new Response(null, { status: 404 });
    }

    try {
        const { encrypted_signature, n_param, player_url }: SignatureRequest = await req.json();
        const playerFilePath = await getPlayerFilePath(player_url);
        const player = await Deno.readTextFile(playerFilePath);

        const mainInput: MainInput = {
            type: "player",
            player,
            output_preprocessed: false,
            requests: [
                { type: "sig", challenges: encrypted_signature ? [encrypted_signature] : [] },
                { type: "nsig", challenges: n_param ? [n_param] : [] },
            ],
        };

        const output = await execInPool(mainInput);

        if (output.type === 'error') {
            throw new Error(output.error);
        }

        let decrypted_signature = '';
        let decrypted_n_sig = '';

        for (const r of output.responses) {
            if (r.type === 'result') {
                if (encrypted_signature && encrypted_signature in r.data) {
                    decrypted_signature = r.data[encrypted_signature];
                }
                if (n_param && n_param in r.data) {
                    decrypted_n_sig = r.data[n_param];
                }
            }
        }

        const response: SignatureResponse = {
            decrypted_signature,
            decrypted_n_sig,
        };

        return new Response(JSON.stringify(response), { status: 200, headers: { "Content-Type": "application/json" } });

    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: 'Internal Server Error', message: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
}

const port = Deno.env.get("PORT") || 8001;
const host = Deno.env.get("HOST") || '0.0.0.0';

await ensureDir(CACHE_DIR);
console.log(`Player cache directory ensured at: ${CACHE_DIR}`);

console.log(`Server listening on http://${host}:${port} with ${CONCURRENCY} workers`);
await serve(handler, { port: Number(port), hostname: host });