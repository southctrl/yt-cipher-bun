import { join } from "path";
import fs from "fs/promises";

export const CACHE_DIR = join(process.cwd(), 'player_cache');

export async function getPlayerFilePath(playerUrl: string): Promise<string> {
    // This hash of the player script url will mean that diff region scripts are treated as unequals, even for the same version #
    // I dont think I have ever seen 2 scripts of the same version differ between regions but if they ever do this will catch it
    // As far as player script access, I haven't ever heard about YT ratelimiting those either so ehh
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(playerUrl));
    const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    const filePath = join(CACHE_DIR, `${hash}.js`);

    try {
        await fs.stat(filePath);
        return filePath;
    } catch (error: any) {
        if (error.code === "ENOENT") {
            console.log(`Cache miss for player: ${playerUrl}. Fetching...`);
            const response = await fetch(playerUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch player from ${playerUrl}: ${response.statusText}`);
            }
            const playerContent = await response.text();
            await fs.writeFile(filePath, playerContent, "utf8");
            console.log(`Saved player to cache: ${filePath}`);
            return filePath;
        }
        throw error;
    }
}

export async function initializeCache() {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    console.log(`Player cache directory ensured at: ${CACHE_DIR}`);
}
