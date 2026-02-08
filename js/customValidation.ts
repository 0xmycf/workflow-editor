import type {WorkflowOperator} from "./schema/workflowSchema";
import {FeatureDataType, ResultType} from "./schema/backendSchema";
import {Backend} from "./backend";
import {LGraphNode} from "litegraph.js/build/litegraph.core";
import {buildWorkflowFromInput} from "./util";
import {isPromise} from "./typeguards";

type ValidationMessage = string | undefined;

const dispatcher: Record<string, (instance: WorkflowOperator, backend: Backend, node: LGraphNode) => Promise<ValidationMessage> | ValidationMessage> = {
    GdalSource: validateGdalSource,
    OgrSource: validateOgrSource,
    NeighborhoodAggregate: validateNeighborhoodAggregate,
    ColumnRangeFilter: validateColumnRangeFilter,
    ClassHistogram: validateClassHistogram,
    Histogram: validateHistogram,
    VectorJoin: validateVectorJoin
};

export function customOperatorValidation(instance: WorkflowOperator, backend: Backend, node: LGraphNode): Promise<ValidationMessage> {
    const validator = dispatcher[instance.type];

    if (validator) {
        try {
            const res = validator(instance, backend, node);

            if (isPromise(res))
                return res.catch(err => {
                    // Validator was async and threw an unexpected error
                    return "Error during validation: " + err.message;
                });
            else
                return Promise.resolve(res);
        } catch (err: any) {
            // Validator was sync and threw an unexpected error
            return Promise.resolve("Error during validation: " + err.message);
        }
    } else {
        return Promise.resolve(undefined);
    }
}

async function assertDatasetType(instance: WorkflowOperator, backend: Backend, expectedType: string) {
    const datasetName: string = instance.params.data;
    const foundType = await backend.getDatasetType(datasetName);

    if (foundType !== expectedType) {
        return `Expected a dataset of type ${expectedType}, but "${datasetName}" is of type ${foundType}.`;
    }
}

function validateGdalSource(instance: WorkflowOperator, backend: Backend) {
    const expectedType = ResultType.enum.raster;

    return assertDatasetType(instance, backend, expectedType);
}

async function validateOgrSource(instance: WorkflowOperator, backend: Backend) {
    const expectedType = ResultType.enum.vector;

    return assertDatasetType(instance, backend, expectedType);
}

function validateNeighborhoodAggregate(instance: WorkflowOperator) {
    if (instance.params.neighborhood.type === "weightsMatrix") {
        const weights: number[][] = instance.params.neighborhood.weights;
        const rowCount = weights.length;

        if (rowCount % 2 === 0) {
            return `The weights matrix must have odd dimensions, but it has ${rowCount} rows.`;
        }
        const firstColumnLength = weights[0].length;

        if (firstColumnLength % 2 === 0) {
            return `The weights matrix must have odd dimensions, but the first row has ${firstColumnLength} cells.`;
        }
        for (let rowIndex = 1; rowIndex < rowCount; rowIndex++) {
            const currentColumnLength = weights[rowIndex].length;

            if (currentColumnLength !== firstColumnLength) {
                return `All rows must have the same length, but the first row has ${firstColumnLength} cells and row ${rowIndex + 1} has ${currentColumnLength} cells.`;
            }
        }
    }
}

async function validateColumnRangeFilter(instance: WorkflowOperator, backend: Backend, node: LGraphNode) {
    const workflow = buildWorkflowFromInput(node, 0)!;
    const workflowMetadata = await backend.getWorkflowMetadata(workflow);

    const expectedName: string = instance.params.column;
    // @ts-ignore
    const foundColumnMeta = workflowMetadata.columns[expectedName];

    if (!foundColumnMeta) {
        return `The source does not contain a column named "${expectedName}".`;
    }

    const expectedType = instance.params.ranges.length > 0 ? typeof instance.params.ranges[0][0] : undefined;

    if (!expectedType) {
        return undefined;
    }
    if (foundColumnMeta.dataType === FeatureDataType.enum.text) {
        if (expectedType !== "string") {
            return `The column "${expectedName}" is of type ${foundColumnMeta.dataType}, but the range does not consist of strings.`;
        }
    } else {
        if (expectedType !== "number") {
            return `The column "${expectedName}" is of type ${foundColumnMeta.dataType}, but the range does not consist of numbers.`;
        }
    }
}

