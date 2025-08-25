import { confluenceClient, type ConfluencePage } from './confluence-client';

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