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
                    return "Fehler beim Validieren: " + err.message;
                });
            else
                return Promise.resolve(res);
        } catch (err: any) {
            // Validator was sync and threw an unexpected error
            return Promise.resolve("Fehler beim Validieren: " + err.message);
        }
    } else {
        return Promise.resolve(undefined);
    }
}

async function assertDatasetType(instance: WorkflowOperator, backend: Backend, expectedType: string) {
    const datasetName: string = instance.params.data;
    const foundType = await backend.getDatasetType(datasetName);

    if (foundType !== expectedType) {
        return `Es wird ein Datensatz vom Typ ${expectedType} erwartet, aber "${datasetName}" ist vom Typ ${foundType}.`;
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
            return `Die Gewichtungsmatrix muss ungerade Dimensionen haben. Es gibt aber ${rowCount} Zeilen.`;
        }
        const firstColumnLength = weights[0].length;

        if (firstColumnLength % 2 === 0) {
            return `Die Gewichtungsmatrix muss ungerade Dimensionen haben. Die erste Zeile hat aber ${firstColumnLength} Zellen.`;
        }
        for (let rowIndex = 1; rowIndex < rowCount; rowIndex++) {
            const currentColumnLength = weights[rowIndex].length;

            if (currentColumnLength !== firstColumnLength) {
                return `Alle Zeilen müssen gleich lang sein. Die erste Zeile hat aber ${firstColumnLength} Zellen und Zeile ${rowIndex + 1} ${currentColumnLength} Zellen.`;
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
        return `Die Quelle enthält keine Spalte mit dem Namen "${expectedName}".`;
    }

    const expectedType = instance.params.ranges.length > 0 ? typeof instance.params.ranges[0][0] : undefined;

    if (!expectedType) {
        return undefined;
    }
    if (foundColumnMeta.dataType === FeatureDataType.enum.text) {
        if (expectedType !== "string") {
            return `Die Spalte "${expectedName}" ist vom Typ ${foundColumnMeta.dataType}, aber die Range besteht nicht aus Strings.`;
        }
    } else {
        if (expectedType !== "number") {
            return `Die Spalte "${expectedName}" ist vom Typ ${foundColumnMeta.dataType}, aber die Range besteht nicht aus Zahlen.`;
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
                return `Der Parameter "columnName" muss gesetzt sein bei einer Quelle vom Typ Vector.`;
            }
            const foundColumnMeta = workflowMetadata.columns[expectedName];

            if (!foundColumnMeta) {
                return `Die Quelle enthält keine Spalte mit dem Namen "${expectedName}".`;
            }
            if (!["float", "category", "int", "text", "bool", "dateTime"].includes(foundColumnMeta.dataType)) {
                //"text" works too because the backend parses strings internally and never throws
                return `Die Spalte ${expectedName} muss numerisch sein.`;
            }
            if (foundColumnMeta.measurement.type !== "classification") {
                return `Die Spalte ${expectedName} muss in Klassen eingeteilt sein.`;
            }
            break;

        case "raster":
            if (expectedName != null) {
                return `Der Parameter "columnName" darf nicht gesetzt sein bei einer Quelle vom Typ Raster.`;
            }
            const foundBandMeta = workflowMetadata.bands[0];

            if (foundBandMeta.measurement.type !== "classification") {
                return `Das Band ${expectedName} muss in Klassen eingeteilt sein.`;
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
                return `Der Parameter "columnName" muss gesetzt sein bei einer Quelle vom Typ Vector.`;
            }
            const foundColumnMeta = workflowMetadata.columns[expectedName];

            if (!foundColumnMeta) {
                return `Die Quelle enthält keine Spalte mit dem Namen "${expectedName}".`;
            }
            if (!["float", "category", "int", "text", "bool", "dateTime"].includes(foundColumnMeta.dataType)) {
                //"text" works too because the backend parses strings internally and never throws
                return `Die Spalte ${expectedName} muss numerisch sein.`;
            }
            break;

        case "raster":
            if (expectedName != null) {
                return `Der Parameter "columnName" darf nicht gesetzt sein bei einer Quelle vom Typ Raster.`;
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
                return `Die Quelle "left" enthält keine Spalte mit dem Namen "${expectedLeftName}".`;
            }
            if (!(expectedRightName in rightWorkflowMetadata.columns)) {
                return `Die Quelle "right" enthält keine Spalte mit dem Namen "${expectedLeftName}".`;
            }

            if (leftWorkflowMetadata.dataType === "Data") {
                return `Die Quelle "left" muss Geodaten enthalten.`;
            }
            if (rightWorkflowMetadata.dataType !== "Data") {
                return `Die Quelle "right" darf keine Geodaten enthalten.`;
            }
            break;
    }
}
