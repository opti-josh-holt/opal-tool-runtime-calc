import { confluenceClient, type ConfluencePage } from './confluence-client';

export type ReadConfluencePageParams = {
  pageId?: string;
  spaceKey?: string;
  title?: string;
};

export type UpdateConfluencePageParams = {
  pageId: string;
  title?: string;
  content: string;
};

export type CreateConfluencePageParams = {
  spaceKey: string;
  title: string;
  content: string;
  parentPageId?: string;
};

export type ConfluencePageResult = {
  id: string;
  title: string;
  content: string;
  spaceKey: string;
  spaceName: string;
  version: number;
  lastModified: string;
  lastModifiedBy: string;
  url: string;
};

export type CreatePageResult = {
  id: string;
  title: string;
  url: string;
  spaceKey: string;
};

export type UpdatePageResult = {
  success: boolean;
  message: string;
  version: number;
};

export async function readConfluencePage(params: ReadConfluencePageParams): Promise<ConfluencePageResult> {
  const { pageId, spaceKey, title } = params;
  
  if (!pageId && !(spaceKey && title)) {
    throw new Error('Either pageId or both spaceKey and title are required');
  }

  let page: ConfluencePage;
  
  if (pageId) {
    if (typeof pageId !== 'string') {
      throw new Error('Page ID must be a string');
    }
    page = await confluenceClient.getPageById(pageId);
  } else {
    if (typeof spaceKey !== 'string' || typeof title !== 'string') {
      throw new Error('Space key and title must be strings');
    }
    page = await confluenceClient.getPageByTitle(spaceKey, title);
  }
  
  return {
    id: page.id,
    title: page.title,
    content: page.body.storage.value,
    spaceKey: page.space.key,
    spaceName: page.space.name,
    version: page.version.number,
    lastModified: page.version.when,
    lastModifiedBy: page.version.by.displayName,
    url: `https://confluence.sso.episerver.net${page._links.webui}`,
  };
}

export async function updateConfluencePage(params: UpdateConfluencePageParams): Promise<UpdatePageResult> {
  const { pageId, title, content } = params;
  
  if (!pageId || typeof pageId !== 'string') {
    throw new Error('Page ID is required and must be a string');
  }
  
  if (!content || typeof content !== 'string') {
    throw new Error('Content is required and must be a string');
  }

  const existingPage = await confluenceClient.getPageById(pageId);
  
  const updateData = {
    version: {
      number: existingPage.version.number + 1,
    },
    title: title || existingPage.title,
    type: existingPage.type,
    body: {
      storage: {
        value: content,
        representation: 'storage',
      },
    },
  };

  const updatedPage = await confluenceClient.updatePage(pageId, updateData);
  
  return {
    success: true,
    message: `Page "${updatedPage.title}" updated successfully`,
    version: updatedPage.version.number,
  };
}

export async function createConfluencePage(params: CreateConfluencePageParams): Promise<CreatePageResult> {
  const { spaceKey, title, content, parentPageId } = params;
  
  if (!spaceKey || typeof spaceKey !== 'string') {
    throw new Error('Space key is required and must be a string');
  }
  
  if (!title || typeof title !== 'string') {
    throw new Error('Title is required and must be a string');
  }
  
  if (!content || typeof content !== 'string') {
    throw new Error('Content is required and must be a string');
  }

  const pageData = {
    type: 'page',
    title,
    space: {
      key: spaceKey,
    },
    body: {
      storage: {
        value: content,
        representation: 'storage',
      },
    },
    ...(parentPageId && {
      ancestors: [
        {
          id: parentPageId,
        },
      ],
    }),
  };

  const result = await confluenceClient.createPage(pageData);
  
  return {
    id: result.id,
    title: result.title,
    url: `https://confluence.sso.episerver.net${result._links.webui}`,
    spaceKey: result.space.key,
  };
}