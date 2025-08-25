"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.confluenceClient = exports.ConfluenceClientError = void 0;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class ConfluenceClientError extends Error {
    constructor(message, status, code, details) {
        super(message);
        this.name = "ConfluenceClientError";
        this.status = status;
        this.code = code;
        this.details = details;
        Object.setPrototypeOf(this, ConfluenceClientError.prototype);
    }
}
exports.ConfluenceClientError = ConfluenceClientError;
class ConfluenceClient {
    constructor() {
        const confluencePat = process.env.CONFLUENCE_PAT;
        if (!confluencePat) {
            throw new ConfluenceClientError('CONFLUENCE_PAT environment variable is required. Please set your Confluence Personal Access Token.', undefined, 'MISSING_CREDENTIALS', 'Set the CONFLUENCE_PAT environment variable with your Confluence Personal Access Token');
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
        // Add response interceptor for error handling
        this.client.interceptors.response.use((response) => response, (error) => {
            return Promise.reject(this.handleApiError(error));
        });
    }
    handleApiError(error) {
        if (error.response) {
            const { status, data } = error.response;
            const message = data?.message || `HTTP ${status} error`;
            let enhancedMessage = 'Confluence API Error';
            let code = `HTTP_${status}`;
            let details = data;
            if (status === 401) {
                enhancedMessage = 'Authentication failed. Please check your CONFLUENCE_PAT token has valid permissions.';
                code = 'AUTHENTICATION_ERROR';
            }
            else if (status === 403) {
                enhancedMessage = 'Access forbidden. Your Confluence account may not have the required permissions for this space or page.';
                code = 'AUTHORIZATION_ERROR';
            }
            else if (status === 404) {
                enhancedMessage = 'Resource not found. The page ID, space key, or page title may not exist.';
                code = 'NOT_FOUND_ERROR';
            }
            else if (status === 400) {
                enhancedMessage = `Invalid request data. ${message || 'Please check your input parameters.'}`;
                code = 'VALIDATION_ERROR';
            }
            else if (status === 409) {
                enhancedMessage = 'Version conflict. The page was modified by another user. Please refresh the page and try again.';
                code = 'CONFLICT_ERROR';
            }
            else {
                enhancedMessage = `Confluence API Error: ${message}`;
            }
            return new ConfluenceClientError(enhancedMessage, status, code, details);
        }
        else if (error.request) {
            return new ConfluenceClientError('Network error: Unable to reach Confluence API. Please check your connection and that confluence.sso.episerver.net is accessible.', undefined, 'NETWORK_ERROR', error.message);
        }
        else {
            return new ConfluenceClientError(`Request error: ${error.message}`, undefined, 'REQUEST_ERROR', error.message);
        }
    }
    async getPageById(pageId) {
        if (!pageId || typeof pageId !== 'string') {
            throw new ConfluenceClientError('Page ID is required and must be a valid string', undefined, 'VALIDATION_ERROR', 'Provide a valid Confluence page ID (numeric string)');
        }
        const response = await this.client.get(`/content/${pageId}`, {
            params: {
                expand: 'body.storage,version,space'
            }
        });
        return response.data;
    }
    async getPageByTitle(spaceKey, title) {
        if (!spaceKey || typeof spaceKey !== 'string') {
            throw new ConfluenceClientError('Space key is required and must be a valid string', undefined, 'VALIDATION_ERROR', 'Provide a valid Confluence space key (e.g., "MYSPACE")');
        }
        if (!title || typeof title !== 'string') {
            throw new ConfluenceClientError('Page title is required and must be a valid string', undefined, 'VALIDATION_ERROR', 'Provide a valid page title to search for');
        }
        const response = await this.client.get('/content', {
            params: {
                spaceKey: spaceKey.toUpperCase(),
                title,
                expand: 'body.storage,version,space',
                limit: 1
            }
        });
        if (!response.data.results || response.data.results.length === 0) {
            throw new ConfluenceClientError(`Page with title "${title}" not found in space "${spaceKey}". Please check the title and space key are correct.`, 404, 'NOT_FOUND_ERROR', `Search performed in space: ${spaceKey}, title: "${title}"`);
        }
        return response.data.results[0];
    }
    async updatePage(pageId, updateData) {
        if (!pageId || typeof pageId !== 'string') {
            throw new ConfluenceClientError('Page ID is required and must be a valid string', undefined, 'VALIDATION_ERROR', 'Provide a valid Confluence page ID (numeric string)');
        }
        if (!updateData || typeof updateData !== 'object') {
            throw new ConfluenceClientError('Update data is required and must be an object with version, title, type, and body', undefined, 'VALIDATION_ERROR', 'Provide update data with: { version: { number: X }, title: "...", type: "page", body: { storage: { value: "...", representation: "storage" } } }');
        }
        if (!updateData.version?.number) {
            throw new ConfluenceClientError('Version number is required for page updates to prevent conflicts', undefined, 'VALIDATION_ERROR', 'Include the current version number: { version: { number: currentVersion + 1 } }');
        }
        const response = await this.client.put(`/content/${pageId}`, updateData);
        return response.data;
    }
    async createPage(pageData) {
        if (!pageData || typeof pageData !== 'object') {
            throw new ConfluenceClientError('Page data is required and must contain type, title, space, and body', undefined, 'VALIDATION_ERROR', 'Provide page data with: { type: "page", title: "...", space: { key: "..." }, body: { storage: { value: "...", representation: "storage" } } }');
        }
        if (!pageData.space?.key) {
            throw new ConfluenceClientError('Space key is required in the format: { space: { key: "SPACE_KEY" } }', undefined, 'VALIDATION_ERROR', 'Specify the space where the page should be created, e.g., { space: { key: "MYSPACE" } }');
        }
        if (!pageData.title) {
            throw new ConfluenceClientError('Page title is required', undefined, 'VALIDATION_ERROR', 'Provide a descriptive title for the page');
        }
        if (!pageData.body?.storage?.value) {
            throw new ConfluenceClientError('Page content is required in storage format', undefined, 'VALIDATION_ERROR', 'Provide page content in the body: { storage: { value: "content", representation: "storage" } }');
        }
        const response = await this.client.post('/content', pageData);
        return response.data;
    }
}
exports.confluenceClient = new ConfluenceClient();
