import {z} from "zod";
import {fetchAndParse, getDefinitionName} from "../util";
import {JSON_META_SCHEMA_URL} from "../constants";
import {validate} from "jsonschema";
import {AnyResponse} from "./backendSchema";

const JsonSchemaRef = z.object({
    $ref: z.string()
});

export type JsonSchemaRef = z.infer<typeof JsonSchemaRef>;

const JsonSchemaLinks = z.array(z.object({
    rel: z.string(),
    href: z.string()
})).optional();

const OperatorDefinitionParam = z.object({}).passthrough();

export type OperatorDefinitionParam = z.infer<typeof OperatorDefinitionParam>;

const OperatorDefinitionParams = z.object({
    properties: z.record(z.string(), OperatorDefinitionParam),
    required: z.array(z.string()),
    oneOf: z.array(OperatorDefinitionParam)
}).partial();

export type OperatorDefinitionParams = z.infer<typeof OperatorDefinitionParams>;

const OperatorDefinitionSource = z.union([
    // normal raster, vector or plot source
    JsonSchemaRef,
    // array of sources
    z.object({items: JsonSchemaRef}),
    // union of sources
    z.object({anyOf: z.array(JsonSchemaRef)})
]).transform(source => "$ref" in source ? {
    pinType: getDefinitionName(source)
} : "items" in source ? {
    pinType: "array",
    innerType: getDefinitionName(source.items)
} : {
    pinType: source.anyOf.map(getDefinitionName).join()
});

export type OperatorDefinitionSource = z.infer<typeof OperatorDefinitionSource>;

const OperatorDefinitionSources = z.object({
    properties: z.record(z.string(), OperatorDefinitionSource),
    required: z.array(z.string()).optional()
});

const OperatorDefinition = z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    links: JsonSchemaLinks,
    properties: z.object({
        type: z.object({
            //the single element is operator id
            "enum": z.array(z.string()).nonempty().length(1)
        }),
        params: OperatorDefinitionParams,
        sources: OperatorDefinitionSources.optional()
    })
});

export type OperatorDefinition = z.infer<typeof OperatorDefinition>;

const DatatypeDefinition = z.object({
    oneOf: z.array(JsonSchemaRef)
});

export type DatatypeDefinition = z.infer<typeof DatatypeDefinition>;

let cachedMetaSchema: any = null;

export let WorkflowSchema = z.object({
    definitions: z.record(z.string(), z.union([OperatorDefinition, DatatypeDefinition]))
}).refine(async (editorSchema) => {
    if (!cachedMetaSchema) {
        cachedMetaSchema = await fetchAndParse(JSON_META_SCHEMA_URL, undefined, AnyResponse);
    }
    return validate(editorSchema, cachedMetaSchema).valid;
}, "The operator definition file must be valid json schema");

export type WorkflowSchema = z.infer<typeof WorkflowSchema>;

const BaseWorkflowOperator = z.object({
    type: z.string(),
    params: z.record(z.string(), z.any()),
});

export type WorkflowOperator = z.infer<typeof BaseWorkflowOperator> & {
    sources?: Record<string, WorkflowOperator | WorkflowOperator[]>
};

export const WorkflowOperator: z.ZodType<WorkflowOperator> = BaseWorkflowOperator.extend({
    sources: z.lazy(() => z.record(
        z.string(),
        z.union([WorkflowOperator, z.array(WorkflowOperator)])
    ).optional())
});

export const Workflow = z.object({
    type: z.enum(["Vector", "Raster", "Plot"]),
    operator: WorkflowOperator
});

export type Workflow = z.infer<typeof Workflow>;