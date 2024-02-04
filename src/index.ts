import fs from "fs";

import json2mongoose from "json2mongoose";
import * as openapiGen from "./generators/openapi.generator";

import log from "./utils/log";
import utils from "./utils/common";
import * as controllerGen from "./generators/controllers.generator";
import * as routeGen from "./generators/routes.generator";
import * as serverGen from "./generators/server.generator";

import * as types from "./types/types";
import { formatJsonSchema } from "./preprocess/jsonschemaFormat";


export default function generate(
    options: types.compilerOptions
): void {
    const dir = {
        routeDir: `${options.srcDir}/routes`,
        middlewareDir: `${options.srcDir}/middlewares`,
        controllerDir: `${options.srcDir}/controllers`,
        modelDir: `${options.srcDir}/models`,
        typeDir: `${options.srcDir}/types`,
        serviceDir: `${options.srcDir}/services`,
        pluginDir: `${options.srcDir}/plugins`,
        utilsDir: `${options.srcDir}/utils`,
    };

    const openapiFile: string = "/openapi.gen.yaml";
    const openapipath: string = options.openapiDir + openapiFile;

    // create all directories if not exist
    if (!fs.existsSync(options.rootDir)) { fs.mkdirSync(options.rootDir); }
    if (!fs.existsSync(options.srcDir)) { fs.mkdirSync(options.srcDir); }
    if (!fs.existsSync(options.openapiDir)) { fs.mkdirSync(options.openapiDir); }
    Object.values(dir).forEach((path: string) => {
        if (!fs.existsSync(path)) { fs.mkdirSync(path); }
    });

    // genarate opanapi from json schema
    openapiGen.compile(schemaDir, openapipath);

    // copy nessasary files
    utils.copyDir(`${options.jsonSchemaDir}`, options.rootDir + "/openapi");
    utils.copyDir(`${__dirname}/templates/utils`, dir.utilsDir);
    utils.copyDir(`${__dirname}/templates/services`, dir.serviceDir);
    utils.copyDir(`${__dirname}/templates/plugins`, dir.pluginDir);
    utils.copyDir(`${__dirname}/templates/routes`, dir.routeDir);

    // prepair routerData
    log.process(`Router : ${openapipath}`);
    const routeData: {
        route: string,
        interfaceName: string,
        controllerPath: string,
    }[] = [];

    const files: string[] = fs.readdirSync(options.jsonSchemaDir);
    files.forEach((schemaFileName: string) => {
        const schemaPath = `${options.jsonSchemaDir}/${schemaFileName}`;
        try {
            // ignore non json files
            if (!schemaFileName.endsWith(".json")) {
                log.warn(`Skipping Non Json File : ${schemaPath}`);
                return;
            }

            // read schema file config
            const jsonSchema: types.jsonSchema = formatJsonSchema(schemaPath);
            const documentConfig: types.documentConfig = jsonSchema["x-documentConfig"];

            if (typeof jsonSchema.properties !== "object") log.error(`properties is invalid in ${schemaPath}`);

            // check if 'fileName.nogen.ts' exist then skip generate of this file
            if (!fs.existsSync(`${schemaPath}.nogen.ts`)) {
                // make interface
                json2mongoose.typesGen.compileFromFile(
                    `${schemaPath}`,
                    `${dir.typeDir}/${documentConfig.interfaceName}.gen.ts`,
                    options || utils.defaultCompilerOptions
                );
            }

            // make model
            if (!fs.existsSync(`${schemaPath}Model.nogen.ts`)) {
                json2mongoose.modelsGen.compileFromFile(
                    `${schemaPath}`,
                    `${utils.relativePath(dir.modelDir, dir.typeDir)}/${documentConfig.interfaceName}.gen`,
                    `${dir.modelDir}/${documentConfig.interfaceName}Model.gen.ts`,
                    options || utils.defaultCompilerOptions
                );
            }

            // prepair route data
            routeData.push({
                route: `/${documentConfig.documentName}`,
                interfaceName: documentConfig.interfaceName,
                controllerPath: utils.relativePath(dir.routeDir, dir.controllerDir) + "/" + documentConfig.interfaceName + "Controller.gen",
            });

        }
        catch (err: any) {
            log.error(`Processing File : ${schemaPath}\n`, err);
        }
    });

    // genarate opanapi from json schema
    if (!fs.existsSync(options.openapiDir + "/openapi.nogen.yaml")) {
        openapiGen.compile({
            openapiOutFileName : openapiFile, 
            compilerOptions : options || utils.defaultCompilerOptions
        });
    }

    // clone nessasary files
    utils.copyDir(`${options.openapiDir}`, options.rootDir + "/openapi");
    utils.copyDir(`${__dirname}/templates/utils`, dir.utilsDir);

    // genarate controller from open api
    controllerGen.compile({
        openapiFile: openapiFile,
        controllerOutDir: dir.controllerDir,
        modelDir: dir.modelDir,
        compilerOptions: options || utils.defaultCompilerOptions
    });

    // make route from routeData
    routeGen.compile({
        routesArr: routeData,
        openapiFile: openapiFile,
        routesOutPath: `${dir.routeDir}/routes.gen.ts`,
        compilerOptions: options || utils.defaultCompilerOptions
    });

    // make middleware

    // make service

    // make server
    serverGen.compile(options);

}

