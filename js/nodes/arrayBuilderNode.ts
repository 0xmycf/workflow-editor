import {LGraphNode} from "litegraph.js/build/litegraph.core";
import {joinDistinct} from "../util";
import {ARRAY_BUILDER_INPUT_NAME} from "../constants";

export default class ArrayBuilderNode extends LGraphNode {
    static title = "Array Builder";
    static desc = "Data flowing into this block is exported as a workflow."

    combinedTypes: string = "";

    constructor() {
        super(ArrayBuilderNode.title);
        this.addInput(ARRAY_BUILDER_INPUT_NAME, 0);
        this.addOutput("arr", "array");
    }

    onBeforeConnectInput(targetSlot: number): number {
        // try to connect empty input
        if (this.inputs[targetSlot].link === null) {
            return targetSlot;
        }
        // try to connect to any free input
        for (let i = 0; i < this.inputs.length; ++i) {
            if (this.inputs[i].link === null) {
                return i;
            }
        }
        // connect to newly created input
        this.addInput("item", 0);
        return this.inputs.length - 1;
    }

    onExecute() {
        let allTypes = [];
        let arr = [];

        for (let inputSlot = 0; inputSlot < this.inputs.length; inputSlot++) {
            const itemData = this.getInputData(inputSlot);

            if (itemData !== undefined) {
                allTypes.push(this.getInputDataType(inputSlot));
                arr.push(itemData);
            }
        }
        this.combinedTypes = joinDistinct(allTypes);
        this.setOutputData(0, arr);
    }
}