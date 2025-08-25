"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readConfluencePage = readConfluencePage;
exports.updateConfluencePage = updateConfluencePage;
exports.createConfluencePage = createConfluencePage;
const confluence_client_1 = require("./confluence-client");
function convertMarkdownToConfluenceStorage(markdown) {
    // Clean up problematic characters first
    let result = markdown
        .replace(/–/g, '-') // En-dash to regular dash
        .replace(/—/g, '-') // Em-dash to regular dash
        .replace(/"/g, '"') // Smart quotes to regular quotes
        .replace(/"/g, '"')
        .replace(/'/g, "'")
        .replace(/'/g, "'")
        .replace(/&/g, 'and'); // Ampersand to word
    // Process line by line for better control
    const lines = result.split('\n');
    const htmlLines = [];
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
        // Tables - convert to simple text
        if (line.includes('|')) {
            if (inList) {
                htmlLines.push('</ul>');
                inList = false;
            }
            // Just convert table to simple text format
            const tableText = line.replace(/\|/g, ' | ').trim();
            htmlLines.push(`<p>${tableText}</p>`);
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
        .replace(/<\/p><p>/g, '</p><p>') // Ensure proper paragraph spacing
        .replace(/^<\/p>/, '') // Remove leading closing paragraph
        .replace(/<p>$/, ''); // Remove trailing opening paragraph
    return result;
}
async function readConfluencePage(params) {
    const { pageId, spaceKey, title } = params;
    if (!pageId && !(spaceKey && title)) {
        throw new Error('Either pageId or both spaceKey and title are required');
    }
    let page;
    if (pageId) {
        if (typeof pageId !== 'string') {
            throw new Error('Page ID must be a string');
        }
        page = await confluence_client_1.confluenceClient.getPageById(pageId);
    }
    else {
        if (typeof spaceKey !== 'string' || typeof title !== 'string') {
            throw new Error('Space key and title must be strings');
        }
        page = await confluence_client_1.confluenceClient.getPageByTitle(spaceKey.toUpperCase(), title);
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
async function updateConfluencePage(params) {
    const { pageId, title, content } = params;
    if (!pageId || typeof pageId !== 'string') {
        throw new Error('Page ID is required and must be a string');
    }
    if (!content || typeof content !== 'string') {
        throw new Error('Content is required and must be a string');
    }
    const existingPage = await confluence_client_1.confluenceClient.getPageById(pageId);
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
    const updatedPage = await confluence_client_1.confluenceClient.updatePage(pageId, updateData);
    return {
        success: true,
        message: `Page "${updatedPage.title}" updated successfully`,
        version: updatedPage.version.number,
    };
}
async function createConfluencePage(params) {
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
    const result = await confluence_client_1.confluenceClient.createPage(pageData);
    return {
        id: result.id,
        title: result.title,
        url: `https://confluence.sso.episerver.net${result._links.webui}`,
        spaceKey: result.space.key,
    };
}
