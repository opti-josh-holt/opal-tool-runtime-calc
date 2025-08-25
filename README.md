This repository provides a complete, working example of an Optimizely Opal tool. It is built with TypeScript and Express.js, designed for serverless deployment on Vercel, and secured with bearer token authentication.

## Features

- **Opal Tools:** Implements multiple tools using the `@optimizely-opal/opal-tools-sdk`:
  - Runtime calculator for experiment duration estimation
  - Markdown to PDF converter with temporary file serving
  - JIRA integration tools for reading, updating, and creating issues
  - Confluence integration tools for reading, updating, and creating pages
  - **Optimizely Web Experimentation tools** for comprehensive project management:
    - Project overview with rich insights and statistics
    - Experiment management (list, get details, create, get results)
    - Audience management (list, get details)
    - Event management (list, get details)
    - Page management (list, get details)
- **Express.js Server:** A lightweight server to host the tool.
- **TypeScript:** Type-safe code for better maintainability.
- **Bearer Token Authentication:** Secures the tool's execution endpoint.
- **Vercel Ready:** Configured for deployment to Vercel.

## Key Learnings from Building This Tool

This sample project was built to codify several key lessons learned during development:

1.  **Vercel Deployment:** Vercel requires a specific project structure for serverless functions. All backend code must reside in an `/api` directory.
2.  **Selective Authentication:** A common pitfall is applying authentication middleware globally. This breaks the public `/discovery` endpoint that Opal relies on. Authentication must be applied _only_ to the specific tool execution route (e.g., `/tools/calculate_experiment_runtime`).
3.  **Rich Data Aggregation:** The Optimizely project overview tool demonstrates how to transform basic API responses into comprehensive, well-structured data that provides immediate insights and actionable information for users.

## Project Structure

The project follows the structure required by Vercel for serverless Node.js functions:

```
/
├── api/
│   └── index.ts      # Main application logic, Express app, and tool definitions
│   └── calculate-runtime.ts      # Runtime calculation logic
│   └── generate-pdf.ts      # PDF generation and cleanup logic
│   └── jira-client.ts      # JIRA API client with PAT authentication
│   └── jira-tools.ts       # JIRA business logic (read/update/create issues)
│   └── confluence-client.ts      # Confluence API client with PAT authentication
│   └── confluence-tools.ts       # Confluence business logic (read/update/create pages)
│   └── optimizely-client.ts      # Optimizely Web API client with rate limiting
│   └── optimizely-tools.ts       # Optimizely business logic (experiments, audiences, events, pages)
│   └── optimizely-types.ts       # TypeScript types for Optimizely API responses
├── .gitignore
├── package.json
├── README.md
├── tsconfig.json
└── vercel.json         # Vercel deployment configuration
```

- `api/index.ts`: The entry point for the Vercel serverless function. It contains the Express server setup, tool definitions, PDF file serving, and authentication middleware.
- `api/calculate-runtime.ts`: Contains the runtime calculation algorithm for experiment duration estimation.
- `api/generate-pdf.ts`: Handles markdown-to-PDF conversion using `md-to-pdf` and automatic cleanup of temporary files.
- `api/jira-client.ts`: HTTP client for JIRA Server API with Personal Access Token authentication.
- `api/jira-tools.ts`: Business logic for JIRA operations (read, update, create issues).
- `api/confluence-client.ts`: HTTP client for Confluence Server API with Personal Access Token authentication.
- `api/confluence-tools.ts`: Business logic for Confluence operations (read, update, create pages).
- `api/optimizely-client.ts`: HTTP client for Optimizely Web Experimentation API with rate limiting and error handling.
- `api/optimizely-tools.ts`: Business logic for Optimizely operations including comprehensive project overview.
- `api/optimizely-types.ts`: TypeScript type definitions for Optimizely API requests and responses.
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
    JIRA_PAT="your-jira-personal-access-token"
    CONFLUENCE_PAT="your-confluence-personal-access-token"
    OPTIMIZELY_API_TOKEN="your-optimizely-api-token"
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
      - `JIRA_PAT`: Your JIRA Personal Access Token for API authentication
      - `CONFLUENCE_PAT`: Your Confluence Personal Access Token for API authentication
      - `OPTIMIZELY_API_TOKEN`: Your Optimizely Web Experimentation API token
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

All tools are protected by bearer token authentication.

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

#### JIRA Integration Tools

**Read JIRA Issue:**

