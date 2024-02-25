import json2openapi from "json-schema-to-openapi-schema";
import yaml from "js-yaml";
import fs from "fs";

import * as types from "../types/types";
import * as openapiType from "../types/openapi";
import utilsJsonSchema from "../utils/jsonSchema";
import log from "../utils/logger";

/**
 * compile json schema to openapi spec
 * @param openapiOutFileName output file based on compilerOptions.openapiDir
 * @param compilerOptions 
 */
export function compile(
    openapiOutFileName: string, 
    compilerOptions: types.compilerOptions
): void {

    // convert to yaml
    let openapiJson: openapiType.openapi = {
        openapi: "3.0.0",
        info: {
            title: "veryExpress generated api server",
            description: "OpenApi Spec generated by veryExpress",
            version: "1.0.0"
        },
        paths: {},
        components: {
            schemas: {},
        },
    };

    // loop through all json schema files and compile to openapi paths & components

    const files = fs.readdirSync(compilerOptions.jsonSchemaDir);
    files.forEach((file) => {
        // ignore non json files
        if (!file.endsWith(".json")) return;
        const jsonSchemaFilePath: string = compilerOptions.jsonSchemaDir + "/" + file;
        log.process(`OpenApi : ${jsonSchemaFilePath}`);

        const jsonSchemaBuffer = fs.readFileSync(`${compilerOptions.jsonSchemaDir}/${file}`);
        const jsonSchema: types.jsonSchema = JSON.parse(jsonSchemaBuffer.toString());
        openapiJson = jsonToOpenapiPath(openapiJson, jsonSchema, { jsonSchemaFilePath: jsonSchemaFilePath });
        openapiJson = jsonToOpenapiComponentSchema(openapiJson, jsonSchema, { jsonSchemaFilePath: jsonSchemaFilePath }, compilerOptions);
    });

    const validOpenApi = json2openapi(openapiJson, { version: 3.0 });
    const openapiYaml = yaml.dump(validOpenApi);

    // create and write file
    const openapiOutFile: string = compilerOptions.openapiDir + openapiOutFileName;
    log.writing(`OpenApi : ${openapiOutFile}`);
    fs.writeFileSync(openapiOutFile, openapiYaml);
}

function jsonToOpenapiPath(
    openapiJson: openapiType.openapi,
    jsonSchema: types.jsonSchema,
    additionalinfo: {
        jsonSchemaFilePath: string
    }
): openapiType.openapi {
    // get jsonschema properties
    const documentConfig: types.documentConfig = jsonSchema["x-documentConfig"];
    const lowerDocName: string = documentConfig.documentName.toLowerCase();
    const interfaceName: string = documentConfig.interfaceName;

    const properties: types.jsonSchema["properties"] = jsonSchema.properties;

    const routes: openapiType.paths = {
        ["/" + lowerDocName]: {
            "x-collection": documentConfig.documentName,
            "x-interface": interfaceName,
        },
        ["/" + lowerDocName + "/{id}"]: {
            "x-collection": documentConfig.documentName,
            "x-interface": interfaceName,
        },
    };

    documentConfig.methods.forEach((jsonSchemaMethod) => {
        const routeWithId: boolean = ["get", "put", "patch", "delete"].includes(jsonSchemaMethod);
        const useBody: boolean = ["post", "put", "patch"].includes(jsonSchemaMethod);
        const route: string = "/" + lowerDocName + (routeWithId ? "/{id}" : "");
        
        const httpMethod: types.httpMethod = utilsJsonSchema.httpMethod(jsonSchemaMethod, additionalinfo.jsonSchemaFilePath);
        const parameters: openapiType.parameter[] = [];
        let requestBody: openapiType.requestBody | undefined = undefined;
        const successResponse: openapiType.responses = {
            200: {
                description: "OK",
                content: {
                    "application/json": { schema: { $ref: `#/components/schemas/${httpMethod}${interfaceName}Response` } },
                },
            },
        };
        
        // update parameters/body & responses
        if ( routeWithId && properties["_id"] ) {
            const idParameter: openapiType.parameter = {
                name: "id",
                in: "path",
                description: properties["_id"].description,
                required: true,
                schema: {
                    type: properties["_id"].type,
                    format: properties["_id"].format,
                },
            };

            parameters.push(idParameter);
        }

        // POST will use 201 success response
        if (httpMethod == "post") {
            successResponse[201] = Object.assign({}, successResponse[200]);
            successResponse[201].description = "Crerated";
            delete successResponse[200];
        }
        else if (httpMethod == "delete") {
            delete successResponse[200].content;
        }   
        
        if (useBody) {
            requestBody = {
                description: `${httpMethod} ${documentConfig.documentName}`,
                required: false,
                content: {
                    "application/json": { schema: { $ref: `#/components/schemas/${httpMethod}${interfaceName}Body` } },
                },
            };
        }

        routes[route][httpMethod] = {
            operationId: jsonSchemaMethod + interfaceName,
            tags: [lowerDocName],
            parameters: parameters,
            requestBody: requestBody,
            responses: Object.assign(
                {
                    400: { description: "Bad Request", },
                    401: { description: "Unauthorized", },
                    403: { description: "Forbidden", },
                    404: { description: "Not Found", },
                    405: { description: "Method Not Allowed", },
                    413: { description: "Payload Too Large", },
                    429: { description: "Too Many Requests", },
                    500: { description: "Internal Server Error", },
                    502: { description: "Bad Gateway", },
                    503: { description: "Service Unavailable", },
                }, 
                successResponse
            )
        };

    });

    openapiJson.paths = Object.assign(openapiJson.paths, routes);
    return openapiJson;
}

