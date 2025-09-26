const ALLOWED_HOSTNAMES = ["youtube.com", "www.youtube.com", "m.youtube.com"];

export function validateAndNormalizePlayerUrl(playerUrl: string): string {
    // Handle relative paths
    if (playerUrl.startsWith('/')) {
        if (playerUrl.startsWith('/s/player/')) {
             return `https://www.youtube.com${playerUrl}`;
        }
        throw new Error(`Invalid player path: ${playerUrl}`);
    }

    // Handle absolute URLs
    try {
        const url = new URL(playerUrl);
        if (ALLOWED_HOSTNAMES.includes(url.hostname)) {
            return playerUrl;
        } else {
            throw new Error(`Player URL from invalid host: ${url.hostname}`);
        }
    } catch (e) {
        // Not a valid URL, and not a valid path.
        throw new Error(`Invalid player URL: ${playerUrl}`);
    }
}