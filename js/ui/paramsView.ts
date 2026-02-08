import {IWidget, LGraphNode, LiteGraph} from "litegraph.js/build/litegraph.core";
import YAML, {isScalar} from "yaml";
import {clippedString, isEmpty} from "../util";
import {ELLIPSIS} from "../constants";

export default class ParamsView implements IWidget<object> {
    private static readonly FONT_SIZE = 10;
    private static readonly FONT = ParamsView.FONT_SIZE + "px Arial";
    private static readonly MARGIN = 15;
    private static readonly LINE_HEIGHT = LiteGraph.NODE_WIDGET_HEIGHT * 0.7;
    private static readonly MAX_ITEM_COUNT = 4;
    private static readonly SHORT_STRING_LENGTH = 7;

    name: string | null = ParamsView.name;

    private lines: string[] = [];

    set value(newValue: object) {
        const doc = new YAML.Document(newValue);
        YAML.visit(doc, {
            Seq(_, seq) {
                if (seq.items.every(item => {
                    if (!isScalar(item)) {
                        return false;
                    }
                    switch (typeof item.value) {
                        case "number":
                        case "boolean":
                            return true;

                        case "string":
                            return item.value.length <= ParamsView.SHORT_STRING_LENGTH;

                        default:
                            return false;
                    }
                })) {
                    seq.flow = true;
                }
                if (!seq.flow && seq.items.length > ParamsView.MAX_ITEM_COUNT) {
                    seq.comment = ELLIPSIS;
                    seq.items.length = ParamsView.MAX_ITEM_COUNT;
                }
            },
            Map(_, map) {
                if (map.items.length > ParamsView.MAX_ITEM_COUNT + 1) {
                    map.comment = ELLIPSIS;
                    map.items.length = ParamsView.MAX_ITEM_COUNT;
                }
            }
        });
        this.lines = doc.toString().split("\n");
    }

    draw(ctx: CanvasRenderingContext2D, _node: LGraphNode, width: number, posY: number, _height: number) {
        if (isEmpty(this.lines)) {
            return;
        }
        ctx.font = ParamsView.FONT;
        ctx.textAlign = "left";
        // LiteGraph color constant not exposed in type definitions
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - WIDGET_SECONDARY_TEXT_COLOR is internal to LiteGraph
        ctx.fillStyle = LiteGraph.WIDGET_SECONDARY_TEXT_COLOR;

        const maxLineWidth = width - 2 * ParamsView.MARGIN;

        for (let i = 0; i < this.lines.length; i++) {
            const line = this.lines[i];
            ctx.fillText(clippedString(line, maxLineWidth, ctx), ParamsView.MARGIN, posY + (i + 1) * ParamsView.LINE_HEIGHT);
        }
    }

    computeSize(width: number): [number, number] {
        return [
            width,
            Math.max(0, (this.lines.length - 1) * ParamsView.LINE_HEIGHT)
        ];
    }
}