/**
 * convert json schema to openapi component schema
 */
function jsonToOpenapiComponentSchema(
    openapiJson: openapiType.openapi,
    jsonSchema: types.jsonSchema,
    additionalinfo: {
        jsonSchemaFilePath: string
    },
    compilerOptions: types.compilerOptions
): openapiType.openapi {
    const componentSchemaPath: openapiType.components["schemas"] = {};

    // get jsonschema properties
    const documentConfig = jsonSchema["x-documentConfig"];
    const lowerDocName = documentConfig.documentName.toLowerCase();
    const interfaceName = documentConfig.interfaceName;


    const componentSchemaResponse: openapiType.componentsSchemaValue = {
        type: "object",
        properties: json2openapi(
            utilsJsonSchema.cleanXcustomValue(jsonSchema.properties, ["index", "unique", "required"]),
            { version: 3.0 }
        ),
    };

    // without [ index:bool, unique:bool, required:bool ]
    const componentSchemaBodyRequired: openapiType.componentsSchemaValue = {
        type: "object",
        properties: json2openapi(
            utilsJsonSchema.cleanXcustomValue(jsonSchema.properties, { index: "boolean", unique: "boolean", required: "boolean" }),
            { version: 3.0 }
        ),
        required: jsonSchema.required,
    };
    
    // without [ _id:obj, index:bool, unique:bool, required:bool ]
    const componentSchemaBodyRequiredWithoutId: openapiType.componentsSchemaValue = {
        type: "object",
        properties: json2openapi(
            utilsJsonSchema.cleanXcustomValue(componentSchemaBodyRequired.properties as any, { _id: "object"}),
            { version: 3.0 }
        ),
        required: jsonSchema.required,
    }; 

    // without [ _id, index, unique, required:any ]
    const componentSchemaBody: openapiType.componentsSchemaValue = {
        type: "object",
        properties: json2openapi(
            utilsJsonSchema.cleanXcustomValue(componentSchemaBodyRequiredWithoutId.properties as any, ["required"]),
            { version: 3.0 }
        ),
    };   

    documentConfig.methods.forEach((jsonSchemaMethod) => {
        const httpMethod: types.httpMethod = utilsJsonSchema.httpMethod(jsonSchemaMethod, additionalinfo.jsonSchemaFilePath);

        switch (jsonSchemaMethod) {
        case "delete":
            // no param, no response
            break;
        case "get":
            componentSchemaPath[httpMethod + interfaceName + "Response"] = componentSchemaResponse;
            break;
        case "getList":{

            // add query params
            const parameters: openapiType.parameter[] = [];

            Object.keys(jsonSchema.properties).forEach((key) => {
                const props :types.jsonSchemaPropsItem = jsonSchema.properties[key];

                // skip object, it should not be in query
                if (props.type == "object") return;

                parameters.push({
                    name: key,
                    in: "query",
                    required: false,
                    schema: {
                        type: props.type,
                        format: props.format,
                        "x-format": props["x-format"],
                        minLength: props.minLength,
                        maxLength: props.maxLength,
                        minimum: props.minimum,
                        maximum: props.maximum,
                        enum: props.enum,
                    }
                });

                switch (props["x-format"]) {
                case "minMax":
                    // add filter from, to
                    parameters.push({
                        name: "min_" + key,
                        in: "query",
                        required: false,
                        schema: {
                            type: "number",
                        }
                    });
                    parameters.push({
                        name: "max_" + key,
                        in: "query",
                        required: false,
                        schema: {
                            type: "number",
                        }
                    });
                    break;
                default:
                    break;
                }
            });

                openapiJson.paths["/" + lowerDocName][httpMethod]!.parameters = parameters;

                componentSchemaPath[httpMethod + interfaceName + "Response"] = componentSchemaResponse;
                componentSchemaPath[httpMethod + interfaceName + "ResponseList"] = {
                    type: "array",
                    items: componentSchemaResponse,
                };
                break;
        }
        case "patch":    
            componentSchemaPath[httpMethod + interfaceName + "Body"] = componentSchemaBody;
            componentSchemaPath[httpMethod + interfaceName + "Response"] = componentSchemaResponse;
            break;

        case "post":
            componentSchemaPath[httpMethod + interfaceName + "Body"] = compilerOptions.app.allowApiCreateUpdate_id ? componentSchemaBodyRequired : componentSchemaBodyRequiredWithoutId ;
            componentSchemaPath[httpMethod + interfaceName + "Response"] = componentSchemaResponse;
            break;
        case "put":
            componentSchemaPath[httpMethod + interfaceName + "Body"] = componentSchemaBodyRequired;
            componentSchemaPath[httpMethod + interfaceName + "Response"] = componentSchemaResponse;
            break;
        default:
            break;
        }
    });

    openapiJson.components.schemas = Object.assign(openapiJson.components.schemas, componentSchemaPath);
    return openapiJson;
}

export default compile;