import {fetchAndParse} from "./util";
import {Workflow, WorkflowSchema} from "./schema/workflowSchema";
import {
    CreateProjectInput,
    GetDatasetResponse,
    IdResponse,
    ListProjectsResponse,
    LoadProjectResponse,
    NoContentResponse,
    ResultType,
    TypedResultDescriptor,
    UpdateProjectInput
} from "./schema/backendSchema";

let cachedWorkflowSchema: WorkflowSchema | null = null;

export class Backend {
    private readonly serverUrl: string;
    private readonly token: string;

    constructor(serverUrl: string, token: string) {
        this.serverUrl = serverUrl;
        this.token = token;
    }

    async fetchOperatorDefinitions(): Promise<WorkflowSchema> {
        if (cachedWorkflowSchema) return cachedWorkflowSchema;
        return cachedWorkflowSchema = await fetchAndParse(this.serverUrl + "/workflow/schema", undefined, WorkflowSchema);
    }

    async getDatasetType(datasetName: string): Promise<ResultType> {
        const json = await fetchAndParse(this.serverUrl + "/dataset/" + encodeURIComponent(datasetName), {
            headers: {
                Authorization: "Bearer " + this.token
            }
        }, GetDatasetResponse);
        return json.resultDescriptor.type;
    }

    async registerWorkflow(workflow: Workflow): Promise<string> {
        const json = await fetchAndParse(this.serverUrl + "/workflow", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + this.token
            },
            body: JSON.stringify(workflow)
        }, IdResponse);
        return json.id;
    }

    async getWorkflowMetadata(workflowOrId: Workflow | string): Promise<TypedResultDescriptor> {
        // TODO add POST /workflow/validate backend API
        const workflowId = typeof workflowOrId === "string"
            ? workflowOrId
            : await this.registerWorkflow(workflowOrId);

        return await fetchAndParse(this.serverUrl + "/workflow/" + workflowId + "/metadata", {
            headers: {
                Authorization: "Bearer " + this.token
            }
        }, TypedResultDescriptor);
    }

    listProjects(): Promise<ListProjectsResponse> {
        return fetchAndParse(this.serverUrl + "/projects?order=NameAsc&offset=0&limit=10", {
            headers: {
                Authorization: "Bearer " + this.token
            }
        }, ListProjectsResponse);
    }

    loadProjectById(projectId: string): Promise<LoadProjectResponse> {
        return fetchAndParse(this.serverUrl + "/project/" + encodeURIComponent(projectId), {
            headers: {
                Authorization: "Bearer " + this.token
            }
        }, LoadProjectResponse);
    }

    async findProjectByName(projectName: string): Promise<string | undefined> {
        // TODO what if project is not in list but exists?
        const foundProjects = await this.listProjects();
        return foundProjects.find(project => project.name === projectName)?.id;
    }

    loadWorkflow(workflowId: string): Promise<Workflow> {
        return fetchAndParse(this.serverUrl + "/workflow/" + encodeURIComponent(workflowId), {
            headers: {
                Authorization: "Bearer " + this.token
            }
        }, Workflow);
    }

    async createProject(create: CreateProjectInput): Promise<string> {
        const json = await fetchAndParse(this.serverUrl + "/project", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + this.token
            },
            body: JSON.stringify(create)
        }, IdResponse);
        return json.id;
    }

    updateProject(update: UpdateProjectInput): Promise<void> {
        return fetchAndParse(this.serverUrl + "/project/" + encodeURIComponent(update.id), {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + this.token
            },
            body: JSON.stringify(update)
        }, NoContentResponse);
    }
}