This repository provides a complete, working example of an Optimizely Opal tool. It is built with TypeScript and Express.js, designed for serverless deployment on Vercel, and secured with bearer token authentication.

## Features

- **Opal Tools:** Implements multiple tools using the `@optimizely-opal/opal-tools-sdk`:
  - Runtime calculator for experiment duration estimation
  - Markdown to PDF converter with temporary file serving
- **Express.js Server:** A lightweight server to host the tool.
- **TypeScript:** Type-safe code for better maintainability.
- **Bearer Token Authentication:** Secures the tool's execution endpoint.
- **Vercel Ready:** Configured for deployment to Vercel.

## Key Learnings from Building This Tool

This sample project was built to codify several key lessons learned during development:

1.  **Vercel Deployment:** Vercel requires a specific project structure for serverless functions. All backend code must reside in an `/api` directory.
2.  **Selective Authentication:** A common pitfall is applying authentication middleware globally. This breaks the public `/discovery` endpoint that Opal relies on. Authentication must be applied _only_ to the specific tool execution route (e.g., `/tools/calculate_experiment_runtime`).

## Project Structure

The project follows the structure required by Vercel for serverless Node.js functions:

```
/
├── api/
│   └── index.ts      # Main application logic, Express app, and tool definitions
│   └── calculate-runtime.ts      # Runtime calculation logic
│   └── generate-pdf.ts      # PDF generation and cleanup logic
├── .gitignore
├── package.json
├── README.md
├── tsconfig.json
└── vercel.json         # Vercel deployment configuration
```

- `api/index.ts`: The entry point for the Vercel serverless function. It contains the Express server setup, tool definitions, PDF file serving, and authentication middleware.
- `api/calculate-runtime.ts`: Contains the runtime calculation algorithm for experiment duration estimation.
- `api/generate-pdf.ts`: Handles markdown-to-PDF conversion using `md-to-pdf` and automatic cleanup of temporary files.
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
    Create a `.env` file in the root of the project. This file is ignored by Git. Add your configuration:

    ```
    # .env
    BEARER_TOKEN="your-secret-token-here"
    BASE_URL="https://your-project-name.vercel.app"
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
    - Add these environment variables:
      - `BEARER_TOKEN`: The value you want to use for production authentication (keep this secret!)
      - `BASE_URL`: Your full Vercel app URL (e.g., `https://your-project-name.vercel.app`)
    - **Important:** Ensure the bearer token is strong and kept secret.

4.  **Deploy:**
    Vercel will automatically trigger a deployment. After a few moments, your tool will be live!

## Configuring the Tool in Optimizely

Once your tool is deployed, you need to register it with Optimizely's Opal UI.

1.  Navigate to the Opal tools section in your Optimizely account: [https://opal.optimizely.com/tools](https://opal.optimizely.com/tools)

2.  Click the **Add tool registry** button in the top-right corner.
    <img width="1273" height="501" alt="image" src="https://github.com/user-attachments/assets/9deaa999-6993-4b8e-80cc-090636b818b6" />

3.  Fill in the form with the following details:

    - **Registry Name:** A descriptive name for your tool registry. Conventionally, this is in `snake_case` (e.g., `experiment_runtime_calculation`).
    - **Discovery URL:** The URL to your deployed tool's discovery endpoint. For this project, it is `https://opal-tool-runtime-calc.vercel.app/discovery`.
    - **Bearer Token (Optional):** Enter the same secret token you configured as an environment variable in Vercel. This is required to authorize requests to the secure execution endpoint.

    <img width="812" height="501" alt="image" src="https://github.com/user-attachments/assets/d8927549-b9a8-4052-b080-847e611f968f" />

4.  Click **Save**. Your tool will now appear in your list of tools and be available for use within Opal.

## Using the Deployed Tools

Your deployed application provides multiple Opal tools with these endpoints:

### 1. Discovery Endpoint (Public)

Opal uses this endpoint to find your tool and learn about its parameters. It is not authenticated.

- **URL:** `https://<your-project-name>.vercel.app/discovery`
- **Method:** `GET`

You can open this URL in your browser to see all available tools and their JSON manifests.

### 2. Tool Execution Endpoints (Secured)

Both tools are protected by bearer token authentication.

#### Runtime Calculator Tool

- **URL:** `https://<your-project-name>.vercel.app/tools/calculate_experiment_runtime`
- **Method:** `POST`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <your-secret-token-here>`
- **Body (Example):**
  ```json
  {
    "BCR": 0.2,
    "MDE": 0.01,
    "sigLevel": 95,
    "numVariations": 2,
    "dailyVisitors": 5000
  }
  ```

#### PDF Generator Tool

- **URL:** `https://<your-project-name>.vercel.app/tools/generate_pdf_from_markdown`
- **Method:** `POST`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <your-secret-token-here>`
- **Body (Example):**
  ````json
  {
    "markdown": "# My Document\n\nThis is **bold** text and *italic* text.\n\n## Code Example\n\n```javascript\nconsole.log('Hello World');\n```",
    "filename": "my-document"
  }
  ````
- **Response:**
  ```json
  {
    "pdfUrl": "https://your-project-name.vercel.app/pdfs/my-document.pdf",
    "expiresAt": "2024-01-01T12:00:00.000Z"
  }
  ```

**Notes:** 
- Generated PDFs are automatically cleaned up after 1 hour for now.
- The `pdfUrl` returns a full absolute URL to ensure it works properly with Opal.

#### Example `curl` Requests

**Runtime Calculator:**

```bash
curl --request POST \
  --url 'https://<your-project-name>.vercel.app/tools/calculate_experiment_runtime' \
  --header 'Authorization: Bearer your-secret-token-here' \
  --header 'Content-Type: application/json' \
  --data '{
    "BCR": 0.2,
    "MDE": 0.01,
    "sigLevel": 95,
    "numVariations": 2,
    "dailyVisitors": 10000
  }'
```

**PDF Generator:**

```bash
curl --request POST \
  --url 'https://<your-project-name>.vercel.app/tools/generate_pdf_from_markdown' \
  --header 'Authorization: Bearer your-secret-token-here' \
  --header 'Content-Type: application/json' \
  --data '{
    "markdown": "# Test Document\n\nThis is a **test** PDF generation.",
    "filename": "test-document"
  }'
```
