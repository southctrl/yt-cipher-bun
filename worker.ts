import main from "./ejs/src/main.ts";
import type { Input as MainInput, Output as MainOutput } from "./ejs/src/main.ts";

self.onmessage = (e: MessageEvent<MainInput>) => {
    try {
        const output: MainOutput = main(e.data);
        self.postMessage({ type: 'success', data: output });
    } catch (error: any) {
        self.postMessage({
            type: 'error',
            data: {
                message: error.message,
                stack: error.stack,
            }
        });
    }
};
