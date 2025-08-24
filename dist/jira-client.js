"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jiraClient = void 0;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class JiraClient {
    constructor() {
        const jiraPat = process.env.JIRA_PAT;
        if (!jiraPat) {
            throw new Error('JIRA_PAT environment variable is required');
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
    }
    async getIssue(issueKey) {
        try {
            const response = await this.client.get(`/issue/${issueKey}`);
            return response.data;
        }
        catch (error) {
            if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error;
                if (axiosError.response?.status === 404) {
                    throw new Error(`Issue '${issueKey}' not found`);
                }
                if (axiosError.response?.status === 401) {
                    throw new Error('Unauthorized - check JIRA_PAT token');
                }
                throw new Error(`Jira API error: ${axiosError.response?.data?.errorMessages?.join(', ') || axiosError.message}`);
            }
            throw new Error(`Failed to fetch issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async updateIssue(issueKey, updateData) {
        try {
            await this.client.put(`/issue/${issueKey}`, updateData);
        }
        catch (error) {
            if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error;
                if (axiosError.response?.status === 404) {
                    throw new Error(`Issue '${issueKey}' not found`);
                }
                if (axiosError.response?.status === 401) {
                    throw new Error('Unauthorized - check JIRA_PAT token');
                }
                if (axiosError.response?.status === 400) {
                    throw new Error(`Invalid update data: ${axiosError.response?.data?.errorMessages?.join(', ') || 'Bad request'}`);
                }
                throw new Error(`Jira API error: ${axiosError.response?.data?.errorMessages?.join(', ') || axiosError.message}`);
            }
            throw new Error(`Failed to update issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async createIssue(issueData) {
        try {
            console.log('Creating issue with data:', JSON.stringify(issueData, null, 2));
            const response = await this.client.post('/issue', issueData);
            return response.data;
        }
        catch (error) {
            if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error;
                console.error('Jira API error response:', axiosError.response?.data);
                if (axiosError.response?.status === 401) {
                    throw new Error('Unauthorized - check JIRA_PAT token');
                }
                if (axiosError.response?.status === 400) {
                    const errorDetails = axiosError.response?.data?.errors || axiosError.response?.data?.errorMessages || ['Bad request'];
                    throw new Error(`Invalid issue data: ${JSON.stringify(errorDetails)}`);
                }
                throw new Error(`Jira API error (${axiosError.response?.status}): ${JSON.stringify(axiosError.response?.data)}`);
            }
            throw new Error(`Failed to create issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
exports.jiraClient = new JiraClient();
