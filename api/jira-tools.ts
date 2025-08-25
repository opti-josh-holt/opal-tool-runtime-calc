import { jiraClient, type JiraIssue, JiraClientError } from './jira-client';

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
  
  try {
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
  } catch (error) {
    if (error instanceof JiraClientError) {
      // Provide context-specific error messages
      if (error.status === 404) {
        throw new Error(
          `Jira issue "${issueKey}" not found. This could mean: 1) The issue key is incorrect or doesn't exist, 2) The issue has been deleted, or 3) You don't have permission to view this issue. Please verify the issue key format (e.g., "PROJ-123") and that it exists in Jira. Error details: ${error.message}`
        );
      } else if (error.status === 401) {
        throw new Error(
          `Authentication failed when accessing Jira issue "${issueKey}". Please check your JIRA_PAT environment variable contains a valid Personal Access Token with read permissions. Error details: ${error.message}`
        );
      } else if (error.status === 403) {
        throw new Error(
          `Access denied to Jira issue "${issueKey}". Your account may not have permission to view issues in this project. Please contact your Jira administrator or verify you have access to the project. Error details: ${error.message}`
        );
      }
      throw new Error(`Failed to read Jira issue "${issueKey}": ${error.message}`);
    }
    throw new Error(
      `Unexpected error reading Jira issue "${issueKey}": ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function updateJiraIssue(params: UpdateJiraIssueParams): Promise<UpdateIssueResult> {
  const { issueKey, fields } = params;
  
  try {
    await jiraClient.updateIssue(issueKey, { fields });
    
    return {
      success: true,
      message: `Issue ${issueKey} updated successfully`,
    };
  } catch (error) {
    if (error instanceof JiraClientError) {
      if (error.status === 404) {
        throw new Error(
          `Jira issue "${issueKey}" not found for update. This could mean: 1) The issue key is incorrect or doesn't exist, 2) The issue has been deleted, or 3) You don't have permission to view this issue. Please verify the issue key and that it exists in Jira. Error details: ${error.message}`
        );
      } else if (error.status === 401) {
        throw new Error(
          `Authentication failed when updating Jira issue "${issueKey}". Please check your JIRA_PAT environment variable contains a valid Personal Access Token with edit permissions. Error details: ${error.message}`
        );
      } else if (error.status === 403) {
        throw new Error(
          `Access denied when updating Jira issue "${issueKey}". Your account may not have permission to edit issues in this project. Please contact your Jira administrator or verify you have edit permissions. Error details: ${error.message}`
        );
      } else if (error.status === 400) {
        throw new Error(
          `Invalid update data for Jira issue "${issueKey}". The field values provided may be incorrect or the fields may not exist in this project. Please check the field names and values are valid for this issue type. Error details: ${error.message}`
        );
      }
      throw new Error(`Failed to update Jira issue "${issueKey}": ${error.message}`);
    }
    throw new Error(
      `Unexpected error updating Jira issue "${issueKey}": ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function createJiraIssue(params: CreateJiraIssueParams): Promise<CreateIssueResult> {
  const { project, issueType, summary, description, assignee, additionalFields } = params;
  
  try {
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
  } catch (error) {
    if (error instanceof JiraClientError) {
      if (error.status === 400) {
        throw new Error(
          `Invalid data when creating Jira issue in project "${project}". This could mean: 1) The project key "${project}" doesn't exist or you don't have access to it, 2) The issue type "${issueType}" is not available in this project, 3) Required custom fields are missing, or 4) Field values are invalid. Please verify the project key exists, the issue type is correct (e.g., "Task", "Bug", "Story"), and all required fields are provided. Error details: ${error.message}`
        );
      } else if (error.status === 401) {
        throw new Error(
          `Authentication failed when creating Jira issue. Please check your JIRA_PAT environment variable contains a valid Personal Access Token with create permissions. Error details: ${error.message}`
        );
      } else if (error.status === 403) {
        throw new Error(
          `Access denied when creating issue in project "${project}". Your account may not have permission to create issues in this project. Please contact your Jira administrator or verify you have create permissions for this project. Error details: ${error.message}`
        );
      }
      throw new Error(`Failed to create Jira issue in project "${project}": ${error.message}`);
    }
    throw new Error(
      `Unexpected error creating Jira issue in project "${project}": ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}