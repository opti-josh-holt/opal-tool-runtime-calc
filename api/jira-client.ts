import axios from 'axios';
import type { AxiosInstance } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export type JiraIssue = {
  key: string;
  fields: {
    summary: string;
    description?: string;
    status: {
      name: string;
      id: string;
    };
    assignee?: {
      displayName: string;
      emailAddress: string;
    };
    reporter: {
      displayName: string;
      emailAddress: string;
    };
    issuetype: {
      name: string;
      id: string;
    };
    project: {
      key: string;
      name: string;
    };
    created: string;
    updated: string;
  };
};

export type CreateIssueRequest = {
  fields: {
    project: {
      key: string;
    };
    summary: string;
    description?: string;
    issuetype: {
      name: string;
    };
    assignee?: {
      name: string;
    };
    [key: string]: any;
  };
};

export type UpdateIssueRequest = {
  fields: {
    [key: string]: any;
  };
};

class JiraClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor() {
    const jiraPat = process.env.JIRA_PAT;
    if (!jiraPat) {
      throw new Error('JIRA_PAT environment variable is required');
    }

    this.baseUrl = 'https://jira.sso.episerver.net';
    this.client = axios.create({
      baseURL: `${this.baseUrl}/rest/api/2`,
      headers: {
        'Authorization': `Bearer ${jiraPat}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }

  async getIssue(issueKey: string): Promise<JiraIssue> {
    try {
      const response = await this.client.get(`/issue/${issueKey}`);
      return response.data;
    } catch (error) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
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

  async updateIssue(issueKey: string, updateData: UpdateIssueRequest): Promise<void> {
    try {
      await this.client.put(`/issue/${issueKey}`, updateData);
    } catch (error) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
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

  async createIssue(issueData: CreateIssueRequest): Promise<{ key: string; id: string; self: string }> {
    try {
      const response = await this.client.post('/issue', issueData);
      return response.data;
    } catch (error) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        if (axiosError.response?.status === 401) {
          throw new Error('Unauthorized - check JIRA_PAT token');
        }
        if (axiosError.response?.status === 400) {
          throw new Error(`Invalid issue data: ${axiosError.response?.data?.errorMessages?.join(', ') || 'Bad request'}`);
        }
        throw new Error(`Jira API error: ${axiosError.response?.data?.errorMessages?.join(', ') || axiosError.message}`);
      }
      throw new Error(`Failed to create issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const jiraClient = new JiraClient();