async function validateClassHistogram(instance: WorkflowOperator, backend: Backend, node: LGraphNode) {
    const workflow = buildWorkflowFromInput(node, 0)!;
    const workflowMetadata = await backend.getWorkflowMetadata(workflow);

    const expectedName: string | null | undefined = instance.params.columnName;

    switch (workflowMetadata.type) {
        case "vector":
            if (expectedName == null) {
                return `The parameter "columnName" must be set for a source of type Vector.`;
            }
            const foundColumnMeta = workflowMetadata.columns[expectedName];

            if (!foundColumnMeta) {
                return `The source does not contain a column named "${expectedName}".`;
            }
            if (!["float", "category", "int", "text", "bool", "dateTime"].includes(foundColumnMeta.dataType)) {
                //"text" works too because the backend parses strings internally and never throws
                return `The column ${expectedName} must be numeric.`;
            }
            if (foundColumnMeta.measurement.type !== "classification") {
                return `The column ${expectedName} must be classified.`;
            }
            break;

        case "raster":
            if (expectedName != null) {
                return `The parameter "columnName" must not be set for a source of type Raster.`;
            }
            const foundBandMeta = workflowMetadata.bands[0];

            if (foundBandMeta.measurement.type !== "classification") {
                return `The band ${expectedName} must be classified.`;
            }
            break;
    }
}

async function validateHistogram(instance: WorkflowOperator, backend: Backend, node: LGraphNode) {
    const workflow = buildWorkflowFromInput(node, 0)!;
    const workflowMetadata = await backend.getWorkflowMetadata(workflow);

    const expectedName: string | null | undefined = instance.params.columnName;

    switch (workflowMetadata.type) {
        case "vector":
            if (expectedName == null) {
                return `The parameter "columnName" must be set for a source of type Vector.`;
            }
            const foundColumnMeta = workflowMetadata.columns[expectedName];

            if (!foundColumnMeta) {
                return `The source does not contain a column named "${expectedName}".`;
            }
            if (!["float", "category", "int", "text", "bool", "dateTime"].includes(foundColumnMeta.dataType)) {
                //"text" works too because the backend parses strings internally and never throws
                return `The column ${expectedName} must be numeric.`;
            }
            break;

        case "raster":
            if (expectedName != null) {
                return `The parameter "columnName" must not be set for a source of type Raster.`;
            }
            break;
    }
}

async function validateVectorJoin(instance: WorkflowOperator, backend: Backend, node: LGraphNode) {
    switch (instance.params.type) {
        case "EquiGeoToData":
            const [leftWorkflowMetadata, rightWorkflowMetadata] = await Promise.all([
                backend.getWorkflowMetadata(buildWorkflowFromInput(node, "left")!),
                backend.getWorkflowMetadata(buildWorkflowFromInput(node, "right")!)
            ]);
            if (leftWorkflowMetadata.type !== "vector" || rightWorkflowMetadata.type !== "vector") throw new Error("unreachable");

            const expectedLeftName: string = instance.params.left_column;
            const expectedRightName: string = instance.params.right_column;

            if (!(expectedLeftName in leftWorkflowMetadata.columns)) {
                return `The source "left" does not contain a column named "${expectedLeftName}".`;
            }
            if (!(expectedRightName in rightWorkflowMetadata.columns)) {
                return `The source "right" does not contain a column named "${expectedLeftName}".`;
            }

            if (leftWorkflowMetadata.dataType === "Data") {
                return `The source "left" must contain geodata.`;
            }
            if (rightWorkflowMetadata.dataType !== "Data") {
                return `The source "right" must not contain geodata.`;
            }
            break;
    }
}
