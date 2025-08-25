import {
  getOptimizelyClient,
  OptimizelyClientError,
} from "./optimizely-client";
import type {
  ListExperimentsParams,
  ListAudiencesParams,
  ListPagesParams,
  ListEventsParams,
  GetExperimentParams,
  GetAudienceParams,
  GetPageParams,
  GetEventParams,
  GetExperimentResultsParams,
  CreateExperimentParams,
  FormattedExperimentList,
  FormattedExperiment,
  FormattedAudienceList,
  FormattedAudience,
  FormattedPageList,
  FormattedPage,
  FormattedEventList,
  FormattedEvent,
  FormattedExperimentResults,
  OptimizelyExperiment,
  OptimizelyAudience,
  OptimizelyPage,
  OptimizelyEvent,
  OptimizelyExperimentResults,
} from "./optimizely-types";

/**
 * Utility function to format dates for better readability
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

/**
 * Utility function to safely get project ID as string
 */
function getProjectId(params: { projectId: string }): string {
  if (!params.projectId || typeof params.projectId !== "string") {
    throw new Error("Project ID is required and must be a string");
  }
  return params.projectId;
}

/**
 * List Experiments Tool
 * Returns a formatted list of experiments in a project
 */
export async function listExperiments(
  params: ListExperimentsParams
): Promise<FormattedExperimentList> {
  const projectId = getProjectId(params);
  const client = getOptimizelyClient();

  try {
    // First verify the project exists and is accessible
    console.log(
      `DEBUG: Attempting to list experiments for project ${projectId}`
    );
    try {
      const project = await client.getProject(projectId);
      console.log(
        `DEBUG: Project validation successful - ${project.name} (platform: ${project.platform}, status: ${project.status})`
      );
    } catch (projectError) {
      console.log(`DEBUG: Project validation failed:`, projectError);
      // Continue anyway - the project endpoint might have different permissions
    }

    console.log(
      `DEBUG: Making request to: /experiments?project_id=${projectId}&per_page=${
        params.per_page || 50
      } (no include_classic parameter)`
    );

    const experiments = await client.listExperiments(projectId, {
      page: params.page,
      per_page: params.per_page || 50,
      // Removed include_classic parameter entirely
    });

    return {
      project_id: projectId,
      total_count: experiments.length,
      experiments: experiments.map((exp) => ({
        id: String(exp.id), // Ensure ID is handled as string to prevent precision loss
        name: exp.name,
        status: exp.status,
        type: exp.type,
        created: formatDate(exp.created),
        last_modified: formatDate(exp.last_modified),
        description: exp.description,
        traffic_allocation: exp.traffic_allocation,
        holdback: exp.holdback,
        variations_count: exp.variations?.length || 0,
        campaign_id: exp.campaign_id,
      })),
    };
  } catch (error) {
    if (error instanceof OptimizelyClientError) {
      // Provide more specific error messages based on status code
      if (error.status === 400) {
        throw new Error(
          `Bad request when listing experiments for project ${projectId}. This could indicate: 1) The project ID format is incorrect (should be a numeric string), 2) The project ID doesn't exist, 3) Your API token doesn't have access to this project, or 4) Required parameters are missing or malformed. Please verify the project ID is correct and that your API token has the necessary permissions. API Error: ${
            error.message
          } ${error.details ? `(${JSON.stringify(error.details)})` : ""}`
        );
      } else if (error.status === 404) {
        throw new Error(
          `No experiments found for project ${projectId}. This could mean: 1) The project doesn't have any experiments created yet, 2) The experiments might be organized as campaigns instead, or 3) The experiments endpoint is not available for this project type. The project exists and is accessible (platform: web, active status), but the experiments endpoint returned 404. You may need to create experiments first in the Optimizely Web interface, or this project might use a different API structure.`
        );
      } else if (error.status === 401) {
        throw new Error(
          `Authentication failed. Please check your OPTIMIZELY_API_TOKEN.`
        );
      } else if (error.status === 403) {
        throw new Error(
          `Access forbidden to project ${projectId}. Your API token may not have the required permissions.`
        );
      }
      throw new Error(`Failed to list experiments: ${error.message}`);
    }
    throw new Error(
      `Unexpected error listing experiments: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Get Experiment Tool
 * Returns detailed information about a specific experiment
 */
export async function getExperiment(
  params: GetExperimentParams
): Promise<FormattedExperiment> {
  const projectId = getProjectId(params);
  const { experimentId } = params;

  if (!experimentId || typeof experimentId !== "string") {
    throw new Error("Experiment ID is required and must be a string");
  }

  const client = getOptimizelyClient();

  try {
    console.log(
      `DEBUG: Getting experiment ${experimentId} from project ${projectId}`
    );
    const experiment = await client.getExperiment(projectId, experimentId);

    return {
      id: String(experiment.id), // Ensure experiment ID is string
      name: experiment.name,
      description: experiment.description,
      status: experiment.status,
      type: experiment.type,
      created: formatDate(experiment.created),
      last_modified: formatDate(experiment.last_modified),
      project_id: experiment.project_id,
      traffic_allocation: experiment.traffic_allocation,
      holdback: experiment.holdback,
      campaign_id: experiment.campaign_id,
      allocation_policy: experiment.allocation_policy,
      url_targeting: experiment.url_targeting,
      variations:
        experiment.variations?.map((variation) => ({
          id: variation.variation_id,
          name: variation.name,
          weight: variation.weight,
          archived: variation.archived,
          status: variation.status,
          description: variation.description,
        })) || [],
      audience_conditions: experiment.audience_conditions,
      metrics_count: experiment.metrics?.length || 0,
      page_ids: experiment.page_ids || [],
    };
  } catch (error) {
    if (error instanceof OptimizelyClientError) {
      // Provide more specific error messages based on status code
      if (error.status === 404) {
        throw new Error(
          `Experiment with ID '${experimentId}' not found in project ${projectId}. This could mean: 1) The experiment ID is incorrect or doesn't exist, 2) The experiment has been archived or deleted, 3) Your API token doesn't have access to this specific experiment, or 4) The experiment might be in a different project. Please verify the experiment ID is correct and that it exists in project ${projectId}. API Error: ${
            error.message
          } ${error.details ? `(${JSON.stringify(error.details)})` : ""}`
        );
      } else if (error.status === 401) {
        throw new Error(
          `Authentication failed when getting experiment ${experimentId}. Please check your OPTIMIZELY_API_TOKEN.`
        );
      } else if (error.status === 403) {
        throw new Error(
          `Access forbidden to experiment ${experimentId} in project ${projectId}. Your API token may not have the required permissions.`
        );
      }
      throw new Error(`Failed to get experiment: ${error.message}`);
    }
    throw new Error(
      `Unexpected error getting experiment: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * List Audiences Tool
 * Returns a formatted list of audiences in a project
 */
export async function listAudiences(
  params: ListAudiencesParams
): Promise<FormattedAudienceList> {
  const projectId = getProjectId(params);
  const client = getOptimizelyClient();

  try {
    const audiences = await client.listAudiences(projectId, {
      page: params.page,
      per_page: params.per_page || 50,
      include_classic: true,
    });

    // Filter by archived status if specified
    const filteredAudiences =
      params.archived !== undefined
        ? audiences.filter((aud) => aud.archived === params.archived)
        : audiences;

    return {
      project_id: projectId,
      total_count: filteredAudiences.length,
      audiences: filteredAudiences.map((aud) => ({
        id: aud.id,
        name: aud.name,
        archived: aud.archived,
        created: formatDate(aud.created),
        last_modified: formatDate(aud.last_modified),
        description: aud.description,
      })),
    };
  } catch (error) {
    if (error instanceof OptimizelyClientError) {
      throw new Error(`Failed to list audiences: ${error.message}`);
    }
    throw new Error(
      `Unexpected error listing audiences: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Get Audience Tool
 * Returns detailed information about a specific audience
 */
export async function getAudience(
  params: GetAudienceParams
): Promise<FormattedAudience> {
  const projectId = getProjectId(params);
  const { audienceId } = params;

  if (!audienceId || typeof audienceId !== "string") {
    throw new Error("Audience ID is required and must be a string");
  }

  const client = getOptimizelyClient();

  try {
    const audience = await client.getAudience(projectId, audienceId);

    return {
      id: audience.id,
      name: audience.name,
      description: audience.description,
      archived: audience.archived,
      created: formatDate(audience.created),
      last_modified: formatDate(audience.last_modified),
      project_id: audience.project_id,
      conditions: audience.conditions,
      segmentation: audience.segmentation,
      is_classic: audience.is_classic,
    };
  } catch (error) {
    if (error instanceof OptimizelyClientError) {
      throw new Error(`Failed to get audience: ${error.message}`);
    }
    throw new Error(
      `Unexpected error getting audience: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * List Pages Tool
 * Returns a formatted list of pages in a project
 */
export async function listPages(
  params: ListPagesParams
): Promise<FormattedPageList> {
  const projectId = getProjectId(params);
  const client = getOptimizelyClient();

  try {
    const pages = await client.listPages(projectId, {
      page: params.page,
      per_page: params.per_page || 50,
      include_classic: true,
    });

    // Filter by archived status if specified
    const filteredPages =
      params.archived !== undefined
        ? pages.filter((page) => page.archived === params.archived)
        : pages;

    return {
      project_id: projectId,
      total_count: filteredPages.length,
      pages: filteredPages.map((page) => ({
        id: page.id,
        name: page.name,
        archived: page.archived,
        created: formatDate(page.created),
        last_modified: formatDate(page.last_modified),
        category: page.category,
        page_type: page.page_type,
      })),
    };
  } catch (error) {
    if (error instanceof OptimizelyClientError) {
      throw new Error(`Failed to list pages: ${error.message}`);
    }
    throw new Error(
      `Unexpected error listing pages: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Get Page Tool
 * Returns detailed information about a specific page
 */
export async function getPage(params: GetPageParams): Promise<FormattedPage> {
  const projectId = getProjectId(params);
  const { pageId } = params;

  if (!pageId || typeof pageId !== "string") {
    throw new Error("Page ID is required and must be a string");
  }

  const client = getOptimizelyClient();

  try {
    const page = await client.getPage(projectId, pageId);

    return {
      id: page.id,
      name: page.name,
      archived: page.archived,
      created: formatDate(page.created),
      last_modified: formatDate(page.last_modified),
      project_id: page.project_id,
      category: page.category,
      page_type: page.page_type,
      conditions: page.conditions,
      edit_url: page.edit_url,
      key: page.key,
    };
  } catch (error) {
    if (error instanceof OptimizelyClientError) {
      throw new Error(`Failed to get page: ${error.message}`);
    }
    throw new Error(
      `Unexpected error getting page: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * List Events Tool
 * Returns a formatted list of events in a project
 */
export async function listEvents(
  params: ListEventsParams
): Promise<FormattedEventList> {
  const projectId = getProjectId(params);
  const client = getOptimizelyClient();

  try {
    const events = await client.listEvents(projectId, {
      page: params.page,
      per_page: params.per_page || 50,
      include_classic: true,
    });

    // Filter by archived status if specified
    const filteredEvents =
      params.archived !== undefined
        ? events.filter((event) => event.archived === params.archived)
        : events;

    return {
      project_id: projectId,
      total_count: filteredEvents.length,
      events: filteredEvents.map((event) => ({
        id: event.id,
        name: event.name,
        archived: event.archived,
        created: formatDate(event.created),
        last_modified: formatDate(event.last_modified),
        category: event.category,
        event_type: event.event_type,
      })),
    };
  } catch (error) {
    if (error instanceof OptimizelyClientError) {
      throw new Error(`Failed to list events: ${error.message}`);
    }
    throw new Error(
      `Unexpected error listing events: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Get Event Tool
 * Returns detailed information about a specific event
 */
export async function getEvent(
  params: GetEventParams
): Promise<FormattedEvent> {
  const projectId = getProjectId(params);
  const { eventId } = params;

  if (!eventId || typeof eventId !== "string") {
    throw new Error("Event ID is required and must be a string");
  }

  const client = getOptimizelyClient();

  try {
    const event = await client.getEvent(projectId, eventId);

    return {
      id: event.id,
      name: event.name,
      description: event.description,
      archived: event.archived,
      created: formatDate(event.created),
      last_modified: formatDate(event.last_modified),
      project_id: event.project_id,
      category: event.category,
      event_type: event.event_type,
      edit_url: event.edit_url,
      is_classic: event.is_classic,
      is_editable: event.is_editable,
      key: event.key,
    };
  } catch (error) {
    if (error instanceof OptimizelyClientError) {
      throw new Error(`Failed to get event: ${error.message}`);
    }
    throw new Error(
      `Unexpected error getting event: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Get Experiment Results Tool
 * Returns formatted experiment results with statistical analysis
 */
export async function getExperimentResults(
  params: GetExperimentResultsParams
): Promise<FormattedExperimentResults> {
  const projectId = getProjectId(params);
  const { experimentId } = params;

  if (!experimentId || typeof experimentId !== "string") {
    throw new Error("Experiment ID is required and must be a string");
  }

  const client = getOptimizelyClient();

  try {
    // Get both experiment details and results
    const [experiment, results] = await Promise.all([
      client.getExperiment(projectId, experimentId),
      client.getExperimentResults(projectId, experimentId),
    ]);

    // Calculate summary statistics
    const totalConversions =
      results.results?.reduce(
        (sum, variation) => sum + (variation.conversions || 0),
        0
      ) || 0;
    const overallConversionRate =
      results.visitors > 0 ? (totalConversions / results.visitors) * 100 : 0;

    // Find winning variation (highest conversion rate with statistical significance)
    const winningVariation = results.results?.find(
      (v) => v.statistical_significance && v.statistical_significance >= 95
    );

    return {
      experiment_id: experimentId, // Keep as string to prevent precision loss
      experiment_name: experiment.name,
      project_id: parseInt(projectId),
      status: results.status,
      start_time: results.start_time
        ? formatDate(results.start_time)
        : undefined,
      end_time: results.end_time ? formatDate(results.end_time) : undefined,
      total_visitors: results.visitors,
      confidence: results.confidence,
      variations:
        results.results?.map((variation) => ({
          id: variation.variation_id, // Already a string type
          name: variation.variation_name,
          visitors: variation.visitors,
          conversions: variation.conversions,
          conversion_rate: Math.round(variation.conversion_rate * 10000) / 100, // Convert to percentage with 2 decimals
          improvement: variation.improvement
            ? Math.round(variation.improvement * 10000) / 100
            : undefined,
          statistical_significance: variation.statistical_significance
            ? Math.round(variation.statistical_significance * 100) / 100
            : undefined,
          is_winner: winningVariation
            ? variation.variation_id === winningVariation.variation_id
            : false,
        })) || [],
      summary: {
        has_winner: !!winningVariation,
        winning_variation: winningVariation?.variation_name,
        confidence_level: winningVariation?.statistical_significance,
        total_conversions: totalConversions,
        overall_conversion_rate: Math.round(overallConversionRate * 100) / 100,
      },
    };
  } catch (error) {
    if (error instanceof OptimizelyClientError) {
      throw new Error(`Failed to get experiment results: ${error.message}`);
    }
    throw new Error(
      `Unexpected error getting experiment results: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Create Experiment Tool
 * Creates a new experiment in the specified project
 */
export async function createExperiment(
  params: CreateExperimentParams & {
    audience_ids?: string;
    variations?: string;
  }
): Promise<{
  success: boolean;
  experiment: FormattedExperiment;
  message: string;
}> {
  const projectId = getProjectId(params);
  const { name, description, percentage_included } = params;

  // Parse JSON string parameters
  let audience_ids: number[] | undefined;
  let variations: { name: string; weight?: number }[] | undefined;

  if (params.audience_ids) {
    try {
      audience_ids = JSON.parse(params.audience_ids);
    } catch (error) {
      throw new Error("Invalid audience_ids JSON format");
    }
  }

  if (params.variations) {
    try {
      variations = JSON.parse(params.variations);
    } catch (error) {
      throw new Error("Invalid variations JSON format");
    }
  }

  if (!name || typeof name !== "string") {
    throw new Error("Experiment name is required and must be a string");
  }

  const client = getOptimizelyClient();

  try {
    // Prepare experiment data for API
    const experimentData = {
      name,
      description:
        description ||
        `Experiment created via Opal on ${new Date().toLocaleDateString()}`,
      percentage_included: percentage_included || 100,
      audience_ids: audience_ids || [],
      variations: variations?.map((variation, index) => ({
        name: variation.name,
        weight: variation.weight || 100 / (variations.length || 1),
      })) || [
        { name: "Original", weight: 50 },
        { name: "Variation 1", weight: 50 },
      ],
    };

    const experiment = await client.createExperiment(projectId, experimentData);

    // Format the response using the same structure as getExperiment
    const formattedExperiment: FormattedExperiment = {
      id: experiment.id,
      name: experiment.name,
      description: experiment.description,
      status: experiment.status,
      type: experiment.type,
      created: formatDate(experiment.created),
      last_modified: formatDate(experiment.last_modified),
      project_id: experiment.project_id,
      traffic_allocation: experiment.traffic_allocation,
      holdback: experiment.holdback,
      campaign_id: experiment.campaign_id,
      allocation_policy: experiment.allocation_policy,
      url_targeting: experiment.url_targeting,
      variations:
        experiment.variations?.map((variation) => ({
          id: variation.variation_id,
          name: variation.name,
          weight: variation.weight,
          archived: variation.archived,
          status: variation.status,
          description: variation.description,
        })) || [],
      audience_conditions: experiment.audience_conditions,
      metrics_count: experiment.metrics?.length || 0,
      page_ids: experiment.page_ids || [],
    };

    return {
      success: true,
      experiment: formattedExperiment,
      message: `Experiment "${name}" created successfully with ID ${experiment.id}`,
    };
  } catch (error) {
    if (error instanceof OptimizelyClientError) {
      throw new Error(`Failed to create experiment: ${error.message}`);
    }
    throw new Error(
      `Unexpected error creating experiment: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
