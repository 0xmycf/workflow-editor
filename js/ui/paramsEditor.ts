import {Offcanvas} from "bootstrap";
import {OperatorDefinitionParams} from "../schema/workflowSchema";
import {PARAMS_EDITOR_ID} from "../constants";
// @ts-ignore
import {JSONEditor} from "@json-editor/json-editor/dist/jsoneditor";
import {OperatorNodeInfo} from "../nodes/operatorNode";

type ParamsEditorDiv = HTMLElement & {
    instance?: ParamsEditor;
}

export default class ParamsEditor {
    private static instance: ParamsEditor;

    private offcanvasBs: Offcanvas;
    private editor?: JSONEditor;
    private readonly holderDiv: HTMLElement;
    private titleContainer: HTMLElement;
    private helpLink: HTMLElement;
    private currentNode?: OperatorNodeInfo;
    private oldSchema?: OperatorDefinitionParams;

    private constructor() {
        let offcanvasDiv: ParamsEditorDiv = document.createElement("div");
        offcanvasDiv.instance = this;

        offcanvasDiv.id = PARAMS_EDITOR_ID;
        offcanvasDiv.classList.add("offcanvas", "offcanvas-end");
        offcanvasDiv.tabIndex = -1;
        offcanvasDiv.innerHTML = `
<div class="offcanvas-header">
    <h5 class="offcanvas-title">Params Editor</h5>
    <button type="button" class="btn-close text-reset" data-bs-dismiss="offcanvas" aria-label="Close"></button>
</div>
<div class="offcanvas-body">
    <p>
        <a href="https://docs.geoengine.io" target="_blank">
            Open operator help
        </a>
    </p>
    <p class="editor-holder"></p>
    <button type="button" class="editor-save btn btn-primary mt-3">
        Save changes
    </button>
</div>`;
        document.body.appendChild(offcanvasDiv);

        const saveButton = offcanvasDiv.querySelector(`.editor-save`)!;
        saveButton.addEventListener("click", function () {
            ParamsEditor.Instance.handleSave();
        });
        this.offcanvasBs = Offcanvas.getOrCreateInstance(offcanvasDiv);
        this.holderDiv = offcanvasDiv.querySelector(".editor-holder")!;
        this.titleContainer = offcanvasDiv.querySelector(".offcanvas-title")!;
        this.helpLink = offcanvasDiv.querySelector('a[target="_blank"]')!;

        this.holderDiv.addEventListener("keypress", function (event) {
            if (event.keyCode === 13 || event.which === 13) {
                // enter pressed in modal
                if (document.activeElement?.nodeName === "INPUT" && document.activeElement.getAttribute("type") === "text") {
                    // manually trigger change event on text inputs to update in model
                    document.activeElement.dispatchEvent(new Event("change"));
                    console.log("updated input on enter");
                }
                ParamsEditor.Instance.handleSave();
            }
        });
    }

    public static get Instance() {
        if (this.instance) {
            console.log("ParamsEditor already in static context");
            return this.instance;
        }
        let modalDiv: ParamsEditorDiv | null = document.getElementById(PARAMS_EDITOR_ID);

        if (modalDiv) {
            console.log("Found ParamsEditor in body");
            return this.instance = modalDiv.instance!;
        }
        console.log("Rendering new ParamsEditor");
        return this.instance = new this();
    }

    private handleSave() {
        if (!this.currentNode) {
            console.log("ERROR: Editor detached from node on save.");
            return;
        }
        if (!this.editor) {
            console.log("ERROR: No JSONEditor registered on save.");
            return;
        }
        const isValid = this.editor.validate().length === 0;

        if (isValid) {
            console.log("saving", this.editor.getValue());
            this.currentNode.paramValues = this.editor.getValue();
            this.offcanvasBs.hide();
        } else {
            // TODO communicate errors in popup or other?
            //this.currentNode.paramValues = undefined;
        }
    }

    show(currentNode: OperatorNodeInfo, schema: OperatorDefinitionParams) {
        console.log("Schema:", schema);
        this.currentNode = currentNode;

        this.titleContainer.innerText = currentNode.title;
        this.helpLink.setAttribute("href", currentNode.help_url);

        if (this.editor && this.oldSchema !== schema) {
            console.log("destroy editor with old schema");
            this.editor.destroy();
        }
        if (!this.editor || this.oldSchema !== schema) {
            console.log("create new editor");
            this.editor = new JSONEditor(this.holderDiv, {
                theme: "bootstrap5",
                iconlib: "fontawesome5",
                disable_array_delete_last_row: true,
                disable_edit_json: true,
                //use_default_values: false,
                keep_oneof_values: false,
                startval: currentNode.paramValues,
                schema
            });
            this.oldSchema = schema;
        } else if (this.editor.getValue() === currentNode.paramValues) {
            console.log("value in existing editor did not change");
        } else {
            console.log("update value in existing editor");
            this.editor.setValue(currentNode.paramValues);
        }
        this.offcanvasBs.show();
    }
}