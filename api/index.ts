import {
  ToolsService,
  tool,
  ParameterType,
} from "@optimizely-opal/opal-tools-sdk";
import express from "express";
import dotenv from "dotenv";
import { estimateRunTimeDays } from "./calculate-runtime";
import { generatePdfFromMarkdown, cleanupExpiredPdfs } from "./generate-pdf";
import { readJiraIssue, updateJiraIssue, createJiraIssue } from "./jira-tools";
import type { ReadJiraIssueParams, UpdateJiraIssueParams, CreateJiraIssueParams } from "./jira-tools";
import { readConfluencePage, updateConfluencePage, createConfluencePage } from "./confluence-tools";
import type { ReadConfluencePageParams, UpdateConfluencePageParams, CreateConfluencePageParams } from "./confluence-tools";

dotenv.config();

const app = express();
app.use(express.json()); // Add JSON middleware

// Serve PDFs from /tmp directory
app.use('/pdfs', express.static('/tmp', {
  setHeaders: (res, path) => {
    if (path.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
    }
  }
}));

const toolsService = new ToolsService(app);
const bearerToken = process.env.BEARER_TOKEN;

// Run cleanup every hour
setInterval(() => {
  cleanupExpiredPdfs().catch(() => {
    // Cleanup is best effort, don't crash the server
  });
}, 60 * 60 * 1000); // 1 hour in milliseconds

// Add a root route to provide a status message.
app.get("/", (req, res) => {
  res.send("Opal tool server is running. Visit /discovery for tool discovery.");
});

type CalculateRuntimeParams = {
  BCR: number;
  MDE: number;
  sigLevel: number;
  numVariations: number;
  dailyVisitors: number;
};

type GeneratePdfParams = {
  markdown: string;
  filename?: string;
};

async function calculateRuntime(
  params: CalculateRuntimeParams
): Promise<{ days: number | null }> {
  const { BCR, MDE, sigLevel, numVariations, dailyVisitors } = params;
  const days = estimateRunTimeDays(
    BCR,
    MDE,
    sigLevel,
    numVariations,
    dailyVisitors
  );
  return { days };
}

async function generatePdf(
  params: GeneratePdfParams
): Promise<{ pdfUrl: string; expiresAt: string }> {
  return await generatePdfFromMarkdown(params);
}

tool({
  name: "calculate_experiment_runtime",
  description: "Calculates the estimated time to run an experiment.",
  parameters: [
    {
      name: "BCR",
      type: ParameterType.Number,
      description:
        "The conversion rate of the control group (e.g., 0.1 for 10%)",
      required: true,
    },
    {
      name: "MDE",
      type: ParameterType.Number,
      description: "The relative lift you want to detect (e.g., 0.05 for 5%)",
      required: true,
    },
    {
      name: "sigLevel",
      type: ParameterType.Number,
      description: "The desired statistical significance (e.g., 95 for 95%)",
      required: true,
    },
    {
      name: "numVariations",
      type: ParameterType.Number,
      description: "The total number of variations, including control",
      required: true,
    },
    {
      name: "dailyVisitors",
      type: ParameterType.Number,
      description:
        "The number of visitors per day participating in the experiment",
      required: true,
    },
  ],
})(calculateRuntime);

tool({
  name: "generate_pdf_from_markdown",
  description: "Converts markdown text to a PDF document and returns a download URL.",
  parameters: [
    {
      name: "markdown",
      type: ParameterType.String,
      description: "The markdown content to convert to PDF",
      required: true,
    },
    {
      name: "filename",
      type: ParameterType.String,
      description: "Optional custom filename for the PDF (without .pdf extension)",
      required: false,
    },
  ],
})(generatePdf);

tool({
  name: "read_jira_issue",
  description: "Reads a Jira issue by its key and returns the issue details.",
  parameters: [
    {
      name: "issueKey",
      type: ParameterType.String,
      description: "The Jira issue key (e.g., 'PROJ-123')",
      required: true,
    },
  ],
})(readJiraIssue);

tool({
  name: "update_jira_issue",
  description: "Updates a Jira issue with new field values.",
  parameters: [
    {
      name: "issueKey",
      type: ParameterType.String,
      description: "The Jira issue key (e.g., 'PROJ-123')",
      required: true,
    },
    {
      name: "fields",
      type: ParameterType.Dictionary,
      description: "Object containing field updates (e.g., {summary: 'New title', description: 'New description'})",
      required: true,
    },
  ],
})(updateJiraIssue);

tool({
  name: "create_jira_issue",
  description: "Creates a new Jira issue in the specified project.",
  parameters: [
    {
      name: "project",
      type: ParameterType.String,
      description: "The project key where the issue should be created",
      required: true,
    },
    {
      name: "issueType",
      type: ParameterType.String,
      description: "The type of issue to create (e.g., 'Bug', 'Task', 'Story')",
      required: true,
    },
    {
      name: "summary",
      type: ParameterType.String,
      description: "The issue summary/title",
      required: true,
    },
    {
      name: "description",
      type: ParameterType.String,
      description: "Optional issue description",
      required: false,
    },
    {
      name: "assignee",
      type: ParameterType.String,
      description: "Optional assignee username",
      required: false,
    },
    {
      name: "additionalFields",
      type: ParameterType.Dictionary,
      description: "Optional additional fields to set on the issue",
      required: false,
    },
  ],
})(createJiraIssue);

tool({
  name: "read_confluence_page",
  description: "Reads a Confluence page by ID or by space and title.",
  parameters: [
    {
      name: "pageId",
      type: ParameterType.String,
      description: "The Confluence page ID",
      required: false,
    },
    {
      name: "spaceKey",
      type: ParameterType.String,
      description: "The space key (required if using title)",
      required: false,
    },
    {
      name: "title",
      type: ParameterType.String,
      description: "The page title (required if using spaceKey)",
      required: false,
    },
  ],
})(readConfluencePage);

tool({
  name: "update_confluence_page",
  description: "Updates a Confluence page with new content.",
  parameters: [
    {
      name: "pageId",
      type: ParameterType.String,
      description: "The Confluence page ID",
      required: true,
    },
    {
      name: "title",
      type: ParameterType.String,
      description: "Optional new title for the page",
      required: false,
    },
    {
      name: "content",
      type: ParameterType.String,
      description: "The new page content in Markdown format (automatically converted to Confluence storage format)",
      required: true,
    },
  ],
})(updateConfluencePage);

tool({
  name: "create_confluence_page",
  description: "Creates a new Confluence page in the specified space.",
  parameters: [
    {
      name: "spaceKey",
      type: ParameterType.String,
      description: "The space key where the page should be created",
      required: true,
    },
    {
      name: "title",
      type: ParameterType.String,
      description: "The page title",
      required: true,
    },
    {
      name: "content",
      type: ParameterType.String,
      description: "The page content in Markdown format (automatically converted to Confluence storage format)",
      required: true,
    },
    {
      name: "parentPageId",
      type: ParameterType.String,
      description: "Optional parent page ID to create as a child page",
      required: false,
    },
  ],
})(createConfluencePage);

if (bearerToken) {
  app.use("/tools/calculateRuntime", (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${bearerToken}`) {
      return res.status(401).send("Unauthorized");
    }
    next();
  });
}

/*
// For local development
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Discovery endpoint: http://localhost:${PORT}/discovery`);
  });
}
*/

export default app;
