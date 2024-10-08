import fs from "fs";
import path from "path";

import json2openapi from "json-schema-to-openapi-schema";
import jsYaml from "js-yaml";

import utils from "./../../utils";
import log from "./../../utils/logger";

import * as types from "./../../types/types";
import * as openapiType from "./../../types/openapi";

/**
 * compile json schema to openapi spec
 * @param openapiOutFileName output file based on compilerOptions.openapiDir
 * @param compilerOptions 
 */
export async function compile(
    openapiOutFileName: string, 
    compilerOptions: types.compilerOptions
): Promise<void> {

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
        const jsonSchemaFilePath: string = path.posix.join(compilerOptions.jsonSchemaDir, file);
        log.process(`OpenApi : ${jsonSchemaFilePath}`);

        const jsonSchemaBuffer = fs.readFileSync(`${compilerOptions.jsonSchemaDir}/${file}`);
        const jsonSchema: types.jsonSchema = JSON.parse(jsonSchemaBuffer.toString());
        openapiJson = jsonToOpenapiPath(openapiJson, jsonSchema, { jsonSchemaFilePath: jsonSchemaFilePath });
        openapiJson = jsonToOpenapiComponentSchema(openapiJson, jsonSchema, { jsonSchemaFilePath: jsonSchemaFilePath }, compilerOptions);
    });

    const validOpenApi = json2openapi(openapiJson, { version: 3.0 });
    const openapiYaml = jsYaml.dump(validOpenApi);

    // create and write file
    const openapiOutFile: string = compilerOptions.openapiDir + openapiOutFileName;
    utils.common.writeFile("OpenApi", openapiOutFile, openapiYaml);

    return;
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
    const documentName: string = documentConfig.documentName;

    const properties: types.jsonSchema["properties"] = jsonSchema.properties;

    const routes: openapiType.paths = {
        ["/api/" + lowerDocName]: {
            "x-documentName": documentName,
        },
        ["/api/" + lowerDocName + "/{id}"]: {
            "x-documentName": documentName,
        },
    };

    documentConfig.methods.forEach((jsonSchemaMethod) => {
        const routeWithId: boolean = ["get", "put", "patch", "delete"].includes(jsonSchemaMethod);
        const useBody: boolean = ["post", "put", "patch"].includes(jsonSchemaMethod);
        const route: string = "/api/" + lowerDocName + (routeWithId ? "/{id}" : "");
        
        const httpMethod: types.httpMethod = utils.jsonSchema.httpMethod(jsonSchemaMethod, additionalinfo.jsonSchemaFilePath);
        const parameters: openapiType.parameter[] = [];
        let requestBody: openapiType.requestBody | undefined = undefined;
        const successResponse: openapiType.responses = {
            200: {
                description: "OK",
                content: {
                    "application/json": { schema: { $ref: `#/components/schemas/${httpMethod}${documentName}Response` } },
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
                    "x-format": properties["_id"]["x-format"],
                    minLength: properties["_id"].minLength,
                    maxLength: properties["_id"].maxLength,
                    minimum: properties["_id"].minimum,
                    maximum: properties["_id"].maximum,
                    enum: properties["_id"].enum,
                }
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
                    "application/json": { schema: { $ref: `#/components/schemas/${httpMethod}${documentName}Body` } },
                },
            };
        }

        routes[route][httpMethod] = {
            operationId: jsonSchemaMethod + documentName,
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
    const documentName = documentConfig.documentName;


    const componentSchemaResponse: openapiType.componentsSchemaValue = {
        type: "object",
        properties: json2openapi(
            utils.jsonSchema.cleanXcustomValue(jsonSchema.properties, ["index", "unique", "required"]),
            { version: 3.0 }
        ),
    };

    // without [ index:bool, unique:bool, required:bool ]
    const componentSchemaBodyRequired: openapiType.componentsSchemaValue = {
        type: "object",
        properties: json2openapi(
            utils.jsonSchema.cleanXcustomValue(jsonSchema.properties, { index: "boolean", unique: "boolean", required: "boolean" }),
            { version: 3.0 }
        ),
        required: jsonSchema.required,
    };
    
    // without [ _id:obj, index:bool, unique:bool, required:bool ]
    const componentSchemaBodyRequiredWithoutId: openapiType.componentsSchemaValue = {
        type: "object",
        properties: json2openapi(
            utils.jsonSchema.cleanXcustomValue(componentSchemaBodyRequired.properties as any, { _id: "object"}),
            { version: 3.0 }
        ),
        required: jsonSchema.required,
    }; 

    // without [ _id, index, unique, required:any ]
    const componentSchemaBody: openapiType.componentsSchemaValue = {
        type: "object",
        properties: json2openapi(
            utils.jsonSchema.cleanXcustomValue(componentSchemaBodyRequiredWithoutId.properties as any, ["required"]),
            { version: 3.0 }
        ),
    };   

    documentConfig.methods.forEach((jsonSchemaMethod) => {
        const httpMethod: types.httpMethod = utils.jsonSchema.httpMethod(jsonSchemaMethod, additionalinfo.jsonSchemaFilePath);

        switch (jsonSchemaMethod) {
        case "delete":
            // no param, no response
            break;
        case "get":
            componentSchemaPath[httpMethod + documentName + "Response"] = componentSchemaResponse;
            break;
        case "getList":{

            // add query params
            const parameters: openapiType.parameter[] = [];

            Object.keys(jsonSchema.properties).forEach((key) => {
                const props :types.jsonSchemaPropsItem = jsonSchema.properties[key];

                // skip object, it should not be in query
                if (props.type == "object") return;

                // make array to stingified array
                if (props.type == "array") {
                    props.type = "string";
                }

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
                    parameters.push({
                        name: "max_" + key,
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
                    break;
                default:
                    break;
                }
            });

                openapiJson.paths["/api/" + lowerDocName][httpMethod]!.parameters = parameters;

                componentSchemaPath[httpMethod + documentName + "Response"] = componentSchemaResponse;
                componentSchemaPath[httpMethod + documentName + "ResponseList"] = {
                    type: "array",
                    items: componentSchemaResponse,
                };
                break;
        }
        case "patch":    
            componentSchemaPath[httpMethod + documentName + "Body"] = componentSchemaBody;
            componentSchemaPath[httpMethod + documentName + "Response"] = componentSchemaResponse;
            break;

        case "post":
            componentSchemaPath[httpMethod + documentName + "Body"] = compilerOptions.app.allowApiCreateUpdate_id ? componentSchemaBodyRequired : componentSchemaBodyRequiredWithoutId ;
            componentSchemaPath[httpMethod + documentName + "Response"] = componentSchemaResponse;
            break;
        case "put":
            componentSchemaPath[httpMethod + documentName + "Body"] = compilerOptions.app.allowApiCreateUpdate_id ? componentSchemaBodyRequired : componentSchemaBodyRequiredWithoutId ;
            componentSchemaPath[httpMethod + documentName + "Response"] = componentSchemaResponse;
            break;
        default:
            break;
        }
    });

    openapiJson.components.schemas = Object.assign(openapiJson.components.schemas, componentSchemaPath);
    return openapiJson;
}

export default compile;