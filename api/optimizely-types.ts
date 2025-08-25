// Optimizely Web Experimentation API Types
// Based on: https://docs.developers.optimizely.com/web-experimentation/reference/overview

export interface OptimizelyProject {
  id: number;
  account_id: number;
  code_revision?: number;
  created: string;
  description?: string;
  is_classic: boolean;
  last_modified: string;
  name: string;
  platform: string;
  project_status: "active" | "archived";
  socket_token?: string;
  status: "active" | "archived";
}

export interface OptimizelyExperiment {
  id: number;
  project_id: number;
  campaign_id?: number;
  created: string;
  description?: string;
  edit_url: string;
  experiment_type: string;
  holdback: number;
  is_classic: boolean;
  last_modified: string;
  name: string;
  percentage_included: number;
  results_url: string;
  status: "not_started" | "running" | "paused" | "archived";
  variations: OptimizelyVariation[];
  audience_conditions?: string;
  audience_ids?: number[];
  metrics?: OptimizelyMetric[];
}

export interface OptimizelyVariation {
  id: number;
  experiment_id: number;
  name: string;
  weight: number;
  is_paused: boolean;
  description?: string;
  actions?: OptimizelyAction[];
}

export interface OptimizelyAction {
  id: number;
  page_id: number;
  type: string;
  selector?: string;
  value?: string;
  attributes?: Record<string, any>;
}

export interface OptimizelyAudience {
  id: number;
  project_id: number;
  archived: boolean;
  conditions: string;
  created: string;
  description?: string;
  is_classic: boolean;
  last_modified: string;
  name: string;
  segmentation: boolean;
}

export interface OptimizelyPage {
  id: number;
  project_id: number;
  archived: boolean;
  category: string;
  conditions: string;
  created: string;
  edit_url: string;
  key?: string;
  last_modified: string;
  name: string;
  page_type: string;
}

export interface OptimizelyEvent {
  id: number;
  project_id: number;
  archived: boolean;
  category: string;
  created: string;
  description?: string;
  edit_url: string;
  event_type: string;
  is_classic: boolean;
  is_editable: boolean;
  key?: string;
  last_modified: string;
  name: string;
}

export interface OptimizelyMetric {
  id: number;
  name: string;
  event_id?: number;
  aggregator: string;
  field?: string;
  scope: string;
  winning_direction: string;
}

export interface OptimizelyExperimentResults {
  experiment_id: number;
  project_id: number;
  status: string;
  results: OptimizelyVariationResults[];
  confidence?: number;
  end_time?: string;
  start_time?: string;
  visitors: number;
}

export interface OptimizelyVariationResults {
  variation_id: number;
  variation_name: string;
  visitors: number;
  conversions: number;
  conversion_rate: number;
  improvement?: number;
  statistical_significance?: number;
}

// Request/Response types for our tools
export interface ListExperimentsParams {
  projectId: string;
  status?: "not_started" | "running" | "paused" | "archived";
  page?: number;
  per_page?: number;
}

export interface ListAudiencesParams {
  projectId: string;
  archived?: boolean;
  page?: number;
  per_page?: number;
}

export interface ListPagesParams {
  projectId: string;
  archived?: boolean;
  page?: number;
  per_page?: number;
}

export interface ListEventsParams {
  projectId: string;
  archived?: boolean;
  page?: number;
  per_page?: number;
}

export interface GetExperimentParams {
  projectId: string;
  experimentId: string;
}

export interface GetAudienceParams {
  projectId: string;
  audienceId: string;
}

export interface GetPageParams {
  projectId: string;
  pageId: string;
}

export interface GetEventParams {
  projectId: string;
  eventId: string;
}

export interface GetExperimentResultsParams {
  projectId: string;
  experimentId: string;
}

export interface CreateExperimentParams {
  projectId: string;
  name: string;
  description?: string;
  percentage_included?: number;
  audience_ids?: number[];
  variations?: {
    name: string;
    weight?: number;
  }[];
}

// Formatted response types for readable output
export interface FormattedExperimentList {
  project_id: string;
  total_count: number;
  experiments: {
    id: number;
    name: string;
    status: string;
    created: string;
    last_modified: string;
    description?: string;
    percentage_included: number;
    variations_count: number;
  }[];
}

export interface FormattedExperiment {
  id: number;
  name: string;
  description?: string;
  status: string;
  created: string;
  last_modified: string;
  project_id: number;
  percentage_included: number;
  holdback: number;
  edit_url: string;
  results_url: string;
  variations: {
    id: number;
    name: string;
    weight: number;
    is_paused: boolean;
    description?: string;
  }[];
  audiences: number[];
  metrics_count: number;
}

export interface FormattedAudienceList {
  project_id: string;
  total_count: number;
  audiences: {
    id: number;
    name: string;
    archived: boolean;
    created: string;
    last_modified: string;
    description?: string;
  }[];
}

export interface FormattedAudience {
  id: number;
  name: string;
  description?: string;
  archived: boolean;
  created: string;
  last_modified: string;
  project_id: number;
  conditions: string;
  segmentation: boolean;
  is_classic: boolean;
}

export interface FormattedPageList {
  project_id: string;
  total_count: number;
  pages: {
    id: number;
    name: string;
    archived: boolean;
    created: string;
    last_modified: string;
    category: string;
    page_type: string;
  }[];
}

export interface FormattedPage {
  id: number;
  name: string;
  archived: boolean;
  created: string;
  last_modified: string;
  project_id: number;
  category: string;
  page_type: string;
  conditions: string;
  edit_url: string;
  key?: string;
}

export interface FormattedEventList {
  project_id: string;
  total_count: number;
  events: {
    id: number;
    name: string;
    archived: boolean;
    created: string;
    last_modified: string;
    category: string;
    event_type: string;
  }[];
}

export interface FormattedEvent {
  id: number;
  name: string;
  description?: string;
  archived: boolean;
  created: string;
  last_modified: string;
  project_id: number;
  category: string;
  event_type: string;
  edit_url: string;
  is_classic: boolean;
  is_editable: boolean;
  key?: string;
}

export interface FormattedExperimentResults {
  experiment_id: number;
  experiment_name: string;
  project_id: number;
  status: string;
  start_time?: string;
  end_time?: string;
  total_visitors: number;
  confidence?: number;
  variations: {
    id: number;
    name: string;
    visitors: number;
    conversions: number;
    conversion_rate: number;
    improvement?: number;
    statistical_significance?: number;
    is_winner?: boolean;
  }[];
  summary: {
    has_winner: boolean;
    winning_variation?: string;
    confidence_level?: number;
    total_conversions: number;
    overall_conversion_rate: number;
  };
}

// Error types
export interface OptimizelyAPIError {
  message: string;
  status?: number;
  code?: string;
  details?: any;
}
