export interface compilerOptions {
    commitBeforeGenerate: boolean;
    headerComment?: string;
    modelsTemplate?: string;
    controllersTemplate?: string;

    jsonSchemaDir: string,
    openapiDir: string,
    rootDir: string,
    srcDir: string,

    enableSwagger: true,
    useUserSchema: true,
    useOauth: {
        google?: boolean,
        microsoft?: boolean,
        apple?: boolean,
        github?: boolean,
        [key: string]: boolean | undefined;
    };
}

export interface jsonSchema {
    type: string;
    "x-documentConfig": documentConfig;
    properties: {
        [key: string]: jsonSchemaPropsItem;
    };
    required?: string[];
    index?: string[];
    [key: string]: any;
}

export interface jsonSchemaPropsItem {
    type: string;
    description?: string;
    format?: string;
    properties?: { 
        [key: string]: jsonSchemaPropsItem;
    };
    items?: jsonSchemaPropsItem;
    enum?: any[];
    required?: boolean | string[];
    index?: boolean;
    example?: any;
    "x-format"?: string;
    minLength?: number;
    maxLength?: number;
    minimum?: number;
    maximum?: number;
    [key: string]: string | boolean | number | string[] | jsonSchemaPropsItem | { [key: string]: jsonSchemaPropsItem;} | any[] | undefined;
}

export interface documentConfig {
    documentName: string;
    documentType?: "primary" | "secondary";
    interfaceName: string;
    keyPrefix?: string;
    methods: schemaMethod[];
}

/**
 * fieldsName : fieldsType
 */
export interface additionalKeyObj {
    [key: string]: string;
}

/** method key allowed in json schema, httpMethod with extra "getList" */
export type schemaMethod = "get" | "getList" | "post" | "put" | "patch" | "delete" | "options" | "head" | "trace" ;

export const schemaMethodArr : schemaMethod[] = [ "get", "getList", "post", "put", "patch", "delete", "options", "head", "trace" ];

/** schemaMethod without "getList" */
export type httpMethod = "get" | "post" | "put" | "patch" | "delete" | "options" | "head" | "trace" ;
export const httpMethodArr : httpMethod[] = [ "get", "post", "put", "patch", "delete", "options", "head", "trace"];
