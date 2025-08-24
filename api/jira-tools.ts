import { jiraClient, type JiraIssue } from './jira-client';

export type ReadJiraIssueParams = {
  issueKey: string;
};

export type UpdateJiraIssueParams = {
  issueKey: string;
  fields: {
    [key: string]: any;
  };
};

export type CreateJiraIssueParams = {
  project: string;
  issueType: string;
  summary: string;
  description?: string;
  assignee?: string;
  additionalFields?: {
    [key: string]: any;
  };
};

export type JiraIssueResult = {
  key: string;
  summary: string;
  description?: string;
  status: string;
  assignee?: string;
  reporter: string;
  issueType: string;
  project: string;
  created: string;
  updated: string;
};

export type CreateIssueResult = {
  key: string;
  id: string;
  url: string;
};

export type UpdateIssueResult = {
  success: boolean;
  message: string;
};

export async function readJiraIssue(params: ReadJiraIssueParams): Promise<JiraIssueResult> {
  const { issueKey } = params;
  
  if (!issueKey || typeof issueKey !== 'string') {
    throw new Error('Issue key is required and must be a string');
  }

  const issue = await jiraClient.getIssue(issueKey);
  
  return {
    key: issue.key,
    summary: issue.fields.summary,
    description: issue.fields.description || undefined,
    status: issue.fields.status.name,
    assignee: issue.fields.assignee?.displayName,
    reporter: issue.fields.reporter.displayName,
    issueType: issue.fields.issuetype.name,
    project: issue.fields.project.name,
    created: issue.fields.created,
    updated: issue.fields.updated,
  };
}

export async function updateJiraIssue(params: UpdateJiraIssueParams): Promise<UpdateIssueResult> {
  const { issueKey, fields } = params;
  
  if (!issueKey || typeof issueKey !== 'string') {
    throw new Error('Issue key is required and must be a string');
  }
  
  if (!fields || typeof fields !== 'object') {
    throw new Error('Fields object is required for updates');
  }

  await jiraClient.updateIssue(issueKey, { fields });
  
  return {
    success: true,
    message: `Issue ${issueKey} updated successfully`,
  };
}

export async function createJiraIssue(params: CreateJiraIssueParams): Promise<CreateIssueResult> {
  const { project, issueType, summary, description, assignee, additionalFields } = params;
  
  if (!project || typeof project !== 'string') {
    throw new Error('Project key is required and must be a string');
  }
  
  if (!issueType || typeof issueType !== 'string') {
    throw new Error('Issue type is required and must be a string');
  }
  
  if (!summary || typeof summary !== 'string') {
    throw new Error('Summary is required and must be a string');
  }

  const issueData = {
    fields: {
      project: {
        key: project,
      },
      summary,
      issuetype: {
        name: issueType,
      },
      ...(description && { description }),
      ...(assignee && { assignee: { name: assignee } }),
      ...additionalFields,
    },
  };

  const result = await jiraClient.createIssue(issueData);
  
  return {
    key: result.key,
    id: result.id,
    url: `https://jira.sso.episerver.net/browse/${result.key}`,
  };
}