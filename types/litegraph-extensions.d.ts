/**
 * Type augmentations for LiteGraph to include custom properties
 * added by the workflow editor.
 */

import type {LGraph} from "litegraph.js/build/litegraph.core";
import type {Backend} from "../js/backend";
import type {ValidationSummary} from "../js/ui/validationSummary";

declare module "litegraph.js/build/litegraph.core" {
    interface LGraph {
        /**
         * Custom property: Backend instance for API calls
         */
        backend: Backend;
        
        /**
         * Custom property: Validation summary for error tracking
         */
        validationSummary: ValidationSummary;
        
        /**
         * Custom method: Export the workflow
         */
        doExport(): Promise<void>;
        
        /**
         * Custom flag: Indicates if export is currently in progress
         */
        isExportInProgress: boolean;
        
        /**
         * Custom async execution method added via bugfixes
         */
        runStepAsync(): Promise<void>;
    }
}
