import { getPlayerFilePath } from "../playerCache.ts";
import type { StsRequest, StsResponse } from "../types.ts";
import fs from "fs/promises";
export async function handleGetSts(req: Request): Promise<Response> {
    const { player_url }: StsRequest = await req.json();
    const playerFilePath = await getPlayerFilePath(player_url);
    const playerContent = await fs.readFile(playerFilePath, "utf8");

    const stsPattern = /(signatureTimestamp|sts):(\d+)/;
    const match = playerContent.match(stsPattern);

    if (match && match[2]) {
        const response: StsResponse = { sts: match[2] };
        return new Response(JSON.stringify(response), { status: 200, headers: { "Content-Type": "application/json" } });
    } else {
        return new Response(JSON.stringify({ error: 'Timestamp not found in player script' }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
}