- **URL:** `https://<your-project-name>.vercel.app/tools/read_jira_issue`
- **Method:** `POST`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <your-secret-token-here>`
- **Body (Example):**
  ```json
  {
    "issueKey": "PROJ-123"
  }
  ```

**Update JIRA Issue:**

- **URL:** `https://<your-project-name>.vercel.app/tools/update_jira_issue`
- **Method:** `POST`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <your-secret-token-here>`
- **Body (Example):**
  ```json
  {
    "issueKey": "PROJ-123",
    "fields": {
      "summary": "Updated issue title",
      "description": "Updated description"
    }
  }
  ```

**Create JIRA Issue:**

- **URL:** `https://<your-project-name>.vercel.app/tools/create_jira_issue`
- **Method:** `POST`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <your-secret-token-here>`
- **Body (Example):**
  ```json
  {
    "project": "PROJ",
    "issueType": "Task",
    "summary": "New issue title",
    "description": "Issue description",
    "assignee": "username"
  }
  ```

#### Confluence Integration Tools

**Read Confluence Page:**

- **URL:** `https://<your-project-name>.vercel.app/tools/read_confluence_page`
- **Method:** `POST`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <your-secret-token-here>`
- **Body (Example - by page ID):**
  ```json
  {
    "pageId": "123456789"
  }
  ```
- **Body (Example - by space and title):**
  ```json
  {
    "spaceKey": "TEAM",
    "title": "Page Title"
  }
  ```

**Update Confluence Page:**

- **URL:** `https://<your-project-name>.vercel.app/tools/update_confluence_page`
- **Method:** `POST`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <your-secret-token-here>`
- **Body (Example):**
  ```json
  {
    "pageId": "123456789",
    "content": "<p>Updated page content in Confluence storage format</p>",
    "title": "Updated Page Title"
  }
  ```

**Create Confluence Page:**

- **URL:** `https://<your-project-name>.vercel.app/tools/create_confluence_page`
- **Method:** `POST`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <your-secret-token-here>`
- **Body (Example):**
  ```json
  {
    "spaceKey": "TEAM",
    "title": "New Page Title",
    "content": "<p>New page content in Confluence storage format</p>",
    "parentPageId": "987654321"
  }
  ```

#### Optimizely Web Experimentation Tools

The application provides comprehensive tools for managing Optimizely Web Experimentation projects:

**Project Overview (NEW!):**

- **URL:** `https://<your-project-name>.vercel.app/tools/get_project_overview`
- **Method:** `POST`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <your-secret-token-here>`
- **Body (Example):**
  ```json
  {
    "projectId": "20492164952"
  }
  ```
- **Response:** Rich project overview with:
  - Summary statistics and insights
  - Experiments grouped by status (running, concluded, archived, etc.)
  - Audience targeting breakdown
  - Event categorization (click, pageview, custom)
  - Popular testing domains
  - Automated project health insights

**List Experiments:**

- **URL:** `https://<your-project-name>.vercel.app/tools/list_experiments`
- **Method:** `POST`
- **Body (Example):**
  ```json
  {
    "projectId": "20492164952",
    "status": "running",
    "per_page": 50
  }
  ```

**Get Experiment Details:**

- **URL:** `https://<your-project-name>.vercel.app/tools/get_experiment`
- **Method:** `POST`
- **Body (Example):**
  ```json
  {
    "projectId": "20492164952",
    "experimentId": "20502780186"
  }
  ```

**Get Experiment Results:**

- **URL:** `https://<your-project-name>.vercel.app/tools/get_experiment_results`
- **Method:** `POST`
- **Body (Example):**
  ```json
  {
    "projectId": "20492164952",
    "experimentId": "20502780186"
  }
  ```

**Create Experiment:**

- **URL:** `https://<your-project-name>.vercel.app/tools/create_experiment`
- **Method:** `POST`
- **Body (Example):**
  ```json
  {
    "projectId": "20492164952",
    "name": "New Homepage Test",
    "description": "Testing new homepage layout",
    "percentage_included": 100,
    "audience_ids": "[20520700921]",
    "variations": "[{\"name\":\"Original\",\"weight\":50},{\"name\":\"Variation 1\",\"weight\":50}]"
  }
  ```

**List Audiences:**

- **URL:** `https://<your-project-name>.vercel.app/tools/list_audiences`
- **Method:** `POST`
- **Body (Example):**
  ```json
  {
    "projectId": "20492164952",
    "archived": false
  }
  ```

**Get Audience Details:**

- **URL:** `https://<your-project-name>.vercel.app/tools/get_audience`
- **Method:** `POST`
- **Body (Example):**
  ```json
  {
    "projectId": "20492164952",
    "audienceId": "20520700921"
  }
  ```

**List Events:**

- **URL:** `https://<your-project-name>.vercel.app/tools/list_events`
- **Method:** `POST`
- **Body (Example):**
  ```json
  {
    "projectId": "20492164952",
    "archived": false
  }
  ```

**Get Event Details:**

- **URL:** `https://<your-project-name>.vercel.app/tools/get_event`
- **Method:** `POST`
- **Body (Example):**
  ```json
  {
    "projectId": "20492164952",
    "eventId": "20903330067"
  }
  ```

**List Pages:**

- **URL:** `https://<your-project-name>.vercel.app/tools/list_pages`
- **Method:** `POST`
- **Body (Example):**
  ```json
  {
    "projectId": "20492164952",
    "archived": false
  }
  ```

**Get Page Details:**

- **URL:** `https://<your-project-name>.vercel.app/tools/get_page`
- **Method:** `POST`
- **Body (Example):**
  ```json
  {
    "projectId": "20492164952",
    "pageId": "20511412315"
  }
  ```

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

**Optimizely Project Overview:**

```bash
curl --request POST \
  --url 'https://<your-project-name>.vercel.app/tools/get_project_overview' \
  --header 'Authorization: Bearer your-secret-token-here' \
  --header 'Content-Type: application/json' \
  --data '{
    "projectId": "20492164952"
  }'
```

**List Optimizely Experiments:**

```bash
curl --request POST \
  --url 'https://<your-project-name>.vercel.app/tools/list_experiments' \
  --header 'Authorization: Bearer your-secret-token-here' \
  --header 'Content-Type: application/json' \
  --data '{
    "projectId": "20492164952",
    "status": "running"
  }'
```
