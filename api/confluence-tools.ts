import { confluenceClient, type ConfluencePage } from './confluence-client';

function escapeXmlSpecialChars(text: string): string {
  return text
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/–/g, '-')         // Convert en-dash to regular dash
    .replace(/—/g, '-')         // Convert em-dash to regular dash  
    .replace(/"/g, '"')         // Convert smart quotes to regular quotes
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/'/g, "'");
}

function convertMarkdownToConfluenceStorage(markdown: string): string {
  // First, let's process the markdown line by line to identify blocks more accurately
  const lines = markdown.split('\n');
  const blocks: string[] = [];
  let currentBlock: string[] = [];
  let inTable = false;
  let inList = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Empty line - end current block
    if (!trimmed) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
        currentBlock = [];
        inTable = false;
        inList = false;
      }
      continue;
    }
    
    // Check if this line starts a new block type
    const isHeader = trimmed.match(/^#{1,3}\s/);
    const isListItem = trimmed.startsWith('- ');
    const isTableLine = trimmed.includes('|');
    const isSeparator = trimmed.includes('---');
    
    // If we're switching block types, save current block
    if (currentBlock.length > 0) {
      if ((isHeader) || 
          (isListItem && !inList) || 
          (isTableLine && !inTable && !isSeparator) ||
          (!isListItem && inList) ||
          (!isTableLine && inTable)) {
        blocks.push(currentBlock.join('\n'));
        currentBlock = [];
        inTable = false;
        inList = false;
      }
    }
    
    // Add line to current block
    currentBlock.push(line);
    
    // Update block type tracking
    if (isListItem) inList = true;
    if (isTableLine) inTable = true;
  }
  
  // Don't forget the last block
  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join('\n'));
  }
  
  // Now convert each block
  const convertedBlocks: string[] = [];
  
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    
    // Handle headers followed by content
    if (trimmed.match(/^#{1,3}\s/)) {
      const lines = trimmed.split('\n');
      const convertedLines: string[] = [];
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.match(/^#{1,3}\s/)) {
          const headerConverted = trimmedLine
            .replace(/^### (.*)$/gm, '<h3>$1</h3>')
            .replace(/^## (.*)$/gm, '<h2>$1</h2>')
            .replace(/^# (.*)$/gm, '<h1>$1</h1>');
          convertedLines.push(headerConverted);
        } else if (trimmedLine) {
          // This is content after a header
          const cleaned = escapeXmlSpecialChars(trimmedLine);
          const formatted = cleaned
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>');
          convertedLines.push(`<p>${formatted}</p>`);
        }
      }
      
      convertedBlocks.push(convertedLines.join(''));
      continue;
    }
    
    // Handle tables
    if (trimmed.includes('|') && trimmed.includes('---')) {
      convertedBlocks.push(convertTableToConfluence(trimmed));
      continue;
    }
    
    // Handle lists
    if (trimmed.match(/^- /m)) {
      const listItems = trimmed
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('- '))
        .map(line => {
          const content = line.substring(2); // Remove "- "
          const cleaned = escapeXmlSpecialChars(content);
          const formatted = cleaned
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>');
          return `<li>${formatted}</li>`;
        })
        .join('');
      
      if (listItems) {
        convertedBlocks.push(`<ul>${listItems}</ul>`);
      }
      continue;
    }
    
    // Handle regular paragraphs
    const cleaned = escapeXmlSpecialChars(trimmed);
    const formatted = cleaned
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    const lines = formatted.split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length > 0) {
      convertedBlocks.push(`<p>${lines.join('<br/>')}</p>`);
    }
  }
  
  return convertedBlocks.join('');
}

function convertTableToConfluence(tableMarkdown: string): string {
  const lines = tableMarkdown.split('\n').map(line => line.trim()).filter(line => line);
  if (lines.length < 3) return `<p>${tableMarkdown.replace(/\n/g, '<br/>')}</p>`;
  
  // Find header row and separator
  let headerIndex = -1;
  let separatorIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('|')) {
      if (headerIndex === -1) {
        headerIndex = i;
      } else if (lines[i].includes('---') && separatorIndex === -1) {
        separatorIndex = i;
        break;
      }
    }
  }
  
  if (headerIndex === -1 || separatorIndex === -1 || separatorIndex !== headerIndex + 1) {
    return `<p>${tableMarkdown.replace(/\n/g, '<br/>')}</p>`;
  }
  
  const headers = lines[headerIndex].split('|').map(h => h.trim()).filter(h => h);
  const dataRows = lines.slice(separatorIndex + 1);
  
  let table = '<table><tbody>';
  
  // Header row
  if (headers.length > 0) {
    table += '<tr>';
    headers.forEach(header => {
      const cleaned = escapeXmlSpecialChars(header);
      const formatted = cleaned
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
      table += `<th>${formatted}</th>`;
    });
    table += '</tr>';
  }
  
  // Data rows
  dataRows.forEach(line => {
    if (line.includes('|')) {
      const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
      if (cells.length > 0) {
        table += '<tr>';
        cells.forEach(cell => {
          const cleaned = escapeXmlSpecialChars(cell);
          const formatted = cleaned
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>');
          table += `<td>${formatted}</td>`;
        });
        table += '</tr>';
      }
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