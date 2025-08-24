import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export type ConfluencePage = {
  id: string;
  type: string;
  status: string;
  title: string;
  space: {
    id: string;
    key: string;
    name: string;
  };
  version: {
    number: number;
    by: {
      displayName: string;
      emailAddress: string;
    };
    when: string;
  };
  body: {
    storage: {
      value: string;
      representation: string;
    };
  };
  _links: {
    webui: string;
    self: string;
  };
};

export type CreatePageRequest = {
  type: string;
  title: string;
  space: {
    key: string;
  };
  body: {
    storage: {
      value: string;
      representation: string;
    };
  };
  ancestors?: Array<{
    id: string;
  }>;
};

export type UpdatePageRequest = {
  version: {
    number: number;
  };
  title: string;
  type: string;
  body: {
    storage: {
      value: string;
      representation: string;
    };
  };
};

class ConfluenceClient {
  private client: any;
  private baseUrl: string;

  constructor() {
    const confluencePat = process.env.CONFLUENCE_PAT;
    if (!confluencePat) {
      throw new Error('CONFLUENCE_PAT environment variable is required');
    }

    this.baseUrl = 'https://confluence.sso.episerver.net';
    this.client = axios.create({
      baseURL: `${this.baseUrl}/rest/api`,
      headers: {
        'Authorization': `Bearer ${confluencePat}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }

  async getPageById(pageId: string): Promise<ConfluencePage> {
    try {
      const response = await this.client.get(`/content/${pageId}`, {
        params: {
          expand: 'body.storage,version,space'
        }
      });
      return response.data;
    } catch (error) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
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

  async getPageByTitle(spaceKey: string, title: string): Promise<ConfluencePage> {
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
    } catch (error) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        if (axiosError.response?.status === 401) {
          throw new Error('Unauthorized - check CONFLUENCE_PAT token');
        }
        throw new Error(`Confluence API error: ${axiosError.response?.data?.message || axiosError.message}`);
      }
      throw new Error(`Failed to search for page: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updatePage(pageId: string, updateData: UpdatePageRequest): Promise<ConfluencePage> {
    try {
      const response = await this.client.put(`/content/${pageId}`, updateData);
      return response.data;
    } catch (error) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
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

  async createPage(pageData: CreatePageRequest): Promise<ConfluencePage> {
    try {
      console.log('Creating page with data:', JSON.stringify(pageData, null, 2));
      const response = await this.client.post('/content', pageData);
      return response.data;
    } catch (error) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
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

export const confluenceClient = new ConfluenceClient();