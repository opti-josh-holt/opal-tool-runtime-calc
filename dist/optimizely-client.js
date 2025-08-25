"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptimizelyClient = exports.OptimizelyClientError = void 0;
exports.getOptimizelyClient = getOptimizelyClient;
const axios_1 = __importDefault(require("axios"));
/**
 * Rate limiter for Optimizely API requests
 * Based on Optimizely's documented limits: 60 requests per minute
 */
class RateLimiter {
    constructor() {
        this.requests = [];
        this.maxRequests = 60;
        this.windowMs = 60000; // 1 minute
    }
    async waitIfNeeded() {
        const now = Date.now();
        // Remove requests older than 1 minute
        this.requests = this.requests.filter(time => now - time < this.windowMs);
        if (this.requests.length >= this.maxRequests) {
            const oldestRequest = this.requests[0];
            const waitTime = this.windowMs - (now - oldestRequest) + 100; // +100ms buffer
            console.log(`Rate limit reached. Waiting ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            // Recursively check again after waiting
            return this.waitIfNeeded();
        }
        this.requests.push(now);
    }
}
/**
 * Custom error class for Optimizely API errors
 */
class OptimizelyClientError extends Error {
    constructor(message, status, code, details) {
        super(message);
        this.name = 'OptimizelyClientError';
        this.status = status;
        this.code = code;
        this.details = details;
        Object.setPrototypeOf(this, OptimizelyClientError.prototype);
    }
}
exports.OptimizelyClientError = OptimizelyClientError;
/**
 * Optimizely Web Experimentation API Client
 * Handles authentication, rate limiting, and error handling for API requests
 */
class OptimizelyClient {
    constructor(apiToken) {
        this.apiToken = apiToken;
        this.rateLimiter = new RateLimiter();
        this.client = axios_1.default.create({
            baseURL: 'https://api.optimizely.com/v2',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
            },
            timeout: 30000, // 30 second timeout
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
            const code = data?.code || `HTTP_${status}`;
            return new OptimizelyClientError(`Optimizely API Error: ${message}`, status, code, data);
        }
        else if (error.request) {
            return new OptimizelyClientError('Network error: Unable to reach Optimizely API', undefined, 'NETWORK_ERROR', error.message);
        }
        else {
            return new OptimizelyClientError(`Request error: ${error.message}`, undefined, 'REQUEST_ERROR', error.message);
        }
    }
    async makeRequest(method, url, data) {
        await this.rateLimiter.waitIfNeeded();
        try {
            const response = await this.client.request({
                method,
                url,
                data,
            });
            return response.data;
        }
        catch (error) {
            console.error(`Optimizely API ${method} ${url} failed:`, error);
            throw error;
        }
    }
    // Project methods
    async getProject(projectId) {
        return this.makeRequest('GET', `/projects/${projectId}`);
    }
    // Experiment methods
    async listExperiments(projectId, options = {}) {
        const params = new URLSearchParams();
        if (options.page)
            params.append('page', options.page.toString());
        if (options.per_page)
            params.append('per_page', options.per_page.toString());
        if (options.include_classic !== undefined) {
            params.append('include_classic', options.include_classic.toString());
        }
        const url = `/projects/${projectId}/experiments${params.toString() ? '?' + params.toString() : ''}`;
        return this.makeRequest('GET', url);
    }
    async getExperiment(projectId, experimentId) {
        return this.makeRequest('GET', `/projects/${projectId}/experiments/${experimentId}`);
    }
    async createExperiment(projectId, experimentData) {
        return this.makeRequest('POST', `/projects/${projectId}/experiments`, experimentData);
    }
    async getExperimentResults(projectId, experimentId) {
        return this.makeRequest('GET', `/projects/${projectId}/experiments/${experimentId}/results`);
    }
    // Audience methods
    async listAudiences(projectId, options = {}) {
        const params = new URLSearchParams();
        if (options.page)
            params.append('page', options.page.toString());
        if (options.per_page)
            params.append('per_page', options.per_page.toString());
        if (options.include_classic !== undefined) {
            params.append('include_classic', options.include_classic.toString());
        }
        const url = `/projects/${projectId}/audiences${params.toString() ? '?' + params.toString() : ''}`;
        return this.makeRequest('GET', url);
    }
    async getAudience(projectId, audienceId) {
        return this.makeRequest('GET', `/projects/${projectId}/audiences/${audienceId}`);
    }
    // Page methods
    async listPages(projectId, options = {}) {
        const params = new URLSearchParams();
        if (options.page)
            params.append('page', options.page.toString());
        if (options.per_page)
            params.append('per_page', options.per_page.toString());
        if (options.include_classic !== undefined) {
            params.append('include_classic', options.include_classic.toString());
        }
        const url = `/projects/${projectId}/pages${params.toString() ? '?' + params.toString() : ''}`;
        return this.makeRequest('GET', url);
    }
    async getPage(projectId, pageId) {
        return this.makeRequest('GET', `/projects/${projectId}/pages/${pageId}`);
    }
    // Event methods
    async listEvents(projectId, options = {}) {
        const params = new URLSearchParams();
        if (options.page)
            params.append('page', options.page.toString());
        if (options.per_page)
            params.append('per_page', options.per_page.toString());
        if (options.include_classic !== undefined) {
            params.append('include_classic', options.include_classic.toString());
        }
        const url = `/projects/${projectId}/events${params.toString() ? '?' + params.toString() : ''}`;
        return this.makeRequest('GET', url);
    }
    async getEvent(projectId, eventId) {
        return this.makeRequest('GET', `/projects/${projectId}/events/${eventId}`);
    }
    // Utility methods
    async healthCheck() {
        try {
            // Simple health check by making a minimal API call
            await this.makeRequest('GET', '/projects?per_page=1');
            return {
                status: 'healthy',
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                timestamp: new Date().toISOString()
            };
        }
    }
}
exports.OptimizelyClient = OptimizelyClient;
// Create a singleton instance for use across the application
let optimizelyClient = null;
function getOptimizelyClient() {
    if (!optimizelyClient) {
        const apiToken = process.env.OPTIMIZELY_API_TOKEN;
        if (!apiToken) {
            throw new Error('OPTIMIZELY_API_TOKEN environment variable is required');
        }
        optimizelyClient = new OptimizelyClient(apiToken);
    }
    return optimizelyClient;
}
// OptimizelyClient is already exported above
