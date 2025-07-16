import {
  ToolsService,
  tool,
  ParameterType,
} from "@optimizely-opal/opal-tools-sdk";
import express from "express";
import dotenv from "dotenv";
import { estimateRunTimeDays } from "./calculate-runtime";

dotenv.config();

const app = express();
app.use(express.json()); // Add JSON middleware

const toolsService = new ToolsService(app);
const bearerToken = process.env.BEARER_TOKEN;

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
