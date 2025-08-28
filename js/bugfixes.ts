// @ts-nocheck
// noinspection PointlessBooleanExpressionJS,JSDuplicatedDeclaration

import {LGraph, LGraphCanvas, LiteGraph} from "litegraph.js/build/litegraph.core";
import {isPromise} from "./typeguards";

/**
 * If the user tries creating a node by dropping a link on the empty grid
 * it would crash in the past because the variable "nodeNewType" is not
 * declared.
 */
function fixCreateDefaultNodeForSlotFailsInStrictMode() {
    LGraphCanvas.prototype.createDefaultNodeForSlot = function (optPassP) { // addNodeMenu for connection
        const optPass = optPassP ?? {};
        const opts = Object.assign({
                nodeFrom: null // input
                , slotFrom: null // input
                , nodeTo: null   // output
                , slotTo: null   // output
                , position: []	// pass the event coords
                , nodeType: null	// choose a nodetype to add, AUTO to set at first good
                , posAdd: [0, 0]	// adjust x,y
                , posSizeFix: [0, 0] // alpha, adjust the position x,y based on the new node size w,h
            }
            , optPass
        );
        const that = this;

        const isFrom = opts.nodeFrom && opts.slotFrom !== null;
        const isTo = !isFrom && opts.nodeTo && opts.slotTo !== null;

        if (!isFrom && !isTo) {
            console.warn("No data passed to createDefaultNodeForSlot " + opts.nodeFrom + " " + opts.slotFrom + " " + opts.nodeTo + " " + opts.slotTo);
            return false;
        }
        if (!opts.nodeType) {
            console.warn("No type to createDefaultNodeForSlot");
            return false;
        }

        const nodeX = isFrom ? opts.nodeFrom : opts.nodeTo;
        let slotX = isFrom ? opts.slotFrom : opts.slotTo;

        let iSlotConn = false;
        switch (typeof slotX) {
            case "string":
                iSlotConn = isFrom ? nodeX.findOutputSlot(slotX, false) : nodeX.findInputSlot(slotX, false);
                slotX = isFrom ? nodeX.outputs[slotX] : nodeX.inputs[slotX];
                break;
            case "object":
                // ok slotX
                iSlotConn = isFrom ? nodeX.findOutputSlot(slotX.name) : nodeX.findInputSlot(slotX.name);
                break;
            case "number":
                iSlotConn = slotX;
                slotX = isFrom ? nodeX.outputs[slotX] : nodeX.inputs[slotX];
                break;
            case "undefined":
            default:
                // bad ?
                //iSlotConn = 0;
                console.warn("Cant get slot information " + slotX);
                return false;
        }

        if (slotX === false || iSlotConn === false) {
            console.warn("createDefaultNodeForSlot bad slotX " + slotX + " " + iSlotConn);
        }

        // check for defaults nodes for this slottype
        const fromSlotType = slotX.type == LiteGraph.EVENT ? "_event_" : slotX.type;
        const slotTypesDefault = isFrom ? LiteGraph.slot_types_default_out : LiteGraph.slot_types_default_in;
        if (slotTypesDefault && slotTypesDefault[fromSlotType]) {
            if (slotX.link !== null) {
                // is connected
            } else {
                // is not connected
            }
            let nodeNewType = false;
            if (typeof slotTypesDefault[fromSlotType] == "object") {
                for (const typeX in slotTypesDefault[fromSlotType]) {
                    if (opts.nodeType == slotTypesDefault[fromSlotType][typeX] || opts.nodeType == "AUTO") {
                        nodeNewType = slotTypesDefault[fromSlotType][typeX];
                        // console.log("opts.nodeType == slotTypesDefault[fromSlotType][typeX] :: "+opts.nodeType);
                        break; // --------
                    }
                }
            } else {
                if (opts.nodeType == slotTypesDefault[fromSlotType] || opts.nodeType == "AUTO") nodeNewType = slotTypesDefault[fromSlotType];
            }
            if (nodeNewType) {
                let nodeNewOpts = false;
                if (typeof nodeNewType == "object" && nodeNewType.node) {
                    nodeNewOpts = nodeNewType;
                    nodeNewType = nodeNewType.node;
                }

                //that.graph.beforeChange();

                const newNode = LiteGraph.createNode(nodeNewType);
                if (newNode) {
                    // if is object pass options
                    if (nodeNewOpts) {
                        if (nodeNewOpts.properties) {
                            for (const i in nodeNewOpts.properties) {
                                newNode.addProperty(i, nodeNewOpts.properties[i]);
                            }
                        }
                        if (nodeNewOpts.inputs) {
                            newNode.inputs = [];
                            for (const i in nodeNewOpts.inputs) {
                                newNode.addOutput(
                                    nodeNewOpts.inputs[i][0],
                                    nodeNewOpts.inputs[i][1]
                                );
                            }
                        }
                        if (nodeNewOpts.outputs) {
                            newNode.outputs = [];
                            for (const i in nodeNewOpts.outputs) {
                                newNode.addOutput(
                                    nodeNewOpts.outputs[i][0],
                                    nodeNewOpts.outputs[i][1]
                                );
                            }
                        }
                        if (nodeNewOpts.title) {
                            newNode.title = nodeNewOpts.title;
                        }
                        if (nodeNewOpts.json) {
                            newNode.configure(nodeNewOpts.json);
                        }

                    }

                    // add the node
                    that.graph.add(newNode);
                    newNode.pos = [opts.position[0] + opts.posAdd[0] + (opts.posSizeFix[0] ? opts.posSizeFix[0] * newNode.size[0] : 0)
                        , opts.position[1] + opts.posAdd[1] + (opts.posSizeFix[1] ? opts.posSizeFix[1] * newNode.size[1] : 0)]; //that.last_click_position; //[e.canvasX+30, e.canvasX+5];*/

                    //that.graph.afterChange();

                    // connect the two!
                    if (isFrom) {
                        opts.nodeFrom.connectByType(iSlotConn, newNode, fromSlotType);
                    } else {
                        opts.nodeTo.connectByTypeOutput(iSlotConn, newNode, fromSlotType);
                    }

                    // if connecting in between
                    if (isFrom && isTo) {
                        // TODO
                    }

                    return true;

                } else {
                    console.log("failed creating " + nodeNewType);
                }
            }
        }
        return false;
    };
}

