import fs from "fs";

import serverTemplate from "./server.template";
import packageJson from "../project/packageJson.generator";

import utils from "../../utils";
import log from "../../utils/logger";

import * as types from "../../types/types";

/**
 * generate required files at root & output directory
 * @param compilerOptions 
 */
export async function compile(
    compilerOptions: types.compilerOptions
): Promise<void> {

    const serverOutPath = compilerOptions.srcDir + "/server.ts";
    const packageOutPath = compilerOptions.rootDir + "/package.json";
    const envOutPath = compilerOptions.rootDir + "/.env";
    const tsconfigOutPath = compilerOptions.rootDir + "/tsconfig.json";

    // write server file
    utils.common.writeFile(
        "Server",
        serverOutPath,
        serverTemplate({
            compilerOptions: compilerOptions,
        })
    );

    // write .env
    if (!fs.existsSync(envOutPath)) {
        log.writing(`Root : ${envOutPath}`);
        fs.copyFileSync(__dirname+"/templates/root/.env", envOutPath);
    }

    // write tsconfig.json
    if (!fs.existsSync(tsconfigOutPath)) {
        // try {
        log.writing(`Root : ${tsconfigOutPath}`);
        fs.copyFileSync(__dirname+"/templates/root/tsconfig.json", tsconfigOutPath);
        //     childProcess.execSync('tsc --init', { cwd: '.', stdio: 'inherit' });
        // } catch (error) {
        //     log.error('Failed to execute command: tsc --init');
        // }
    }

    // process package.json
    packageJson.compile(packageOutPath, compilerOptions);

    return;
}
