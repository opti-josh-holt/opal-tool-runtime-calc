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
        this.requests = this.requests.filter((time) => now - time < this.windowMs);
        if (this.requests.length >= this.maxRequests) {
            const oldestRequest = this.requests[0];
            const waitTime = this.windowMs - (now - oldestRequest) + 100; // +100ms buffer
            console.log(`Rate limit reached. Waiting ${waitTime}ms...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
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
        this.name = "OptimizelyClientError";
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
            baseURL: "https://api.optimizely.com/v2",
            headers: {
                Authorization: `Bearer ${apiToken}`,
                "Content-Type": "application/json",
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
            return new OptimizelyClientError("Network error: Unable to reach Optimizely API", undefined, "NETWORK_ERROR", error.message);
        }
        else {
            return new OptimizelyClientError(`Request error: ${error.message}`, undefined, "REQUEST_ERROR", error.message);
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
        return this.makeRequest("GET", `/projects/${projectId}`);
    }
    // Experiment methods
    async listExperiments(projectId, options = {}) {
        const params = new URLSearchParams();
        // Add project_id as a filter parameter
        params.append("project_id", projectId);
        if (options.page)
            params.append("page", options.page.toString());
        if (options.per_page)
            params.append("per_page", options.per_page.toString());
        // Only add include_classic if it's explicitly set (not undefined)
        if (options.include_classic !== undefined) {
            params.append("include_classic", options.include_classic.toString());
            console.log(`DEBUG: Adding include_classic=${options.include_classic}`);
        }
        else {
            console.log(`DEBUG: Not adding include_classic parameter (undefined)`);
        }
        const url = `/experiments?${params.toString()}`;
        console.log(`DEBUG: Making request to: ${url}`);
        console.log(`DEBUG: Project ID: ${projectId}, Type: ${typeof projectId}`);
        console.log(`DEBUG: Full URL params: ${params.toString()}`);
        return this.makeRequest("GET", url);
    }
    async getExperiment(projectId, experimentId) {
        const url = `/experiments/${experimentId}`;
        console.log(`DEBUG: Getting experiment with URL: ${url}`);
        console.log(`DEBUG: Experiment ID: ${experimentId}, Type: ${typeof experimentId}, Length: ${experimentId.length}`);
        return this.makeRequest("GET", url);
    }
    async createExperiment(projectId, experimentData) {
        // Add project_id to the experiment data
        const dataWithProjectId = {
            ...experimentData,
            project_id: parseInt(projectId, 10), // Ensure base 10 parsing
        };
        console.log('DEBUG: Final payload with project_id:', JSON.stringify(dataWithProjectId, null, 2));
        return this.makeRequest("POST", `/experiments`, dataWithProjectId);
    }
    async getExperimentResults(projectId, experimentId) {
        return this.makeRequest("GET", `/experiments/${experimentId}/results`);
    }
    // Audience methods
    async listAudiences(projectId, options = {}) {
        const params = new URLSearchParams();
        // Add project_id as a filter parameter (like experiments)
        params.append("project_id", projectId);
        if (options.page)
            params.append("page", options.page.toString());
        if (options.per_page)
            params.append("per_page", options.per_page.toString());
        // Remove include_classic parameter as it's likely causing issues
        const url = `/audiences?${params.toString()}`;
        console.log(`DEBUG: Making audiences request to: ${url}`);
        return this.makeRequest("GET", url);
    }
    async getAudience(projectId, audienceId) {
        const url = `/audiences/${audienceId}`;
        console.log(`DEBUG: Getting audience with URL: ${url}`);
        console.log(`DEBUG: Audience ID: ${audienceId}, Type: ${typeof audienceId}, Length: ${audienceId.length}`);
        return this.makeRequest("GET", url);
    }
    // Page methods
    async listPages(projectId, options = {}) {
        const params = new URLSearchParams();
        // Add project_id as a filter parameter (like experiments)
        params.append("project_id", projectId);
        if (options.page)
            params.append("page", options.page.toString());
        if (options.per_page)
            params.append("per_page", options.per_page.toString());
        // Remove include_classic parameter as it's likely causing issues
        const url = `/pages?${params.toString()}`;
        console.log(`DEBUG: Making pages request to: ${url}`);
        return this.makeRequest("GET", url);
    }
    async getPage(projectId, pageId) {
        const url = `/pages/${pageId}`;
        console.log(`DEBUG: Getting page with URL: ${url}`);
        console.log(`DEBUG: Page ID: ${pageId}, Type: ${typeof pageId}, Length: ${pageId.length}`);
        return this.makeRequest("GET", url);
    }
    // Event methods
    async listEvents(projectId, options = {}) {
        const params = new URLSearchParams();
        // Add project_id as a filter parameter (like experiments)
        params.append("project_id", projectId);
        if (options.page)
            params.append("page", options.page.toString());
        if (options.per_page)
            params.append("per_page", options.per_page.toString());
        // Remove include_classic parameter as it's likely causing issues
        const url = `/events?${params.toString()}`;
        console.log(`DEBUG: Making events request to: ${url}`);
        return this.makeRequest("GET", url);
    }
    async getEvent(projectId, eventId) {
        const url = `/events/${eventId}`;
        console.log(`DEBUG: Getting event with URL: ${url}`);
        console.log(`DEBUG: Event ID: ${eventId}, Type: ${typeof eventId}, Length: ${eventId.length}`);
        return this.makeRequest("GET", url);
    }
    // Utility methods
    async healthCheck() {
        try {
            // Simple health check by making a minimal API call
            await this.makeRequest("GET", "/projects?per_page=1");
            return {
                status: "healthy",
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            return {
                status: "unhealthy",
                timestamp: new Date().toISOString(),
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
            throw new Error("OPTIMIZELY_API_TOKEN environment variable is required");
        }
        optimizelyClient = new OptimizelyClient(apiToken);
    }
    return optimizelyClient;
}
// OptimizelyClient is already exported above
