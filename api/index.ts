import {
  ToolsService,
  tool,
  ParameterType,
} from "@optimizely-opal/opal-tools-sdk";
import express from "express";
import dotenv from "dotenv";
import { estimateRunTimeDays, CalculationError } from "./calculate-runtime";
import { generatePdfFromMarkdown, cleanupExpiredPdfs } from "./generate-pdf";
import { readJiraIssue, updateJiraIssue, createJiraIssue } from "./jira-tools";
import type {
  ReadJiraIssueParams,
  UpdateJiraIssueParams,
  CreateJiraIssueParams,
} from "./jira-tools";
import {
  readConfluencePage,
  updateConfluencePage,
  createConfluencePage,
} from "./confluence-tools";
import type {
  ReadConfluencePageParams,
  UpdateConfluencePageParams,
  CreateConfluencePageParams,
} from "./confluence-tools";

// Optimizely Web Experimentation Tools
import {
  listExperiments,
  getExperiment,
  listAudiences,
  getAudience,
  listPages,
  getPage,
  listEvents,
  getEvent,
  getExperimentResults,
  createExperiment,
  getProjectOverview,
} from "./optimizely-tools";
import type {
  ListExperimentsParams,
  GetExperimentParams,
  ListAudiencesParams,
  GetAudienceParams,
  ListPagesParams,
  GetPageParams,
  ListEventsParams,
  GetEventParams,
  GetExperimentResultsParams,
  CreateExperimentParams,
  ProjectOverviewParams,
} from "./optimizely-types";

dotenv.config();

const app = express();
app.use(express.json()); // Add JSON middleware

