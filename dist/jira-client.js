"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jiraClient = exports.JiraClientError = void 0;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class JiraClientError extends Error {
    constructor(message, status, code, details) {
        super(message);
        this.name = "JiraClientError";
        this.status = status;
        this.code = code;
        this.details = details;
        Object.setPrototypeOf(this, JiraClientError.prototype);
    }
}
exports.JiraClientError = JiraClientError;
class JiraClient {
    constructor() {
        const jiraPat = process.env.JIRA_PAT;
        if (!jiraPat) {
            throw new JiraClientError('JIRA_PAT environment variable is required. Please set your Jira Personal Access Token.', undefined, 'MISSING_CREDENTIALS', 'Set the JIRA_PAT environment variable with your Jira Personal Access Token');
        }
        this.baseUrl = 'https://jira.sso.episerver.net';
        this.client = axios_1.default.create({
            baseURL: `${this.baseUrl}/rest/api/2`,
            headers: {
                'Authorization': `Bearer ${jiraPat}`,
                'Content-Type': 'application/json',
            },
            timeout: 10000,
        });
        // Add response interceptor for error handling
        this.client.interceptors.response.use((response) => response, (error) => {
            return Promise.reject(this.handleApiError(error));
        });
    }
    handleApiError(error) {
        if (error.response) {
            const { status, data } = error.response;
            const errorMessages = data?.errorMessages || [];
            const errors = data?.errors || {};
            let message = 'Jira API Error';
            let code = `HTTP_${status}`;
            let details = data;
            if (status === 401) {
                message = 'Authentication failed. Please check your JIRA_PAT token has valid permissions.';
                code = 'AUTHENTICATION_ERROR';
            }
            else if (status === 403) {
                message = 'Access forbidden. Your Jira account may not have the required permissions for this operation.';
                code = 'AUTHORIZATION_ERROR';
            }
            else if (status === 404) {
                message = 'Resource not found. The issue key, project, or endpoint may not exist.';
                code = 'NOT_FOUND_ERROR';
            }
            else if (status === 400) {
                const errorDetails = Object.keys(errors).length > 0
                    ? Object.entries(errors).map(([field, msg]) => `${field}: ${msg}`).join(', ')
                    : errorMessages.join(', ');
                message = `Invalid request data. ${errorDetails || 'Please check your input parameters.'}`;
                code = 'VALIDATION_ERROR';
            }
            else if (errorMessages.length > 0) {
                message = `Jira API Error: ${errorMessages.join(', ')}`;
            }
            return new JiraClientError(message, status, code, details);
        }
        else if (error.request) {
            return new JiraClientError('Network error: Unable to reach Jira API. Please check your connection and that jira.sso.episerver.net is accessible.', undefined, 'NETWORK_ERROR', error.message);
        }
        else {
            return new JiraClientError(`Request error: ${error.message}`, undefined, 'REQUEST_ERROR', error.message);
        }
    }
    async getIssue(issueKey) {
        if (!issueKey || typeof issueKey !== 'string') {
            throw new JiraClientError('Issue key is required and must be a valid string (e.g., "PROJ-123")', undefined, 'VALIDATION_ERROR', 'Provide a valid Jira issue key in the format PROJECT-NUMBER');
        }
        const response = await this.client.get(`/issue/${issueKey}`);
        return response.data;
    }
    async updateIssue(issueKey, updateData) {
        if (!issueKey || typeof issueKey !== 'string') {
            throw new JiraClientError('Issue key is required and must be a valid string (e.g., "PROJ-123")', undefined, 'VALIDATION_ERROR', 'Provide a valid Jira issue key in the format PROJECT-NUMBER');
        }
        if (!updateData || typeof updateData !== 'object' || !updateData.fields) {
            throw new JiraClientError('Update data is required and must contain a "fields" object with the fields to update', undefined, 'VALIDATION_ERROR', 'Provide update data in format: { fields: { summary: "New title", description: "New description" } }');
        }
        await this.client.put(`/issue/${issueKey}`, updateData);
    }
    async createIssue(issueData) {
        if (!issueData || typeof issueData !== 'object' || !issueData.fields) {
            throw new JiraClientError('Issue data is required and must contain a "fields" object with project, summary, and issuetype', undefined, 'VALIDATION_ERROR', 'Provide issue data in format: { fields: { project: { key: "PROJ" }, summary: "Issue title", issuetype: { name: "Task" } } }');
        }
        const { fields } = issueData;
        if (!fields.project?.key) {
            throw new JiraClientError('Project key is required in the format: { project: { key: "PROJECT_KEY" } }', undefined, 'VALIDATION_ERROR', 'Specify the project where the issue should be created, e.g., { project: { key: "MYPROJ" } }');
        }
        if (!fields.summary) {
            throw new JiraClientError('Issue summary (title) is required', undefined, 'VALIDATION_ERROR', 'Provide a descriptive summary for the issue');
        }
        if (!fields.issuetype?.name) {
            throw new JiraClientError('Issue type is required in the format: { issuetype: { name: "Issue Type" } }', undefined, 'VALIDATION_ERROR', 'Specify the issue type, e.g., { issuetype: { name: "Task" } } or { issuetype: { name: "Bug" } }');
        }
        const response = await this.client.post('/issue', issueData);
        return response.data;
    }
}
exports.jiraClient = new JiraClient();
