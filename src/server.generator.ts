import fs from "fs";

import templates from "./templates";

import * as types from "./types/types";

/**
 * write files at root directory
 * - server.ts
 * - .env 
 * @param outDir 
 * @param options 
 */
export function compile(
    outDir: string,
    options?: types.compilerOptions
): void {

    const serverOutPath = `${outDir}/server.ts`;
    const envOutPath = `${outDir}/.env`;

    // write server file
    console.log('\x1b[32m%s\x1b[0m', '[Writing]', `Server : ${serverOutPath}`);
    fs.writeFileSync(outDir+'/server.ts',
        templates.serverTemplate({
            options: options,
        })
    );

    // write .env file
    console.log('\x1b[32m%s\x1b[0m', '[Writing]', `Server : ${envOutPath}`);
    fs.writeFileSync(`${outDir}/.env`,
        `# generated by very-express\n\nVERYEXPRESS_PORT=3000`
    );

};
