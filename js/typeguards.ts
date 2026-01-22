import type {DatatypeDefinition} from "./schema/workflowSchema";

export function isDatatypeDefinition(arg: any): arg is DatatypeDefinition {
    return arg && typeof arg.oneOf === "object";
}

export function isPromise(arg: any): arg is Promise<any> {
    return typeof arg === "object" && typeof arg.then === "function";
}

export function isObject(arg: any): arg is object {
    return arg !== null && typeof arg === "object";
}

export function isSourceArray(arg: any): arg is { pinType: "array", innerType: string } {
    return typeof arg === "object" && "innerType" in arg;
}