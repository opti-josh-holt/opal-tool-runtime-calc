"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readJiraIssue = readJiraIssue;
exports.updateJiraIssue = updateJiraIssue;
exports.createJiraIssue = createJiraIssue;
const jira_client_1 = require("./jira-client");
async function readJiraIssue(params) {
    const { issueKey } = params;
    if (!issueKey || typeof issueKey !== 'string') {
        throw new Error('Issue key is required and must be a string');
    }
    const issue = await jira_client_1.jiraClient.getIssue(issueKey);
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
async function updateJiraIssue(params) {
    const { issueKey, fields } = params;
    if (!issueKey || typeof issueKey !== 'string') {
        throw new Error('Issue key is required and must be a string');
    }
    if (!fields || typeof fields !== 'object') {
        throw new Error('Fields object is required for updates');
    }
    await jira_client_1.jiraClient.updateIssue(issueKey, { fields });
    return {
        success: true,
        message: `Issue ${issueKey} updated successfully`,
    };
}
async function createJiraIssue(params) {
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
    const result = await jira_client_1.jiraClient.createIssue(issueData);
    return {
        key: result.key,
        id: result.id,
        url: `https://jira.sso.episerver.net/browse/${result.key}`,
    };
}
