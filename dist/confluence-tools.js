"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readConfluencePage = readConfluencePage;
exports.updateConfluencePage = updateConfluencePage;
exports.createConfluencePage = createConfluencePage;
const confluence_client_1 = require("./confluence-client");
function convertMarkdownToConfluenceStorage(markdown) {
    // Very simple approach - just convert to basic HTML and clean special chars
    let result = markdown;
    // Replace problematic characters first
    result = result
        .replace(/–/g, '-') // En-dash to regular dash
        .replace(/—/g, '-') // Em-dash to regular dash
        .replace(/"/g, '"') // Smart quotes to regular quotes
        .replace(/"/g, '"')
        .replace(/'/g, "'")
        .replace(/'/g, "'")
        .replace(/&/g, 'and'); // Ampersand to word
    // Convert markdown to very basic HTML
    result = result
        // Headers
        .replace(/^### (.*)$/gm, '<h3>$1</h3>')
        .replace(/^## (.*)$/gm, '<h2>$1</h2>')
        .replace(/^# (.*)$/gm, '<h1>$1</h1>')
        // Bold and italic (do this before other replacements)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        // Lists (simple approach)
        .replace(/^- (.*)$/gm, '<li>$1</li>')
        // Tables - just convert to simple text for now to avoid XML issues
        .replace(/\|.*\|/g, (match) => {
        // Convert table rows to simple text
        return match.replace(/\|/g, ' | ').trim();
    })
        .replace(/^\|.*\|$/gm, '$&<br/>')
        // Line breaks
        .replace(/\n\n/g, '</p><p>') // Double newlines become paragraph breaks
        .replace(/\n/g, '<br/>'); // Single newlines become breaks
    // Wrap in paragraphs and clean up
    result = '<p>' + result + '</p>';
    // Clean up formatting step by step
    result = result
        .replace(/<p><\/p>/g, '') // Remove empty paragraphs
        .replace(/<br\/><h([1-6])>/g, '</p><h$1>') // Close paragraph before header
        .replace(/<h([1-6])>(.*?)<\/h[1-6]><br\/>/g, '<h$1>$2</h$1><p>') // Start new paragraph after header
        .replace(/<p>(<h[1-6]>.*?<\/h[1-6]>)<\/p>/g, '$1') // Remove any remaining paragraph wrapping around headers
        .replace(/<br\/><li>/g, '</p><ul><li>') // Start list, end paragraph
        .replace(/<\/li><br\/>/g, '</li>') // Clean list item endings
        .replace(/<li>(.*?)<\/li><li>/g, '<li>$1</li><li>') // Clean up list items
        .replace(/(<\/li>)(?!<\/ul>)(?!<li>)/g, '$1</ul><p>') // End list and start paragraph
        .replace(/<\/ul><ul>/g, '') // Merge adjacent lists
        .replace(/<br\/><br\/>/g, '<br/>') // Reduce double breaks
        .replace(/<p><br\/>/g, '<p>') // Clean paragraph starts
        .replace(/<br\/><\/p>/g, '</p>') // Clean paragraph ends
        .replace(/<p>$/, '') // Remove trailing empty paragraph start
        .replace(/^<\/p>/, ''); // Remove leading paragraph end
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
