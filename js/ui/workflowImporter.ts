import {LGraph, LGraphGroup, LGraphNode, LiteGraph} from "litegraph.js/build/litegraph.core";
import type {Workflow, WorkflowOperator} from "../schema/workflowSchema";
import {graphlib, layout} from "@dagrejs/dagre";
import {
    ARRAY_BUILDER_INPUT_NAME,
    ARRAY_BUILDER_NODE_TYPE,
    OPERATOR_CATEGORY,
    WORKFLOW_OUT_INPUT_NAME,
    WORKFLOW_OUT_NODE_TYPE
} from "../constants";
import {OperatorNodeInfo} from "../nodes/operatorNode";
import {simpleErrorHandler} from "../util";
import {clearGraph} from "./ui";

export async function importWorkflow(litegraph: LGraph, workflow: Workflow | undefined, templateName?: string) {
    console.log("Importing workflow:", workflow);
    if (!templateName) {
        clearGraph(litegraph);
    }
    if (!workflow) {
        await litegraph.doExport(); // show initial WorkflowOut validation
        return;
    }
    try {
        litegraph.isExportInProgress = true; // block validation on every params set

        const g = new graphlib.Graph();
        g.setGraph({
            rankdir: "LR"
        });
        g.setDefaultEdgeLabel(function () {
            return {};
        });
        let outNode: LGraphNode | undefined;

        if (!templateName) {
            outNode = litegraph.findNodesByType(WORKFLOW_OUT_NODE_TYPE)[0];
            g.setNode(String(outNode.id), {
                width: outNode.size[0],
                height: outNode.size[1] + LiteGraph.NODE_TITLE_HEIGHT
            });
        }
        addOperator(litegraph, g, workflow.operator, outNode, WORKFLOW_OUT_INPUT_NAME);

        layout(g);
        applyPositions(litegraph, g);

        if (templateName) {
            createGroup(litegraph, g, templateName);
        }
    } catch (err) {
        simpleErrorHandler("import workflow", err);
    } finally {
        litegraph.updateExecutionOrder();
        litegraph.isExportInProgress = false;
        await litegraph.doExport();
    }
}

function addNode(litegraph: LGraph, g: graphlib.Graph, fullType: string, params?: Record<string, any>): LGraphNode {
    const newNode = LiteGraph.createNode(fullType);
    if (!newNode) throw new Error("Node '" + fullType + "' was not registered in the editor");
    litegraph.add(newNode, true);
    if (params) (newNode as unknown as OperatorNodeInfo).paramValues = params!;
    g.setNode(String(newNode.id), {
        width: newNode.size[0],
        height: newNode.size[1] + LiteGraph.NODE_TITLE_HEIGHT
    });
    return newNode;
}

function addOperator(litegraph: LGraph, g: graphlib.Graph, operator: WorkflowOperator, parentNode: LGraphNode | undefined, sourceName: string) {
    //create node
    const newNode = addNode(litegraph, g, OPERATOR_CATEGORY + "/" + operator.type, operator.params);
    //connect output to parent
    if (parentNode) {
        newNode.connect(0, parentNode, sourceName);
        g.setEdge(String(newNode.id), String(parentNode.id));
    }
    // create and connect sources
    if (!operator.sources) return;

    // do not loop over Object.entries(operator.sources) so that links do not cross
    for (let x = 0; x < newNode.inputs.length; x++) {
        const sourceName = newNode.inputs[x].name;
        const sourceDef = operator.sources[sourceName];
        if (!sourceDef) continue; // assume that source is not required

        if (!Array.isArray(sourceDef)) {
            // add simple source
            addOperator(litegraph, g, sourceDef, newNode, sourceName);
        } else {
            // add array of sources
            const arrayBuilder = addNode(litegraph, g, ARRAY_BUILDER_NODE_TYPE);
            arrayBuilder.connect(0, newNode, sourceName);
            g.setEdge(String(arrayBuilder.id), String(newNode.id));

            for (const item of sourceDef) {
                addOperator(litegraph, g, item, arrayBuilder, ARRAY_BUILDER_INPUT_NAME);
            }
            if (sourceDef.length > 1) {
                // reset size because new inputs were added
                g.setNode(String(arrayBuilder.id), {
                    width: arrayBuilder.size[0],
                    height: arrayBuilder.size[1] + LiteGraph.NODE_TITLE_HEIGHT
                });
            }
        }
    }
}

function applyPositions(litegraph: LGraph, g: graphlib.Graph) {
    for (const nodeId of g.nodes()) {
        const nodeLabel = g.node(nodeId);
        const node = litegraph.getNodeById(parseInt(nodeId))!;
        node.pos[0] = nodeLabel.x;
        node.pos[1] = nodeLabel.y;
    }
}

function createGroup(litegraph: LGraph, g: graphlib.Graph, templateName: string) {
    // @ts-ignore
    const group = new LGraphGroup(templateName);
    litegraph.add(group, true);
    group.size = [
        g.graph().width! + 100,
        g.graph().height! + 2 * LiteGraph.NODE_TITLE_HEIGHT
    ];
    group.recomputeInsideNodes();
}