// Serve PDFs from /tmp directory
app.use(
  "/pdfs",
  express.static("/tmp", {
    setHeaders: (res, path) => {
      if (path.endsWith(".pdf")) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "inline");
      }
    },
  })
);

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
  
  try {
    const days = estimateRunTimeDays(
      BCR,
      MDE,
      sigLevel,
      numVariations,
      dailyVisitors
    );
    return { days };
  } catch (error) {
    if (error instanceof CalculationError) {
      // Provide detailed error context for runtime calculations
      if (error.code === 'INVALID_BCR') {
        throw new Error(
          `Invalid Baseline Conversion Rate: ${error.message} The BCR represents your current conversion rate as a decimal (e.g., 0.05 for 5%). Please check your analytics data and provide the correct conversion rate.`
        );
      } else if (error.code === 'INVALID_MDE') {
        throw new Error(
          `Invalid Minimum Detectable Effect: ${error.message} The MDE represents the relative improvement you want to detect (e.g., 0.10 for a 10% improvement). Consider what meaningful business impact you want to measure.`
        );
      } else if (error.code === 'INVALID_SIGNIFICANCE_LEVEL') {
        throw new Error(
          `Invalid Statistical Significance Level: ${error.message} This determines how confident you want to be in your results. Common values are 90, 95, or 99. Higher values require longer tests.`
        );
      } else if (error.code === 'INVALID_NUM_VARIATIONS') {
        throw new Error(
          `Invalid Number of Variations: ${error.message} For a simple A/B test, use 2 (control + one variation). For A/B/C testing, use 3, and so on.`
        );
      } else if (error.code === 'INVALID_DAILY_VISITORS') {
        throw new Error(
          `Invalid Daily Visitors: ${error.message} This should be the number of unique visitors per day who will see your experiment. Check your website analytics for accurate traffic numbers.`
        );
      } else if (error.code === 'MDE_TOO_LARGE') {
        throw new Error(
          `Minimum Detectable Effect is too large: ${error.message} Your MDE would result in a negative conversion rate. Try reducing the MDE to a more realistic value, or verify your BCR is correct.`
        );
      } else if (error.code === 'DURATION_TOO_LONG') {
        throw new Error(
          `Experiment duration too long: ${error.message} To reduce the duration, you can: 1) Increase the MDE (detect larger effects), 2) Lower the significance level (accept more uncertainty), or 3) Get more daily traffic to the test.`
        );
      }
      throw new Error(`Runtime calculation error: ${error.message}`);
    }
    throw new Error(
      `Unexpected error calculating experiment runtime: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
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
  description:
    "Converts markdown text to a PDF document and returns a download URL.",
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
      description:
        "Optional custom filename for the PDF (without .pdf extension)",
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
      description:
        "Object containing field updates (e.g., {summary: 'New title', description: 'New description'})",
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
      description:
        "The new page content in Markdown format (automatically converted to Confluence storage format)",
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
      description:
        "The page content in Markdown format (automatically converted to Confluence storage format)",
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

// Optimizely Web Experimentation Tools
tool({
  name: "list_experiments",
  description:
    "Lists all experiments in an Optimizely Web Experimentation project with readable formatting.",
  parameters: [
    {
      name: "projectId",
      type: ParameterType.String,
      description: "The Optimizely project ID",
      required: true,
    },
    {
      name: "page",
      type: ParameterType.Number,
      description: "Page number for pagination (optional)",
      required: false,
    },
    {
      name: "per_page",
      type: ParameterType.Number,
      description: "Number of results per page (default: 50, max: 100)",
      required: false,
    },
  ],
})(listExperiments);

tool({
  name: "get_experiment",
  description:
    "Gets detailed information about a specific experiment including variations, audiences, and metrics. You can specify either the experiment ID or the experiment name.",
  parameters: [
    {
      name: "projectId",
      type: ParameterType.String,
      description: "The Optimizely project ID",
      required: true,
    },
    {
      name: "experimentId",
      type: ParameterType.String,
      description:
        "The experiment ID to retrieve (optional if experimentName is provided)",
      required: false,
    },
    {
      name: "experimentName",
      type: ParameterType.String,
      description:
        "The experiment name to retrieve (optional if experimentId is provided)",
      required: false,
    },
  ],
})(getExperiment);

tool({
  name: "get_experiment_results",
  description:
    "Gets experiment results with statistical analysis including conversion rates, confidence levels, and winning variations.",
  parameters: [
    {
      name: "projectId",
      type: ParameterType.String,
      description: "The Optimizely project ID",
      required: true,
    },
    {
      name: "experimentId",
      type: ParameterType.String,
      description: "The experiment ID to get results for",
      required: true,
    },
  ],
})(getExperimentResults);

tool({
  name: "list_audiences",
  description:
    "Lists all audiences in an Optimizely Web Experimentation project with readable formatting.",
  parameters: [
    {
      name: "projectId",
      type: ParameterType.String,
      description: "The Optimizely project ID",
      required: true,
    },
    {
      name: "archived",
      type: ParameterType.Boolean,
      description: "Filter by archived status (optional)",
      required: false,
    },
    {
      name: "page",
      type: ParameterType.Number,
      description: "Page number for pagination (optional)",
      required: false,
    },
    {
      name: "per_page",
      type: ParameterType.Number,
      description: "Number of results per page (default: 50, max: 100)",
      required: false,
    },
  ],
})(listAudiences);

tool({
  name: "get_audience",
  description:
    "Gets detailed information about a specific audience including conditions and segmentation settings. You can specify either the audience ID or the audience name.",
  parameters: [
    {
      name: "projectId",
      type: ParameterType.String,
      description: "The Optimizely project ID",
      required: true,
    },
    {
      name: "audienceId",
      type: ParameterType.String,
      description:
        "The audience ID to retrieve (optional if audienceName is provided)",
      required: false,
    },
    {
      name: "audienceName",
      type: ParameterType.String,
      description:
        "The audience name to retrieve (optional if audienceId is provided)",
      required: false,
    },
  ],
})(getAudience);

tool({
  name: "list_pages",
  description:
    "Lists all pages in an Optimizely Web Experimentation project with readable formatting.",
  parameters: [
    {
      name: "projectId",
      type: ParameterType.String,
      description: "The Optimizely project ID",
      required: true,
    },
    {
      name: "archived",
      type: ParameterType.Boolean,
      description: "Filter by archived status (optional)",
      required: false,
    },
    {
      name: "page",
      type: ParameterType.Number,
      description: "Page number for pagination (optional)",
      required: false,
    },
    {
      name: "per_page",
      type: ParameterType.Number,
      description: "Number of results per page (default: 50, max: 100)",
      required: false,
    },
  ],
})(listPages);

tool({
  name: "get_page",
  description:
    "Gets detailed information about a specific page including conditions and targeting settings. You can specify either the page ID or the page name.",
  parameters: [
    {
      name: "projectId",
      type: ParameterType.String,
      description: "The Optimizely project ID",
      required: true,
    },
    {
      name: "pageId",
      type: ParameterType.String,
      description: "The page ID to retrieve (optional if pageName is provided)",
      required: false,
    },
    {
      name: "pageName",
      type: ParameterType.String,
      description: "The page name to retrieve (optional if pageId is provided)",
      required: false,
    },
  ],
})(getPage);

tool({
  name: "list_events",
  description:
    "Lists all events in an Optimizely Web Experimentation project with readable formatting.",
  parameters: [
    {
      name: "projectId",
      type: ParameterType.String,
      description: "The Optimizely project ID",
      required: true,
    },
    {
      name: "archived",
      type: ParameterType.Boolean,
      description: "Filter by archived status (optional)",
      required: false,
    },
    {
      name: "page",
      type: ParameterType.Number,
      description: "Page number for pagination (optional)",
      required: false,
    },
    {
      name: "per_page",
      type: ParameterType.Number,
      description: "Number of results per page (default: 50, max: 100)",
      required: false,
    },
  ],
})(listEvents);

tool({
  name: "get_event",
  description:
    "Gets detailed information about a specific event including event type and tracking configuration. You can specify either the event ID or the event name.",
  parameters: [
    {
      name: "projectId",
      type: ParameterType.String,
      description: "The Optimizely project ID",
      required: true,
    },
    {
      name: "eventId",
      type: ParameterType.String,
      description:
        "The event ID to retrieve (optional if eventName is provided)",
      required: false,
    },
    {
      name: "eventName",
      type: ParameterType.String,
      description:
        "The event name to retrieve (optional if eventId is provided)",
      required: false,
    },
  ],
})(getEvent);

tool({
  name: "create_experiment",
  description:
    "Creates a new experiment in an Optimizely Web Experimentation project (demo purposes).",
  parameters: [
    {
      name: "projectId",
      type: ParameterType.String,
      description: "The Optimizely project ID",
      required: true,
    },
    {
      name: "name",
      type: ParameterType.String,
      description: "The experiment name",
      required: true,
    },
    {
      name: "description",
      type: ParameterType.String,
      description: "Optional experiment description",
      required: false,
    },
    {
      name: "percentage_included",
      type: ParameterType.Number,
      description: "Percentage of traffic to include (1-100, default: 100)",
      required: false,
    },
    {
      name: "audience_ids",
      type: ParameterType.String,
      description:
        "JSON string array of audience IDs to target (optional, e.g. '[123, 456]')",
      required: false,
    },
    {
      name: "variations",
      type: ParameterType.String,
      description:
        'JSON string array of variation objects with name and weight properties (optional, e.g. \'[{"name":"Variation A","weight":50}]\')',
      required: false,
    },
  ],
})(createExperiment);

// Project Overview Tool - NEW comprehensive overview with rich insights
tool({
  name: "get_project_overview",
  description:
    "Gets a comprehensive overview of an Optimizely Web Experimentation project including all experiments, audiences, events, and pages with rich insights, status breakdowns, and automated analysis. This provides a complete project health dashboard with categorized data and actionable insights.",
  parameters: [
    {
      name: "projectId",
      type: ParameterType.String,
      description:
        "The Optimizely project ID to get the comprehensive overview for",
      required: true,
    },
  ],
})(getProjectOverview);

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
