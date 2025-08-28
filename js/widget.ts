import type {OperatorDefinition, Workflow} from "./schema/workflowSchema";
import "litegraph.js/css/litegraph";
import "./ui/widget.css";
import "bootstrap/dist/css/bootstrap.min.css";
import {LGraph, LiteGraph} from "litegraph.js/build/litegraph.core";
import {registerWorkflowOperator} from "./nodes/operatorNode";
import WorkflowOutNode from "./nodes/workflowOutNode";
import {
    ARRAY_BUILDER_NODE_TYPE,
    OPERATOR_CATEGORY,
    WORKFLOW_OUT_NODE_TYPE
} from "./constants";
import {isDatatypeDefinition} from "./typeguards";
import {getDefinitionName, simpleErrorHandler} from "./util";
import {Backend} from "./backend";
import {createUI} from "./ui/ui";
import OperatorDefinitionWrapper from "./schema/operatorDefinitionWrapper";
import ArrayBuilderNode from "./nodes/arrayBuilderNode";
import {importWorkflow} from "./ui/workflowImporter";

/* Specifies attributes defined with traitlets in ../src/workflow_editor/__init__.py */
export interface WidgetModel {
    serverUrl: string;
    token: string;
    workflow?: Workflow;
}

//region AnyWidget Types
type ObjectHash = Record<string, any>;
type ChangeEventHandler<Payload> = (_: unknown, value: Payload) => void;
type EventHandler = (...args: any[]) => void;

/**
 * Autocomplete works for literal string unions, but adding a union
 * of `string` negates autocomplete entirely. This is a workaround
 * to provide autocomplete but still allow any string.
 *
 * @see https://github.com/microsoft/TypeScript/issues/29729
 */
type LiteralUnion<T, U = string> = T | (U & {});

export interface AnyModel<T extends ObjectHash = ObjectHash> {
    get<K extends keyof T>(key: K): T[K];
    set<K extends keyof T>(key: K, value: T[K]): void;
    off<K extends keyof T>(
        eventName?: LiteralUnion<`change:${K & string}` | "msg:custom"> | null,
        callback?: EventHandler | null,
    ): void;
    on(
        eventName: "msg:custom",
        callback: (msg: any, buffers: DataView[]) => void,
    ): void;
    on<K extends `change:${keyof T & string}`>(
        eventName: K,
        callback: K extends `change:${infer Key}`
            ? ChangeEventHandler<T[Key]>
            : never,
    ): void;
    on<K extends `change:${string}`>(
        eventName: K,
        callback: ChangeEventHandler<any>,
    ): void;
    on(eventName: string, callback: EventHandler): void;
    save_changes(): void;
    send(
        content: any,
        callbacks?: any,
        buffers?: ArrayBuffer[] | ArrayBufferView[],
    ): void;
    widget_manager: any;
}

export interface RenderContext<T extends ObjectHash = ObjectHash> {
    model: AnyModel<T>;
    el: HTMLElement;
}
//endregion

function registerBackend(serverUrl: string, token: string, graph: LGraph) {
    const backend = new Backend(serverUrl, token);
    // @ts-ignore
    graph.backend = backend;
    return backend;
}

async function registerDefinitions(backend: Backend) {
    try {
        const schema = await backend.fetchOperatorDefinitions();

        let operators: { [operatorName: string]: OperatorDefinition } = {};
        let outputTypes: { [operatorName: string]: string } = {};

        for (const [key, definition] of Object.entries(schema.definitions)) {
            if (isDatatypeDefinition(definition)) {
                for (const ref of definition.oneOf) {
                    outputTypes[getDefinitionName(ref)] = key;
                }
            } else {
                operators[key] = definition;
            }
        }
        for (const [key, operator] of Object.entries(operators)) {
            registerWorkflowOperator(new OperatorDefinitionWrapper(operator, outputTypes[key]));
        }
    } catch (err) {
        simpleErrorHandler("register operators", err);
    }
}

async function setupGraph(graph: LGraph, serverUrl: string, token: string, workflow?: Workflow) {
    // @ts-ignore
    const registeredOperators = LiteGraph.getNodeTypesInCategory(OPERATOR_CATEGORY);

    for (const registeredOperator of registeredOperators) {
        const nodesWithType = graph.findNodesByClass(registeredOperator);

        for (const nodeWithType of nodesWithType) {
            graph.remove(nodeWithType);
        }
        // @ts-ignore
        LiteGraph.unregisterNodeType(registeredOperator);
    }

    LiteGraph.registerNodeType(WORKFLOW_OUT_NODE_TYPE, WorkflowOutNode);
    LiteGraph.registerNodeType(ARRAY_BUILDER_NODE_TYPE, ArrayBuilderNode);

    const backend = registerBackend(serverUrl, token, graph);
    await registerDefinitions(backend);
    await importWorkflow(graph, workflow);
}

export function render({model, el}: RenderContext<WidgetModel>) {
    const graph = createUI(model, el);

    const initialServerUrl = model.get("serverUrl");
    const initialToken = model.get("token");

    if (initialServerUrl && initialToken) {
        const initialWorkflow = model.get("workflow");
        void setupGraph(graph, initialServerUrl, initialToken, initialWorkflow);
    }

    model.on("change:serverUrl", () => {
        void setupGraph(
            graph,
            model.get("serverUrl"),
            model.get("token"),
            model.get("workflow")
        );
    });
    model.on("change:token", () => {
        registerBackend(
            model.get("serverUrl"),
            model.get("token"),
            graph
        );
    })
    model.on("change:workflow", () => {
        if (graph.isExportInProgress) return;
        void importWorkflow(graph, model.get("workflow"));
    })
}
