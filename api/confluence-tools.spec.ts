import { readConfluencePage, updateConfluencePage, createConfluencePage } from './confluence-tools';
import { confluenceClient } from './confluence-client';

jest.mock('./confluence-client', () => ({
  confluenceClient: {
    getPageById: jest.fn(),
    getPageByTitle: jest.fn(),
    updatePage: jest.fn(),
    createPage: jest.fn(),
  },
}));

const mockConfluenceClient = confluenceClient as jest.Mocked<typeof confluenceClient>;

describe('Confluence Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('readConfluencePage', () => {
    const mockPage = {
      id: '123456',
      title: 'Test Page',
      type: 'page',
      status: 'current',
      space: {
        id: '789',
        key: 'TEST',
        name: 'Test Space',
      },
      version: {
        number: 1,
        by: {
          displayName: 'Test User',
          emailAddress: 'test@example.com',
        },
        when: '2024-01-01T00:00:00.000Z',
      },
      body: {
        storage: {
          value: '<p>Test content</p>',
          representation: 'storage',
        },
      },
      _links: {
        webui: '/display/TEST/Test+Page',
        self: 'https://confluence.sso.episerver.net/rest/api/content/123456',
      },
    };

    it('should read page by ID', async () => {
      mockConfluenceClient.getPageById.mockResolvedValue(mockPage);

      const result = await readConfluencePage({ pageId: '123456' });

      expect(mockConfluenceClient.getPageById).toHaveBeenCalledWith('123456');
      expect(result).toEqual({
        id: '123456',
        title: 'Test Page',
        content: '<p>Test content</p>',
        spaceKey: 'TEST',
        spaceName: 'Test Space',
        version: 1,
        lastModified: '2024-01-01T00:00:00.000Z',
        lastModifiedBy: 'Test User',
        url: 'https://confluence.sso.episerver.net/display/TEST/Test+Page',
      });
    });

    it('should read page by space and title', async () => {
      mockConfluenceClient.getPageByTitle.mockResolvedValue(mockPage);

      const result = await readConfluencePage({ spaceKey: 'test', title: 'Test Page' });

      expect(mockConfluenceClient.getPageByTitle).toHaveBeenCalledWith('TEST', 'Test Page');
      expect(result.title).toBe('Test Page');
    });

    it('should capitalize space key when reading by space and title', async () => {
      mockConfluenceClient.getPageByTitle.mockResolvedValue(mockPage);

      await readConfluencePage({ spaceKey: 'team', title: 'Test Page' });

      expect(mockConfluenceClient.getPageByTitle).toHaveBeenCalledWith('TEAM', 'Test Page');
    });

    it('should throw error if neither pageId nor spaceKey+title provided', async () => {
      await expect(readConfluencePage({})).rejects.toThrow(
        'Either pageId or both spaceKey and title are required'
      );
    });

    it('should throw error if pageId is not a string', async () => {
      await expect(readConfluencePage({ pageId: 123 as any })).rejects.toThrow(
        'Page ID must be a string'
      );
    });
  });

  describe('updateConfluencePage', () => {
    const mockExistingPage = {
      id: '123456',
      title: 'Existing Title',
      type: 'page',
      version: { number: 1 },
    };

    const mockUpdatedPage = {
      ...mockExistingPage,
      title: 'Updated Title',
      version: { number: 2 },
    };

    it('should update page content', async () => {
      mockConfluenceClient.getPageById.mockResolvedValue(mockExistingPage as any);
      mockConfluenceClient.updatePage.mockResolvedValue(mockUpdatedPage as any);

      const result = await updateConfluencePage({
        pageId: '123456',
        content: '<p>New content</p>',
      });

      expect(mockConfluenceClient.getPageById).toHaveBeenCalledWith('123456');
      expect(mockConfluenceClient.updatePage).toHaveBeenCalledWith('123456', {
        version: { number: 2 },
        title: 'Existing Title',
        type: 'page',
        body: {
          storage: {
            value: '<p>New content</p>',
            representation: 'storage',
          },
        },
      });
      expect(result).toEqual({
        success: true,
        message: 'Page "Updated Title" updated successfully',
        version: 2,
      });
    });

    it('should throw error if pageId is missing', async () => {
      await expect(updateConfluencePage({ pageId: '', content: 'test' })).rejects.toThrow(
        'Page ID is required and must be a string'
      );
    });

    it('should throw error if content is missing', async () => {
      await expect(updateConfluencePage({ pageId: '123', content: '' })).rejects.toThrow(
        'Content is required and must be a string'
      );
    });
  });

  describe('createConfluencePage', () => {
    const mockCreatedPage = {
      id: '789012',
      title: 'New Page',
      space: { key: 'TEST' },
      _links: { webui: '/display/TEST/New+Page' },
    };

    it('should create new page', async () => {
      mockConfluenceClient.createPage.mockResolvedValue(mockCreatedPage as any);

      const result = await createConfluencePage({
        spaceKey: 'test',
        title: 'New Page',
        content: '<p>New page content</p>',
      });

      expect(mockConfluenceClient.createPage).toHaveBeenCalledWith({
        type: 'page',
        title: 'New Page',
        space: { key: 'TEST' },
        body: {
          storage: {
            value: '<p>New page content</p>',
            representation: 'storage',
          },
        },
      });
      expect(result).toEqual({
        id: '789012',
        title: 'New Page',
        url: 'https://confluence.sso.episerver.net/display/TEST/New+Page',
        spaceKey: 'TEST',
      });
    });

    it('should create page with parent', async () => {
      mockConfluenceClient.createPage.mockResolvedValue(mockCreatedPage as any);

      await createConfluencePage({
        spaceKey: 'test',
        title: 'Child Page',
        content: '<p>Child content</p>',
        parentPageId: '123456',
      });

      expect(mockConfluenceClient.createPage).toHaveBeenCalledWith(
        expect.objectContaining({
          ancestors: [{ id: '123456' }],
        })
      );
    });

    it('should capitalize space key when creating page', async () => {
      mockConfluenceClient.createPage.mockResolvedValue(mockCreatedPage as any);

      await createConfluencePage({
        spaceKey: 'team',
        title: 'New Page',
        content: '<p>Content</p>',
      });

      expect(mockConfluenceClient.createPage).toHaveBeenCalledWith(
        expect.objectContaining({
          space: { key: 'TEAM' },
        })
      );
    });

    it('should convert markdown to confluence storage format', async () => {
      mockConfluenceClient.createPage.mockResolvedValue(mockCreatedPage as any);

      await createConfluencePage({
        spaceKey: 'TEST',
        title: 'Markdown Test',
        content: '### Header\n\nThis is **bold** and *italic* text.\n\n- List item 1\n- List item 2',
      });

      expect(mockConfluenceClient.createPage).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            storage: {
              value: '<h3>Header</h3><p>This is <strong>bold</strong> and <em>italic</em> text.</p><ul><li>List item 1</li><li>List item 2</li></ul>',
              representation: 'storage',
            },
          },
        })
      );
    });

    it('should throw error if spaceKey is missing', async () => {
      await expect(
        createConfluencePage({ spaceKey: '', title: 'Test', content: 'test' })
      ).rejects.toThrow('Space key is required and must be a string');
    });

    it('should throw error if title is missing', async () => {
      await expect(
        createConfluencePage({ spaceKey: 'test', title: '', content: 'test' })
      ).rejects.toThrow('Title is required and must be a string');
    });

    it('should throw error if content is missing', async () => {
      await expect(
        createConfluencePage({ spaceKey: 'test', title: 'Test', content: '' })
      ).rejects.toThrow('Content is required and must be a string');
    });
  });
});