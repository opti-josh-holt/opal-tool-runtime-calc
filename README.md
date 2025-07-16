# Opal Tool Sample: Experiment Runtime Calculator

This repository provides a complete, working example of an Optimizely Opal tool. It is built with TypeScript and Express.js, designed for serverless deployment on Vercel, and secured with bearer token authentication.

## Features

- **Opal Tool:** Implements a runtime calculator using the `@optimizely-opal/opal-tools-sdk`.
- **Express.js Server:** A lightweight server to host the tool.
- **TypeScript:** Type-safe code for better maintainability.
- **Bearer Token Authentication:** Secures the tool's execution endpoint.
- **Vercel Ready:** Configured for deployment to Vercel.

## Key Learnings from Building This Tool

This sample project was built to codify several key lessons learned during development:

1.  **Vercel Deployment:** Vercel requires a specific project structure for serverless functions. All backend code must reside in an `/api` directory.
2.  **Opal SDK Usage:** The idiomatic way to define a tool is with the `@tool` decorator. This is simpler than manual registration and correctly sets up the necessary routes.
3.  **Selective Authentication:** A common pitfall is applying authentication middleware globally. This breaks the public `/discovery` endpoint that Opal relies on. Authentication must be applied _only_ to the specific tool execution route (e.g., `/tools/calculate_experiment_runtime`).

## Project Structure

The project follows the structure required by Vercel for serverless Node.js functions:

```
/
├── api/
│   └── index.ts      # Main application logic, Express app, and tool definition
├── .gitignore
├── package.json
├── README.md
├── tsconfig.json
└── vercel.json         # Vercel deployment configuration
```

- `api/index.ts`: The entry point for the Vercel serverless function. It contains the Express server setup, tool definition, and authentication middleware.
- `vercel.json`: Configures Vercel to correctly handle the Express application as a single serverless function.

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- A Vercel account
- [Vercel CLI](https://vercel.com/docs/cli) (for local development)

### Local Development

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-github-username/runtime-calc-tool.git
    cd runtime-calc-tool
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root of the project. This file is ignored by Git. Add your desired bearer token:

    ```
    # .env
    BEARER_TOKEN="your-secret-token-here"
    ```

4.  **Run the development server:**
    Use the Vercel CLI to run the app locally. This accurately simulates the Vercel production environment.
    ```bash
    vercel dev
    ```
    The server will start, typically on `http://localhost:3000`.

## Deployment to Vercel

1.  **Push to a Git Repository:**
    Push the project to your own GitHub, GitLab, or Bitbucket repository.

2.  **Create a Vercel Project:**

    - Log in to your Vercel dashboard.
    - Click "Add New..." -> "Project".
    - Import the Git repository you just created.
    - Vercel will automatically detect the framework and use the settings in `vercel.json`.

3.  **Configure Environment Variables:**

    - In your new Vercel project's settings, navigate to the "Environment Variables" section.
    - Add a new variable with the key `BEARER_TOKEN` and the value you want to use for production.
    - **Important:** Ensure this token is strong and kept secret.

4.  **Deploy:**
    Vercel will automatically trigger a deployment. After a few moments, your tool will be live!

## Configuring the Tool in Optimizely

Once your tool is deployed, you need to register it with Optimizely's Opal UI.

1.  Navigate to the Opal tools section in your Optimizely account: [https://opal.optimizely.com/tools](https://opal.optimizely.com/tools)

2.  Click the **Add tool registry** button in the top-right corner.

3.  Fill in the form with the following details:

    - **Registry Name:** A descriptive name for your tool registry. Conventionally, this is in `snake_case` (e.g., `experiment_runtime_calculation`).
    - **Discovery URL:** The URL to your deployed tool's discovery endpoint. For this project, it is `https://opal-tool-runtime-calc.vercel.app/discovery`.
    - **Bearer Token (Optional):** Enter the same secret token you configured as an environment variable in Vercel. This is required to authorize requests to the secure execution endpoint.

4.  Click **Save**. Your tool will now appear in your list of tools and be available for use within Opal.

## Using the Deployed Tool

Your tool has two main endpoints:

### 1. Discovery Endpoint (Public)

Opal uses this endpoint to find your tool and learn about its parameters. It is not authenticated.

- **URL:** `https://<your-project-name>.vercel.app/discovery`
- **Method:** `GET`

You can open this URL in your browser to see the tool's JSON manifest.

### 2. Execution Endpoint (Secured)

This is the endpoint you call to run the tool. It is protected by bearer token authentication.

- **URL:** `https://<your-project-name>.vercel.app/tools/calculate_experiment_runtime`
- **Method:** `POST`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <your-secret-token-here>`
- **Body (Example):**
  ```json
  {
    "mde": 0.01,
    "sigLevel": 95,
    "baseline_conversion_rate": 0.2,
    "traffic_per_day": 5000,
    "variations": 2
  }
  ```

#### Example `curl` Request

```bash
curl --request POST \
  --url 'https://<your-project-name>.vercel.app/tools/calculate_experiment_runtime' \
  --header 'Authorization: Bearer your-secret-token-here' \
  --header 'Content-Type: application/json' \
  --data '{
    "mde": 0.01,
    "baseline_conversion_rate": 0.2,
    "traffic_per_day": 10000,
        "sigLevel": 95,
    "variations": 2
  }'
```

This will return the calculated runtime in days.
