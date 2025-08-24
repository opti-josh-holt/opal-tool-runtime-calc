"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.confluenceClient = void 0;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class ConfluenceClient {
    constructor() {
        const confluencePat = process.env.CONFLUENCE_PAT;
        if (!confluencePat) {
            throw new Error('CONFLUENCE_PAT environment variable is required');
        }
        this.baseUrl = 'https://confluence.sso.episerver.net';
        this.client = axios_1.default.create({
            baseURL: `${this.baseUrl}/rest/api`,
            headers: {
                'Authorization': `Bearer ${confluencePat}`,
                'Content-Type': 'application/json',
            },
            timeout: 10000,
        });
    }
    async getPageById(pageId) {
        try {
            const response = await this.client.get(`/content/${pageId}`, {
                params: {
                    expand: 'body.storage,version,space'
                }
            });
            return response.data;
        }
        catch (error) {
            if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error;
                if (axiosError.response?.status === 404) {
                    throw new Error(`Page with ID '${pageId}' not found`);
                }
                if (axiosError.response?.status === 401) {
                    throw new Error('Unauthorized - check CONFLUENCE_PAT token');
                }
                throw new Error(`Confluence API error: ${axiosError.response?.data?.message || axiosError.message}`);
            }
            throw new Error(`Failed to fetch page: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getPageByTitle(spaceKey, title) {
        try {
            const response = await this.client.get('/content', {
                params: {
                    spaceKey,
                    title,
                    expand: 'body.storage,version,space',
                    limit: 1
                }
            });
            if (!response.data.results || response.data.results.length === 0) {
                throw new Error(`Page with title '${title}' not found in space '${spaceKey}'`);
            }
            return response.data.results[0];
        }
        catch (error) {
            if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error;
                if (axiosError.response?.status === 401) {
                    throw new Error('Unauthorized - check CONFLUENCE_PAT token');
                }
                throw new Error(`Confluence API error: ${axiosError.response?.data?.message || axiosError.message}`);
            }
            throw new Error(`Failed to search for page: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async updatePage(pageId, updateData) {
        try {
            const response = await this.client.put(`/content/${pageId}`, updateData);
            return response.data;
        }
        catch (error) {
            if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error;
                if (axiosError.response?.status === 404) {
                    throw new Error(`Page with ID '${pageId}' not found`);
                }
                if (axiosError.response?.status === 401) {
                    throw new Error('Unauthorized - check CONFLUENCE_PAT token');
                }
                if (axiosError.response?.status === 400) {
                    throw new Error(`Invalid update data: ${axiosError.response?.data?.message || 'Bad request'}`);
                }
                if (axiosError.response?.status === 409) {
                    throw new Error('Version conflict - page was modified by another user. Please refresh and try again.');
                }
                throw new Error(`Confluence API error: ${axiosError.response?.data?.message || axiosError.message}`);
            }
            throw new Error(`Failed to update page: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async createPage(pageData) {
        try {
            console.log('Creating page with data:', JSON.stringify(pageData, null, 2));
            const response = await this.client.post('/content', pageData);
            return response.data;
        }
        catch (error) {
            if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error;
                console.error('Confluence API error response:', axiosError.response?.data);
                if (axiosError.response?.status === 401) {
                    throw new Error('Unauthorized - check CONFLUENCE_PAT token');
                }
                if (axiosError.response?.status === 400) {
                    const errorMessage = axiosError.response?.data?.message || 'Bad request';
                    throw new Error(`Invalid page data: ${errorMessage}`);
                }
                throw new Error(`Confluence API error (${axiosError.response?.status}): ${axiosError.response?.data?.message || axiosError.message}`);
            }
            throw new Error(`Failed to create page: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
exports.confluenceClient = new ConfluenceClient();
