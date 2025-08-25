"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const opal_tools_sdk_1 = require("@optimizely-opal/opal-tools-sdk");
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const calculate_runtime_1 = require("./calculate-runtime");
const generate_pdf_1 = require("./generate-pdf");
const jira_tools_1 = require("./jira-tools");
const confluence_tools_1 = require("./confluence-tools");
// Optimizely Web Experimentation Tools
const optimizely_tools_1 = require("./optimizely-tools");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json()); // Add JSON middleware
// Serve PDFs from /tmp directory
app.use("/pdfs", express_1.default.static("/tmp", {
    setHeaders: (res, path) => {
        if (path.endsWith(".pdf")) {
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", "inline");
        }
    },
}));
const toolsService = new opal_tools_sdk_1.ToolsService(app);
const bearerToken = process.env.BEARER_TOKEN;
// Run cleanup every hour
setInterval(() => {
    (0, generate_pdf_1.cleanupExpiredPdfs)().catch(() => {
        // Cleanup is best effort, don't crash the server
    });
}, 60 * 60 * 1000); // 1 hour in milliseconds
// Add a root route to provide a status message.
app.get("/", (req, res) => {
    res.send("Opal tool server is running. Visit /discovery for tool discovery.");
});
async function calculateRuntime(params) {
    const { BCR, MDE, sigLevel, numVariations, dailyVisitors } = params;
    try {
        const days = (0, calculate_runtime_1.estimateRunTimeDays)(BCR, MDE, sigLevel, numVariations, dailyVisitors);
        return { days };
    }
    catch (error) {
        if (error instanceof calculate_runtime_1.CalculationError) {
            // Provide detailed error context for runtime calculations
            if (error.code === 'INVALID_BCR') {
                throw new Error(`Invalid Baseline Conversion Rate: ${error.message} The BCR represents your current conversion rate as a decimal (e.g., 0.05 for 5%). Please check your analytics data and provide the correct conversion rate.`);
            }
            else if (error.code === 'INVALID_MDE') {
                throw new Error(`Invalid Minimum Detectable Effect: ${error.message} The MDE represents the relative improvement you want to detect (e.g., 0.10 for a 10% improvement). Consider what meaningful business impact you want to measure.`);
            }
            else if (error.code === 'INVALID_SIGNIFICANCE_LEVEL') {
                throw new Error(`Invalid Statistical Significance Level: ${error.message} This determines how confident you want to be in your results. Common values are 90, 95, or 99. Higher values require longer tests.`);
            }
            else if (error.code === 'INVALID_NUM_VARIATIONS') {
                throw new Error(`Invalid Number of Variations: ${error.message} For a simple A/B test, use 2 (control + one variation). For A/B/C testing, use 3, and so on.`);
            }
            else if (error.code === 'INVALID_DAILY_VISITORS') {
                throw new Error(`Invalid Daily Visitors: ${error.message} This should be the number of unique visitors per day who will see your experiment. Check your website analytics for accurate traffic numbers.`);
            }
            else if (error.code === 'MDE_TOO_LARGE') {
                throw new Error(`Minimum Detectable Effect is too large: ${error.message} Your MDE would result in a negative conversion rate. Try reducing the MDE to a more realistic value, or verify your BCR is correct.`);
            }
            else if (error.code === 'DURATION_TOO_LONG') {
                throw new Error(`Experiment duration too long: ${error.message} To reduce the duration, you can: 1) Increase the MDE (detect larger effects), 2) Lower the significance level (accept more uncertainty), or 3) Get more daily traffic to the test.`);
            }
            throw new Error(`Runtime calculation error: ${error.message}`);
        }
        throw new Error(`Unexpected error calculating experiment runtime: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}
async function generatePdf(params) {
    return await (0, generate_pdf_1.generatePdfFromMarkdown)(params);
}
(0, opal_tools_sdk_1.tool)({
    name: "calculate_experiment_runtime",
    description: "Calculates the estimated time to run an experiment.",
    parameters: [
        {
            name: "BCR",
            type: opal_tools_sdk_1.ParameterType.Number,
            description: "The conversion rate of the control group (e.g., 0.1 for 10%)",
            required: true,
        },
        {
            name: "MDE",
            type: opal_tools_sdk_1.ParameterType.Number,
            description: "The relative lift you want to detect (e.g., 0.05 for 5%)",
            required: true,
        },
        {
            name: "sigLevel",
            type: opal_tools_sdk_1.ParameterType.Number,
            description: "The desired statistical significance (e.g., 95 for 95%)",
            required: true,
        },
        {
            name: "numVariations",
            type: opal_tools_sdk_1.ParameterType.Number,
            description: "The total number of variations, including control",
            required: true,
        },
        {
            name: "dailyVisitors",
            type: opal_tools_sdk_1.ParameterType.Number,
            description: "The number of visitors per day participating in the experiment",
            required: true,
        },
    ],
})(calculateRuntime);
(0, opal_tools_sdk_1.tool)({
    name: "generate_pdf_from_markdown",
    description: "Converts markdown text to a PDF document and returns a download URL.",
    parameters: [
        {
            name: "markdown",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The markdown content to convert to PDF",
            required: true,
        },
        {
            name: "filename",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "Optional custom filename for the PDF (without .pdf extension)",
            required: false,
        },
    ],
})(generatePdf);
(0, opal_tools_sdk_1.tool)({
    name: "read_jira_issue",
    description: "Reads a Jira issue by its key and returns the issue details.",
    parameters: [
        {
            name: "issueKey",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The Jira issue key (e.g., 'PROJ-123')",
            required: true,
        },
    ],
})(jira_tools_1.readJiraIssue);
(0, opal_tools_sdk_1.tool)({
    name: "update_jira_issue",
    description: "Updates a Jira issue with new field values.",
    parameters: [
        {
            name: "issueKey",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The Jira issue key (e.g., 'PROJ-123')",
            required: true,
        },
        {
            name: "fields",
            type: opal_tools_sdk_1.ParameterType.Dictionary,
            description: "Object containing field updates (e.g., {summary: 'New title', description: 'New description'})",
            required: true,
        },
    ],
})(jira_tools_1.updateJiraIssue);
(0, opal_tools_sdk_1.tool)({
    name: "create_jira_issue",
    description: "Creates a new Jira issue in the specified project.",
    parameters: [
        {
            name: "project",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The project key where the issue should be created",
            required: true,
        },
        {
            name: "issueType",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The type of issue to create (e.g., 'Bug', 'Task', 'Story')",
            required: true,
        },
        {
            name: "summary",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The issue summary/title",
            required: true,
        },
        {
            name: "description",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "Optional issue description",
            required: false,
        },
        {
            name: "assignee",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "Optional assignee username",
            required: false,
        },
        {
            name: "additionalFields",
            type: opal_tools_sdk_1.ParameterType.Dictionary,
            description: "Optional additional fields to set on the issue",
            required: false,
        },
    ],
})(jira_tools_1.createJiraIssue);
(0, opal_tools_sdk_1.tool)({
    name: "read_confluence_page",
    description: "Reads a Confluence page by ID or by space and title.",
    parameters: [
        {
            name: "pageId",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The Confluence page ID",
            required: false,
        },
        {
            name: "spaceKey",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The space key (required if using title)",
            required: false,
        },
        {
            name: "title",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The page title (required if using spaceKey)",
            required: false,
        },
    ],
})(confluence_tools_1.readConfluencePage);
(0, opal_tools_sdk_1.tool)({
    name: "update_confluence_page",
    description: "Updates a Confluence page with new content.",
    parameters: [
        {
            name: "pageId",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The Confluence page ID",
            required: true,
        },
        {
            name: "title",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "Optional new title for the page",
            required: false,
        },
        {
            name: "content",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The new page content in Markdown format (automatically converted to Confluence storage format)",
            required: true,
        },
    ],
})(confluence_tools_1.updateConfluencePage);
(0, opal_tools_sdk_1.tool)({
    name: "create_confluence_page",
    description: "Creates a new Confluence page in the specified space.",
    parameters: [
        {
            name: "spaceKey",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The space key where the page should be created",
            required: true,
        },
        {
            name: "title",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The page title",
            required: true,
        },
        {
            name: "content",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The page content in Markdown format (automatically converted to Confluence storage format)",
            required: true,
        },
        {
            name: "parentPageId",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "Optional parent page ID to create as a child page",
            required: false,
        },
    ],
})(confluence_tools_1.createConfluencePage);
// Optimizely Web Experimentation Tools
(0, opal_tools_sdk_1.tool)({
    name: "list_experiments",
    description: "Lists all experiments in an Optimizely Web Experimentation project with readable formatting.",
    parameters: [
        {
            name: "projectId",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The Optimizely project ID",
            required: true,
        },
        {
            name: "page",
            type: opal_tools_sdk_1.ParameterType.Number,
            description: "Page number for pagination (optional)",
            required: false,
        },
        {
            name: "per_page",
            type: opal_tools_sdk_1.ParameterType.Number,
            description: "Number of results per page (default: 50, max: 100)",
            required: false,
        },
    ],
})(optimizely_tools_1.listExperiments);
(0, opal_tools_sdk_1.tool)({
    name: "get_experiment",
    description: "Gets detailed information about a specific experiment including variations, audiences, and metrics. You can specify either the experiment ID or the experiment name.",
    parameters: [
        {
            name: "projectId",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The Optimizely project ID",
            required: true,
        },
        {
            name: "experimentId",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The experiment ID to retrieve (optional if experimentName is provided)",
            required: false,
        },
        {
            name: "experimentName",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The experiment name to retrieve (optional if experimentId is provided)",
            required: false,
        },
    ],
})(optimizely_tools_1.getExperiment);
(0, opal_tools_sdk_1.tool)({
    name: "get_experiment_results",
    description: "Gets experiment results with statistical analysis including conversion rates, confidence levels, and winning variations.",
    parameters: [
        {
            name: "projectId",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The Optimizely project ID",
            required: true,
        },
        {
            name: "experimentId",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The experiment ID to get results for",
            required: true,
        },
    ],
})(optimizely_tools_1.getExperimentResults);
(0, opal_tools_sdk_1.tool)({
    name: "list_audiences",
    description: "Lists all audiences in an Optimizely Web Experimentation project with readable formatting.",
    parameters: [
        {
            name: "projectId",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The Optimizely project ID",
            required: true,
        },
        {
            name: "archived",
            type: opal_tools_sdk_1.ParameterType.Boolean,
            description: "Filter by archived status (optional)",
            required: false,
        },
        {
            name: "page",
            type: opal_tools_sdk_1.ParameterType.Number,
            description: "Page number for pagination (optional)",
            required: false,
        },
        {
            name: "per_page",
            type: opal_tools_sdk_1.ParameterType.Number,
            description: "Number of results per page (default: 50, max: 100)",
            required: false,
        },
    ],
})(optimizely_tools_1.listAudiences);
(0, opal_tools_sdk_1.tool)({
    name: "get_audience",
    description: "Gets detailed information about a specific audience including conditions and segmentation settings. You can specify either the audience ID or the audience name.",
    parameters: [
        {
            name: "projectId",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The Optimizely project ID",
            required: true,
        },
        {
            name: "audienceId",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The audience ID to retrieve (optional if audienceName is provided)",
            required: false,
        },
        {
            name: "audienceName",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The audience name to retrieve (optional if audienceId is provided)",
            required: false,
        },
    ],
})(optimizely_tools_1.getAudience);
(0, opal_tools_sdk_1.tool)({
    name: "list_pages",
    description: "Lists all pages in an Optimizely Web Experimentation project with readable formatting.",
    parameters: [
        {
            name: "projectId",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The Optimizely project ID",
            required: true,
        },
        {
            name: "archived",
            type: opal_tools_sdk_1.ParameterType.Boolean,
            description: "Filter by archived status (optional)",
            required: false,
        },
        {
            name: "page",
            type: opal_tools_sdk_1.ParameterType.Number,
            description: "Page number for pagination (optional)",
            required: false,
        },
        {
            name: "per_page",
            type: opal_tools_sdk_1.ParameterType.Number,
            description: "Number of results per page (default: 50, max: 100)",
            required: false,
        },
    ],
})(optimizely_tools_1.listPages);
(0, opal_tools_sdk_1.tool)({
    name: "get_page",
    description: "Gets detailed information about a specific page including conditions and targeting settings. You can specify either the page ID or the page name.",
    parameters: [
        {
            name: "projectId",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The Optimizely project ID",
            required: true,
        },
        {
            name: "pageId",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The page ID to retrieve (optional if pageName is provided)",
            required: false,
        },
        {
            name: "pageName",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The page name to retrieve (optional if pageId is provided)",
            required: false,
        },
    ],
})(optimizely_tools_1.getPage);
(0, opal_tools_sdk_1.tool)({
    name: "list_events",
    description: "Lists all events in an Optimizely Web Experimentation project with readable formatting.",
    parameters: [
        {
            name: "projectId",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The Optimizely project ID",
            required: true,
        },
        {
            name: "archived",
            type: opal_tools_sdk_1.ParameterType.Boolean,
            description: "Filter by archived status (optional)",
            required: false,
        },
        {
            name: "page",
            type: opal_tools_sdk_1.ParameterType.Number,
            description: "Page number for pagination (optional)",
            required: false,
        },
        {
            name: "per_page",
            type: opal_tools_sdk_1.ParameterType.Number,
            description: "Number of results per page (default: 50, max: 100)",
            required: false,
        },
    ],
})(optimizely_tools_1.listEvents);
(0, opal_tools_sdk_1.tool)({
    name: "get_event",
    description: "Gets detailed information about a specific event including event type and tracking configuration. You can specify either the event ID or the event name.",
    parameters: [
        {
            name: "projectId",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The Optimizely project ID",
            required: true,
        },
        {
            name: "eventId",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The event ID to retrieve (optional if eventName is provided)",
            required: false,
        },
        {
            name: "eventName",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The event name to retrieve (optional if eventId is provided)",
            required: false,
        },
    ],
})(optimizely_tools_1.getEvent);
(0, opal_tools_sdk_1.tool)({
    name: "create_experiment",
    description: "Creates a new experiment in an Optimizely Web Experimentation project (demo purposes).",
    parameters: [
        {
            name: "projectId",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The Optimizely project ID",
            required: true,
        },
        {
            name: "name",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The experiment name",
            required: true,
        },
        {
            name: "description",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "Optional experiment description",
            required: false,
        },
        {
            name: "percentage_included",
            type: opal_tools_sdk_1.ParameterType.Number,
            description: "Percentage of traffic to include (1-100, default: 100)",
            required: false,
        },
        {
            name: "audience_ids",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "JSON string array of audience IDs to target (optional, e.g. '[123, 456]')",
            required: false,
        },
        {
            name: "variations",
            type: opal_tools_sdk_1.ParameterType.String,
            description: 'JSON string array of variation objects with name and weight properties (optional, e.g. \'[{"name":"Variation A","weight":50}]\')',
            required: false,
        },
    ],
})(optimizely_tools_1.createExperiment);
// Project Overview Tool - NEW comprehensive overview with rich insights
(0, opal_tools_sdk_1.tool)({
    name: "get_project_overview",
    description: "Gets a comprehensive overview of an Optimizely Web Experimentation project including all experiments, audiences, events, and pages with rich insights, status breakdowns, and automated analysis. This provides a complete project health dashboard with categorized data and actionable insights.",
    parameters: [
        {
            name: "projectId",
            type: opal_tools_sdk_1.ParameterType.String,
            description: "The Optimizely project ID to get the comprehensive overview for",
            required: true,
        },
    ],
})(optimizely_tools_1.getProjectOverview);
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
exports.default = app;
