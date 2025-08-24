import { confluenceClient, type ConfluencePage } from './confluence-client';

function convertMarkdownToConfluenceStorage(markdown: string): string {
  return markdown
    // Convert headers
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    
    // Convert bold and italic
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    
    // Convert lists
    .replace(/^- (.*)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    
    // Fix nested ul tags (remove duplicates)
    .replace(/<\/ul>\s*<ul>/g, '')
    
    // Convert line breaks to paragraphs
    .split('\n\n')
    .map(paragraph => {
      paragraph = paragraph.trim();
      if (!paragraph) return '';
      if (paragraph.startsWith('<h') || paragraph.startsWith('<ul') || paragraph.startsWith('<table')) {
        return paragraph;
      }
      // Handle tables
      if (paragraph.includes('|')) {
        return convertTableToConfluence(paragraph);
      }
      return `<p>${paragraph.replace(/\n/g, '<br/>')}</p>`;
    })
    .filter(p => p)
    .join('');
}

function convertTableToConfluence(tableMarkdown: string): string {
  const lines = tableMarkdown.split('\n').filter(line => line.trim());
  if (lines.length < 2) return `<p>${tableMarkdown}</p>`;
  
  const headers = lines[0].split('|').map(h => h.trim()).filter(h => h);
  const separatorLine = lines[1];
  const rows = lines.slice(2).map(line => line.split('|').map(cell => cell.trim()).filter(cell => cell));
  
  // Skip if not a valid table
  if (!separatorLine.includes('---')) {
    return `<p>${tableMarkdown}</p>`;
  }
  
  let table = '<table><tbody>';
  
  // Header row
  if (headers.length > 0) {
    table += '<tr>';
    headers.forEach(header => {
      table += `<th>${header}</th>`;
    });
    table += '</tr>';
  }
  
  // Data rows
  rows.forEach(row => {
    if (row.length > 0) {
      table += '<tr>';
      row.forEach(cell => {
        table += `<td>${cell}</td>`;
      });
      table += '</tr>';
    }
  });
  
  table += '</tbody></table>';
  return table;
}

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
    page = await confluenceClient.getPageByTitle(spaceKey.toUpperCase(), title);
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
        value: convertMarkdownToConfluenceStorage(content),
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
      key: spaceKey.toUpperCase(),
    },
    body: {
      storage: {
        value: convertMarkdownToConfluenceStorage(content),
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