import express, { Request, Response, NextFunction } from 'express';
import fetch from 'node-fetch';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execFileAsync = promisify(execFile);
const app = express();
app.use(express.json());

const API_BEARER_TOKEN = process.env.API_BEARER_TOKEN;

if (!API_BEARER_TOKEN) {
    console.error("FATAL: API_BEARER_TOKEN environment variable not set.");
    process.exit(1);
}

const verifyToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(403).json({ error: 'Invalid or missing bearer token' });
    }
    const token = authHeader.substring('Bearer '.length);
    if (token !== API_BEARER_TOKEN) {
        return res.status(403).json({ error: 'Invalid or missing bearer token' });
    }
    next();
};

app.use(verifyToken);

interface SignatureRequest {
    encrypted_signature: string;
    n_param: string;
    player_url: string;
    video_id: string;
}

interface StsRequest {
    player_url: string;
    video_id: string;
}

interface SignatureResponse {
    decrypted_signature: string;
    decrypted_n_sig: string;
}

interface StsResponse {
    sts: number;
}

const CACHE_DIR = path.join(__dirname, 'player_cache');

async function getPlayerFilePath(playerUrl: string): Promise<string> {
    const hash = crypto.createHash('sha256').update(playerUrl).digest('hex');
    const filePath = path.join(CACHE_DIR, `${hash}.js`);

    try {
        await fs.access(filePath);
        return filePath;
    } catch (error) {
        console.log(`Cache miss for player: ${playerUrl}. Fetching...`);
        const response = await fetch(playerUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch player from ${playerUrl}: ${response.statusText}`);
        }
        const playerContent = await response.text();
        await fs.writeFile(filePath, playerContent);
        console.log(`Saved player to cache: ${filePath}`);
        return filePath;
    }
}

app.post('/decrypt_signature', async (req: Request<{}, {}, SignatureRequest>, res: Response) => {
    const { encrypted_signature, n_param, player_url } = req.body;

    try {
        const playerFilePath = await getPlayerFilePath(player_url);

        const args = [
            'run',
            '--allow-read',
            'ejs/run.ts',
            playerFilePath
        ];

        if (encrypted_signature) {
            args.push(`sig:${encrypted_signature}`);
        }
        if (n_param) {
            args.push(`nsig:${n_param}`);
        }

        const { stdout } = await execFileAsync('deno', args, { cwd: __dirname });
        const output = JSON.parse(stdout);

        if (output.type === 'error') {
            throw new Error(output.error);
        }

        let decrypted_signature = '';
        let decrypted_n_sig = '';

        for (const r of output.responses) {
            if (r.type === 'result') {
                if (encrypted_signature in r.data) {
                    decrypted_signature = r.data[encrypted_signature];
                }
                if (n_param in r.data) {
                    decrypted_n_sig = r.data[n_param];
                }
            }
        }

        const response: SignatureResponse = {
            decrypted_signature,
            decrypted_n_sig,
        };

        res.json(response);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
});

app.post('/get_sts', (req: Request<{}, {}, StsRequest>, res: Response) => {
    res.status(501).json({ error: 'STS extraction is not supported by ejs.' });
});

const port = process.env.PORT || 8001;
const host = process.env.HOST || '0.0.0.0';

const start = async () => {
    try {
        await fs.mkdir(CACHE_DIR, { recursive: true });
        console.log(`Player cache directory created at: ${CACHE_DIR}`);
        app.listen(Number(port), host, () => {
            console.log(`Server listening on http://${host}:${port}`);
        });
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

start();