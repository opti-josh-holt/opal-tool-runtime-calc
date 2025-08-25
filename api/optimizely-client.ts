import axios from "axios";
import type {
  OptimizelyProject,
  OptimizelyExperiment,
  OptimizelyAudience,
  OptimizelyPage,
  OptimizelyEvent,
  OptimizelyExperimentResults,
  OptimizelyAPIError,
} from "./optimizely-types";

/**
 * Rate limiter for Optimizely API requests
 * Based on Optimizely's documented limits: 60 requests per minute
 */
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number = 60;
  private readonly windowMs: number = 60000; // 1 minute

  async waitIfNeeded(): Promise<void> {
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
export class OptimizelyClientError extends Error implements OptimizelyAPIError {
  status?: number;
  code?: string;
  details?: any;

  constructor(message: string, status?: number, code?: string, details?: any) {
    super(message);
    this.name = "OptimizelyClientError";
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, OptimizelyClientError.prototype);
  }
}

/**
 * Optimizely Web Experimentation API Client
 * Handles authentication, rate limiting, and error handling for API requests
 */
export class OptimizelyClient {
  private client: any;
  private rateLimiter: RateLimiter;
  private apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
    this.rateLimiter = new RateLimiter();

    this.client = axios.create({
      baseURL: "https://api.optimizely.com/v2",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      timeout: 30000, // 30 second timeout
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response: any) => response,
      (error: any) => {
        return Promise.reject(this.handleApiError(error));
      }
    );
  }

  private handleApiError(error: any): OptimizelyClientError {
    if (error.response) {
      const { status, data } = error.response;
      const message = (data as any)?.message || `HTTP ${status} error`;
      const code = (data as any)?.code || `HTTP_${status}`;

      return new OptimizelyClientError(
        `Optimizely API Error: ${message}`,
        status,
        code,
        data
      );
    } else if (error.request) {
      return new OptimizelyClientError(
        "Network error: Unable to reach Optimizely API",
        undefined,
        "NETWORK_ERROR",
        error.message
      );
    } else {
      return new OptimizelyClientError(
        `Request error: ${error.message}`,
        undefined,
        "REQUEST_ERROR",
        error.message
      );
    }
  }

  private async makeRequest<T>(
    method: string,
    url: string,
    data?: any
  ): Promise<T> {
    await this.rateLimiter.waitIfNeeded();

    try {
      const response = await this.client.request({
        method,
        url,
        data,
      });
      return response.data;
    } catch (error) {
      console.error(`Optimizely API ${method} ${url} failed:`, error);
      throw error;
    }
  }

  // Project methods
  async getProject(projectId: string): Promise<OptimizelyProject> {
    return this.makeRequest<OptimizelyProject>("GET", `/projects/${projectId}`);
  }

  // Experiment methods
  async listExperiments(
    projectId: string,
    options: {
      page?: number;
      per_page?: number;
      include_classic?: boolean;
    } = {}
  ): Promise<OptimizelyExperiment[]> {
    const params = new URLSearchParams();
    // Add project_id as a filter parameter
    params.append("project_id", projectId);
    if (options.page) params.append("page", options.page.toString());
    if (options.per_page)
      params.append("per_page", options.per_page.toString());
    if (options.include_classic !== undefined) {
      params.append("include_classic", options.include_classic.toString());
    }

    const url = `/experiments?${params.toString()}`;
    console.log(`DEBUG: Making request to: ${url}`);
    console.log(`DEBUG: Project ID: ${projectId}, Type: ${typeof projectId}`);
    console.log(`DEBUG: Full URL params: ${params.toString()}`);

    return this.makeRequest<OptimizelyExperiment[]>("GET", url);
  }

  async getExperiment(
    projectId: string,
    experimentId: string
  ): Promise<OptimizelyExperiment> {
    return this.makeRequest<OptimizelyExperiment>(
      "GET",
      `/experiments/${experimentId}`
    );
  }

  async createExperiment(
    projectId: string,
    experimentData: any
  ): Promise<OptimizelyExperiment> {
    // Add project_id to the experiment data
    const dataWithProjectId = {
      ...experimentData,
      project_id: parseInt(projectId),
    };
    return this.makeRequest<OptimizelyExperiment>(
      "POST",
      `/experiments`,
      dataWithProjectId
    );
  }

  async getExperimentResults(
    projectId: string,
    experimentId: string
  ): Promise<OptimizelyExperimentResults> {
    return this.makeRequest<OptimizelyExperimentResults>(
      "GET",
      `/experiments/${experimentId}/results`
    );
  }

  // Audience methods
  async listAudiences(
    projectId: string,
    options: {
      page?: number;
      per_page?: number;
      include_classic?: boolean;
    } = {}
  ): Promise<OptimizelyAudience[]> {
    const params = new URLSearchParams();
    if (options.page) params.append("page", options.page.toString());
    if (options.per_page)
      params.append("per_page", options.per_page.toString());
    if (options.include_classic !== undefined) {
      params.append("include_classic", options.include_classic.toString());
    }

    const url = `/projects/${projectId}/audiences${
      params.toString() ? "?" + params.toString() : ""
    }`;
    return this.makeRequest<OptimizelyAudience[]>("GET", url);
  }

  async getAudience(
    projectId: string,
    audienceId: string
  ): Promise<OptimizelyAudience> {
    return this.makeRequest<OptimizelyAudience>(
      "GET",
      `/projects/${projectId}/audiences/${audienceId}`
    );
  }

  // Page methods
  async listPages(
    projectId: string,
    options: {
      page?: number;
      per_page?: number;
      include_classic?: boolean;
    } = {}
  ): Promise<OptimizelyPage[]> {
    const params = new URLSearchParams();
    if (options.page) params.append("page", options.page.toString());
    if (options.per_page)
      params.append("per_page", options.per_page.toString());
    if (options.include_classic !== undefined) {
      params.append("include_classic", options.include_classic.toString());
    }

    const url = `/projects/${projectId}/pages${
      params.toString() ? "?" + params.toString() : ""
    }`;
    return this.makeRequest<OptimizelyPage[]>("GET", url);
  }

  async getPage(projectId: string, pageId: string): Promise<OptimizelyPage> {
    return this.makeRequest<OptimizelyPage>(
      "GET",
      `/projects/${projectId}/pages/${pageId}`
    );
  }

  // Event methods
  async listEvents(
    projectId: string,
    options: {
      page?: number;
      per_page?: number;
      include_classic?: boolean;
    } = {}
  ): Promise<OptimizelyEvent[]> {
    const params = new URLSearchParams();
    if (options.page) params.append("page", options.page.toString());
    if (options.per_page)
      params.append("per_page", options.per_page.toString());
    if (options.include_classic !== undefined) {
      params.append("include_classic", options.include_classic.toString());
    }

    const url = `/projects/${projectId}/events${
      params.toString() ? "?" + params.toString() : ""
    }`;
    return this.makeRequest<OptimizelyEvent[]>("GET", url);
  }

  async getEvent(projectId: string, eventId: string): Promise<OptimizelyEvent> {
    return this.makeRequest<OptimizelyEvent>(
      "GET",
      `/projects/${projectId}/events/${eventId}`
    );
  }

  // Utility methods
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      // Simple health check by making a minimal API call
      await this.makeRequest("GET", "/projects?per_page=1");
      return {
        status: "healthy",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Create a singleton instance for use across the application
let optimizelyClient: OptimizelyClient | null = null;

export function getOptimizelyClient(): OptimizelyClient {
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