/**
 * Several LiteGraph nodes try to use a global clamp function but the library
 * incorrectly defines it, so it cannot be called by the nodes by default.
 */
function fixMissingClamp() {
    globalThis.clamp = function (v, a, b) {
        return a > v ? a : b < v ? b : v;
    };
}

/**
 * LiteGraph normally can run only synchronous operators.
 * This adds support for promise based operators.
 */
function addRunStepAsync() {
    LGraph.prototype.runStepAsync = async function () {
        const start = LiteGraph.getTime();
        this.globaltime = 0.001 * (start - this.starttime);

        //not optimal: executes possible pending actions in node, problem is it is not optimized
        //it is done here as if it was done in the later loop it won't be called in the node missed the onExecute

        try {
            //iterations
            const nodes = this.computeExecutionOrder(false, true);
            const limit = nodes.length;
            const columns = [];

            for (let i = 0; i < limit; ++i) {
                const node = nodes[i];
                const col = node._level || 1;
                if (!columns[col]) {
                    columns[col] = [];
                }
                columns[col].push(node);
            }
            const promises: Promise<void>[] = [];

            for (let i = 1; i < columns.length; ++i) {
                promises.length = 0;

                for (const node of columns[i]) {
                    if (LiteGraph.use_deferred_actions && node._waiting_actions && node._waiting_actions.length)
                        node.executePendingActions();
                    if (node.mode == LiteGraph.ALWAYS && node.onExecute) {
                        const res = node.onExecute() as void | Promise<void>;

                        if (isPromise(res)) {
                            promises.push(res);
                        }
                    }
                }
                await Promise.all(promises);
            }

            this.fixedtime += this.fixedtime_lapse;
            if (this.onExecuteStep) {
                this.onExecuteStep();
            }

            if (this.onAfterExecute) {
                this.onAfterExecute();
            }
            this.errors_in_execution = false;
        } catch (err) {
            this.errors_in_execution = true;
            if (LiteGraph.throw_errors) {
                throw err;
            }
            if (LiteGraph.debug) {
                console.log("Error during execution: " + err);
            }
            this.stop();
        }

        const now = LiteGraph.getTime();
        let elapsed = now - start;
        if (elapsed == 0) {
            elapsed = 1;
        }
        this.execution_time = 0.001 * elapsed;
        this.globaltime += 0.001 * elapsed;
        this.iteration += 1;
        this.elapsed_time = (now - this.last_update_time) * 0.001;
        this.last_update_time = now;
        this.nodes_executing = [];
        this.nodes_actioning = [];
        this.nodes_executedAction = [];
    };
}

/**
 * Non V8 based environments like Firefox do not have Error.captureStackTrace
 * natively, but it is used by the json validator. This method adds polyfills.
 */
function fixCaptureStackTrace() {
    require("error-polyfill");
}

/**
 * Automatically applies fixes to external components like LiteGraph.
 */
export default function applyAllBugfixes() {
    fixCreateDefaultNodeForSlotFailsInStrictMode();
    fixMissingClamp();
    addRunStepAsync();
    fixCaptureStackTrace();
}