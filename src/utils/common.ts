// read package.json and get version
import fs from "fs";
import path from 'path';
import jsYaml from "js-yaml";
import { compilerOptions } from "../types/types";
import log from "./log";

function getPackageInfo(): {
    version: string,
    author: string,
} {
    const packageJson = fs.readFileSync("./package.json", "utf8");
    const packageJsonObject = JSON.parse(packageJson);

    return {
        version: packageJsonObject.dependencies['very-express']?.replace('^', '') || "[unknown version]",
        author: packageJsonObject.author || "justin26l",
    };
}

export const relativePath = (fromPath: string, toPath: string): string => {
    return path.relative(fromPath, toPath).replace(/\\/g, '/');
};

export function loadYaml(yamlFilePath: string) {
    try {
        const doc = jsYaml.load(fs.readFileSync(yamlFilePath, 'utf8'));
        // console.dir(doc, { depth: null });
    } catch (e:any) {
        log.error('Error Load OpenApi File :\n', e.message || e);
    }
};

export function getGenaratorHeaderComment(comment?: string): string {
    const packageInfo = getPackageInfo();
    return `/* eslint-disable */
/**
 * Generated by veryExpress@${packageInfo.version}
 * DO NOT MODIFY MANUALLY. Instead, modify the JsonSchema file,
 * then run veryExpress to regenerate this file.
 * 
 * author: ${packageInfo.author}
 * version: ${packageInfo.version}${comment ? `\n * comment: ${comment}` : ''}
 */
`;
};

export function getSimpleHeaderComment() :string {
    const packageInfo = getPackageInfo();
    return `// Generated by veryExpress@${packageInfo.version}`;
};

export function cleanXcustomValue(
    schemaObj: { [key: string]: any },
    additionalKeyArr?: string[]
): { [key: string]: any } {
    let obj = Object.assign(schemaObj);
    // filtr out key start with 'x-' and additionalKeyArr recursively
    for (const key in obj) {
        if (key.startsWith("x-")) {
            delete obj[key];
        }
        else if (additionalKeyArr && additionalKeyArr.includes(key)) {
            delete obj[key];
        }
        else if (typeof obj[key] === "object") {
            cleanXcustomValue(obj[key], additionalKeyArr);
        }
    }
    return obj;
};

export function copyDir(source: string, destination: string): void {
    if (!fs.existsSync(destination)) {
        fs.mkdirSync(destination);
    }

    const files: string[] = fs.readdirSync(source);

    for (let i = 0; i < files.length; i++) {
        const current: fs.Stats = fs.lstatSync(source+'/'+files[i]);

        if (current.isDirectory()) {
            copyDir(source+'/'+files[i], destination+'/'+files[i]);
        }
        else if (current.isSymbolicLink()) {
            const symlink = fs.readlinkSync(source+'/'+files[i]);
            fs.symlinkSync(symlink, destination+'/'+files[i]);
        }
        else {
            const outPath :string = destination+'/'+files[i];
            log.writing(`Utils : ${outPath}`);
            fs.copyFileSync(source+'/'+files[i], outPath);
        }
    }
}

export const defaultCompilerOptions: compilerOptions = {
    headerComment: getGenaratorHeaderComment(),
};

export default {
    getGenaratorHeaderComment,
    getSimpleHeaderComment,
    defaultCompilerOptions,
    relativePath,
    cleanXcustomValue,
    loadYaml,
    copyDir,
};
