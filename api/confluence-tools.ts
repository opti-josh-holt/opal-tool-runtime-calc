import { confluenceClient, type ConfluencePage, ConfluenceClientError } from './confluence-client';

function processMarkdownTable(lines: string[], startIndex: number): { html: string; lastIndex: number } {
  let currentIndex = startIndex;
  
  // Parse header row
  const headerLine = lines[currentIndex].trim();
  const headers = headerLine.split('|').map(h => h.trim()).filter(h => h);
  currentIndex++;
  
  // Skip separator row
  currentIndex++;
  
  // Collect data rows
  const dataRows: string[][] = [];
  while (currentIndex < lines.length) {
    const line = lines[currentIndex].trim();
    if (!line || !line.includes('|')) break;
    
    const cells = line.split('|').map(c => c.trim()).filter(c => c !== '');
    if (cells.length > 0) {
      dataRows.push(cells);
    }
    currentIndex++;
  }
  
  // Generate HTML table
  let tableHtml = '<table><tbody>';
  
  // Header row
  if (headers.length > 0) {
    tableHtml += '<tr>';
    headers.forEach(header => {
      const cleaned = header
        .replace(/–/g, '-')
        .replace(/—/g, '-')
        .replace(/"/g, '"')
        .replace(/"/g, '"')
        .replace(/'/g, "'")
        .replace(/'/g, "'")
        .replace(/&/g, 'and');
      const formatted = cleaned
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
      tableHtml += `<th>${formatted}</th>`;
    });
    tableHtml += '</tr>';
  }
  
  // Data rows
  dataRows.forEach(row => {
    tableHtml += '<tr>';
    row.forEach(cell => {
      const cleaned = cell
        .replace(/–/g, '-')
        .replace(/—/g, '-')
        .replace(/"/g, '"')
        .replace(/"/g, '"')
        .replace(/'/g, "'")
        .replace(/'/g, "'")
        .replace(/&/g, 'and');
      const formatted = cleaned
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
      tableHtml += `<td>${formatted}</td>`;
    });
    tableHtml += '</tr>';
  });
  
  tableHtml += '</tbody></table>';
  
  return {
    html: tableHtml,
    lastIndex: currentIndex - 1 // Return to last processed line
  };
}

function convertMarkdownToConfluenceStorage(markdown: string): string {
  // Clean up problematic characters first
  let result = markdown
    .replace(/–/g, '-')           // En-dash to regular dash
    .replace(/—/g, '-')           // Em-dash to regular dash
    .replace(/"/g, '"')           // Smart quotes to regular quotes
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/'/g, "'")
    .replace(/&/g, 'and');        // Ampersand to word
  
  // Process line by line for better control
  const lines = result.split('\n');
  const htmlLines: string[] = [];
  let inList = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Empty line
    if (!line) {
      if (inList) {
        htmlLines.push('</ul>');
        inList = false;
      }
      htmlLines.push(''); // Preserve empty lines for paragraph breaks
      continue;
    }
    
    // Headers
    if (line.match(/^#{1,3}\s/)) {
      if (inList) {
        htmlLines.push('</ul>');
        inList = false;
      }
      
      const headerText = line.replace(/^#{1,3}\s*/, '');
      const level = (line.match(/^#+/) || [''])[0].length;
      
      // Apply formatting to header text
      const formatted = headerText
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
      
      htmlLines.push(`<h${level}>${formatted}</h${level}>`);
      continue;
    }
    
    // List items
    if (line.startsWith('- ')) {
      if (!inList) {
        htmlLines.push('<ul>');
        inList = true;
      }
      
      const itemText = line.substring(2);
      const formatted = itemText
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
      
      htmlLines.push(`<li>${formatted}</li>`);
      continue;
    }
    
    // Tables - detect and convert to proper HTML tables
    if (line.includes('|') && !line.match(/^\s*\|?\s*-+\s*\|/)) {
      if (inList) {
        htmlLines.push('</ul>');
        inList = false;
      }
      
      // Look ahead to see if this is part of a table
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
      const isTableHeader = nextLine && nextLine.match(/^\|?[\s]*[-:]+[\s]*(\|[\s]*[-:]+[\s]*)*\|?$/);
      
      if (isTableHeader) {
        // Process the entire table
        const tableResult = processMarkdownTable(lines, i);
        htmlLines.push(tableResult.html);
        i = tableResult.lastIndex; // Skip processed lines
      } else {
        // Single table-like line, treat as text
        const tableText = line.replace(/\|/g, ' | ').trim();
        htmlLines.push(`<p>${tableText}</p>`);
      }
      continue;
    }
    
    // Regular paragraph
    if (inList) {
      htmlLines.push('</ul>');
      inList = false;
    }
    
    const formatted = line
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    htmlLines.push(`<p>${formatted}</p>`);
  }
  
  // Close any remaining list
  if (inList) {
    htmlLines.push('</ul>');
  }
  
  // Join and clean up
  result = htmlLines.join('');
  
  // Final cleanup
  result = result
    .replace(/<\/p><p>/g, '</p><p>')   // Ensure proper paragraph spacing
    .replace(/^<\/p>/, '')            // Remove leading closing paragraph
    .replace(/<p>$/, '');             // Remove trailing opening paragraph
  
  return result;
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
    throw new Error('Either pageId or both spaceKey and title are required to read a Confluence page');
  }

  try {
    let page: ConfluencePage;
    
    if (pageId) {
      page = await confluenceClient.getPageById(pageId);
    } else {
      page = await confluenceClient.getPageByTitle(spaceKey!.toUpperCase(), title!);
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
  } catch (error) {
    if (error instanceof ConfluenceClientError) {
      const identifier = pageId ? `ID "${pageId}"` : `title "${title}" in space "${spaceKey}"`;
      
      if (error.status === 404) {
        throw new Error(
          `Confluence page with ${identifier} not found. This could mean: 1) The page ${pageId ? 'ID' : 'title or space key'} is incorrect, 2) The page has been deleted or archived, 3) You don't have permission to view this page or space, or 4) The space doesn't exist. Please verify the ${pageId ? 'page ID' : 'page title and space key'} are correct and that you have access to the page. Error details: ${error.message}`
        );
      } else if (error.status === 401) {
        throw new Error(
          `Authentication failed when accessing Confluence page with ${identifier}. Please check your CONFLUENCE_PAT environment variable contains a valid Personal Access Token with read permissions. Error details: ${error.message}`
        );
      } else if (error.status === 403) {
        throw new Error(
          `Access denied to Confluence page with ${identifier}. Your account may not have permission to view this page or space. Please contact your Confluence administrator or verify you have read access to the space. Error details: ${error.message}`
        );
      }
      throw new Error(`Failed to read Confluence page with ${identifier}: ${error.message}`);
    }
    throw new Error(
      `Unexpected error reading Confluence page: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function updateConfluencePage(params: UpdateConfluencePageParams): Promise<UpdatePageResult> {
  const { pageId, title, content } = params;
  
  if (!pageId || typeof pageId !== 'string') {
    throw new Error('Page ID is required and must be a string');
  }
  
  if (!content || typeof content !== 'string') {
    throw new Error('Content is required and must be a string');
  }

  try {
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
  } catch (error) {
    if (error instanceof ConfluenceClientError) {
      if (error.status === 404) {
        throw new Error(
          `Confluence page with ID "${pageId}" not found for update. This could mean: 1) The page ID is incorrect, 2) The page has been deleted, or 3) You don't have permission to view this page. Please verify the page ID is correct and that the page exists. Error details: ${error.message}`
        );
      } else if (error.status === 401) {
        throw new Error(
          `Authentication failed when updating Confluence page "${pageId}". Please check your CONFLUENCE_PAT environment variable contains a valid Personal Access Token with edit permissions. Error details: ${error.message}`
        );
      } else if (error.status === 403) {
        throw new Error(
          `Access denied when updating Confluence page "${pageId}". Your account may not have permission to edit pages in this space. Please contact your Confluence administrator or verify you have edit permissions for this space. Error details: ${error.message}`
        );
      } else if (error.status === 409) {
        throw new Error(
          `Version conflict when updating Confluence page "${pageId}". The page was modified by another user while you were editing it. Please refresh the page, get the latest version, and try your update again. Error details: ${error.message}`
        );
      } else if (error.status === 400) {
        throw new Error(
          `Invalid update data for Confluence page "${pageId}". The content format or other field values may be incorrect. Please check that the content is valid and all required fields are provided. Error details: ${error.message}`
        );
      }
      throw new Error(`Failed to update Confluence page "${pageId}": ${error.message}`);
    }
    throw new Error(
      `Unexpected error updating Confluence page "${pageId}": ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
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

  try {
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
  } catch (error) {
    if (error instanceof ConfluenceClientError) {
      if (error.status === 400) {
        throw new Error(
          `Invalid data when creating Confluence page "${title}" in space "${spaceKey}". This could mean: 1) The space key "${spaceKey}" doesn't exist or you don't have access to it, 2) The page title already exists in this space, 3) The parent page ID is invalid (if provided), or 4) Required fields are missing. Please verify the space key exists, the page title is unique in the space, and all required fields are provided. Error details: ${error.message}`
        );
      } else if (error.status === 401) {
        throw new Error(
          `Authentication failed when creating Confluence page. Please check your CONFLUENCE_PAT environment variable contains a valid Personal Access Token with create permissions. Error details: ${error.message}`
        );
      } else if (error.status === 403) {
        throw new Error(
          `Access denied when creating page in space "${spaceKey}". Your account may not have permission to create pages in this space. Please contact your Confluence administrator or verify you have create permissions for this space. Error details: ${error.message}`
        );
      }
      throw new Error(`Failed to create Confluence page "${title}" in space "${spaceKey}": ${error.message}`);
    }
    throw new Error(
      `Unexpected error creating Confluence page "${title}" in space "${spaceKey}": ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}