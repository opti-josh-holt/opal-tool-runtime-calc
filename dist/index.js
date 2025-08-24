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
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json()); // Add JSON middleware
// Serve PDFs from /tmp directory
app.use('/pdfs', express_1.default.static('/tmp', {
    setHeaders: (res, path) => {
        if (path.endsWith('.pdf')) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline');
        }
    }
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
    const days = (0, calculate_runtime_1.estimateRunTimeDays)(BCR, MDE, sigLevel, numVariations, dailyVisitors);
    return { days };
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
