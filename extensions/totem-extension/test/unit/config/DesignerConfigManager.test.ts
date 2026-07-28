// Mock constants to avoid import.meta issues in Jest
jest.mock('../../../src/config/constants', () => ({
  STORAGE_KEYS: {
    DESIGNER_MODE: 'designer_mode',
    DESIGNER_API_URL: 'designer_api_url',
    DESIGNER_PROJECT_ID: 'designer_project_id',
  },
  ENV: {
    AXIA_API_URL: '',
    AXIA_PROJECT_ID: '',
  },
}));

import { DesignerConfigManager } from '../../../src/config/DesignerConfigManager';
import { STORAGE_KEYS } from '../../../src/config/constants';

describe('DesignerConfigManager', () => {
  let mockStorage: Record<string, any>;
  let storageChangeListeners: Array<(changes: any, areaName: string) => void>;

  beforeEach(() => {
    mockStorage = {};
    storageChangeListeners = [];

    global.chrome = {
      storage: {
        local: {
          get: jest.fn((keys) => {
            if (typeof keys === 'string') {
              return Promise.resolve({ [keys]: mockStorage[keys] });
            }
            if (Array.isArray(keys)) {
              const result: Record<string, any> = {};
              keys.forEach((key) => {
                if (key in mockStorage) {
                  result[key] = mockStorage[key];
                }
              });
              return Promise.resolve(result);
            }
            if (keys === null || keys === undefined) {
              return Promise.resolve({ ...mockStorage });
            }
            return Promise.resolve({});
          }),
          set: jest.fn((items) => {
            Object.assign(mockStorage, items);
            const changes: Record<string, { oldValue?: any; newValue: any }> = {};
            Object.keys(items).forEach((key) => {
              changes[key] = {
                oldValue: mockStorage[key],
                newValue: items[key],
              };
            });
            storageChangeListeners.forEach((listener) => listener(changes, 'local'));
            return Promise.resolve();
          }),
          remove: jest.fn((keys) => {
            const keyArray = Array.isArray(keys) ? keys : [keys];
            const changes: Record<string, { oldValue: any; newValue?: undefined }> = {};
            keyArray.forEach((key) => {
              if (key in mockStorage) {
                changes[key] = { oldValue: mockStorage[key] };
                delete mockStorage[key];
              }
            });
            if (Object.keys(changes).length > 0) {
              storageChangeListeners.forEach((listener) => listener(changes, 'local'));
            }
            return Promise.resolve();
          }),
          clear: jest.fn(() => {
            mockStorage = {};
            return Promise.resolve();
          }),
        },
        onChanged: {
          addListener: jest.fn((listener) => {
            storageChangeListeners.push(listener);
          }),
          removeListener: jest.fn((listener) => {
            const index = storageChangeListeners.indexOf(listener);
            if (index > -1) {
              storageChangeListeners.splice(index, 1);
            }
          }),
        },
      },
    } as any;

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getConfig', () => {
    it('should return default config when no storage keys exist', async () => {
      const config = await DesignerConfigManager.getConfig();

      expect(config).toEqual({
        mode: 'mock',
        apiUrl: '',
        projectId: '',
      });
    });

    it('should return stored config when keys exist', async () => {
      mockStorage[STORAGE_KEYS.DESIGNER_MODE] = 'live';
      mockStorage[STORAGE_KEYS.DESIGNER_API_URL] = 'http://localhost:8000';
      mockStorage[STORAGE_KEYS.DESIGNER_PROJECT_ID] = 'test-project-123';

      const config = await DesignerConfigManager.getConfig();

      expect(config).toEqual({
        mode: 'live',
        apiUrl: 'http://localhost:8000',
        projectId: 'test-project-123',
      });
    });

    it('should handle partial config', async () => {
      mockStorage[STORAGE_KEYS.DESIGNER_MODE] = 'live';

      const config = await DesignerConfigManager.getConfig();

      expect(config).toEqual({
        mode: 'live',
        apiUrl: '',
        projectId: '',
      });
    });
  });

  describe('setConfig', () => {
    it('should store config and call synchronizeToAxiaKeys', async () => {
      const synchronizeSpy = jest.spyOn(DesignerConfigManager, 'synchronizeToAxiaKeys');

      await DesignerConfigManager.setConfig({
        mode: 'live',
        apiUrl: 'http://localhost:8000',
        projectId: 'test-project-123',
      });

      expect(mockStorage[STORAGE_KEYS.DESIGNER_MODE]).toBe('live');
      expect(mockStorage[STORAGE_KEYS.DESIGNER_API_URL]).toBe('http://localhost:8000');
      expect(mockStorage[STORAGE_KEYS.DESIGNER_PROJECT_ID]).toBe('test-project-123');
      expect(synchronizeSpy).toHaveBeenCalled();

      synchronizeSpy.mockRestore();
    });

    it('should handle empty string values', async () => {
      await DesignerConfigManager.setConfig({
        mode: 'mock',
        apiUrl: '',
        projectId: '',
      });

      expect(mockStorage[STORAGE_KEYS.DESIGNER_MODE]).toBe('mock');
      expect(mockStorage[STORAGE_KEYS.DESIGNER_API_URL]).toBe('');
      expect(mockStorage[STORAGE_KEYS.DESIGNER_PROJECT_ID]).toBe('');
    });
  });

  describe('synchronizeToAxiaKeys - CRITICAL REGRESSION TESTS', () => {
    it('should write AXIA_BASE (not AXIA_BASE_URL) in Live mode', async () => {
      mockStorage[STORAGE_KEYS.DESIGNER_MODE] = 'live';
      mockStorage[STORAGE_KEYS.DESIGNER_API_URL] = 'http://localhost:8000';
      mockStorage[STORAGE_KEYS.DESIGNER_PROJECT_ID] = 'test-project-123';

      await DesignerConfigManager.synchronizeToAxiaKeys();

      expect(mockStorage['AXIA_BASE']).toBe('http://localhost:8000');
      expect(mockStorage['AXIA_PROJECT_ID']).toBe('test-project-123');
      expect(mockStorage['AXIA_BASE_URL']).toBeUndefined();
    });

    it('should clear AXIA_BASE and AXIA_PROJECT_ID in Mock mode', async () => {
      mockStorage[STORAGE_KEYS.DESIGNER_MODE] = 'mock';
      mockStorage['AXIA_BASE'] = 'http://should-be-removed.com';
      mockStorage['AXIA_PROJECT_ID'] = 'should-be-removed';

      await DesignerConfigManager.synchronizeToAxiaKeys();

      expect(mockStorage['AXIA_BASE']).toBeUndefined();
      expect(mockStorage['AXIA_PROJECT_ID']).toBeUndefined();
    });

    it('should not write AXIA keys in Live mode if apiUrl or projectId missing', async () => {
      mockStorage[STORAGE_KEYS.DESIGNER_MODE] = 'live';
      mockStorage[STORAGE_KEYS.DESIGNER_API_URL] = null;
      mockStorage[STORAGE_KEYS.DESIGNER_PROJECT_ID] = null;

      await DesignerConfigManager.synchronizeToAxiaKeys();

      expect(mockStorage['AXIA_BASE']).toBeUndefined();
      expect(mockStorage['AXIA_PROJECT_ID']).toBeUndefined();
    });

    it('should match AxiaRpcClient.loadBootstrapConfig expectations', async () => {
      mockStorage[STORAGE_KEYS.DESIGNER_MODE] = 'live';
      mockStorage[STORAGE_KEYS.DESIGNER_API_URL] = 'https://api.axia.to';
      mockStorage[STORAGE_KEYS.DESIGNER_PROJECT_ID] = 'prod-project-456';

      await DesignerConfigManager.synchronizeToAxiaKeys();

      const expectedKeys = ['AXIA_BASE', 'AXIA_PROJECT_ID'];
      const unexpectedKeys = ['AXIA_BASE_URL', 'AXIA_API_URL', 'AXIA_URL'];

      expectedKeys.forEach((key) => {
        expect(mockStorage[key]).toBeDefined();
      });

      unexpectedKeys.forEach((key) => {
        expect(mockStorage[key]).toBeUndefined();
      });
    });

    it('should be idempotent - multiple calls produce same result', async () => {
      mockStorage[STORAGE_KEYS.DESIGNER_MODE] = 'live';
      mockStorage[STORAGE_KEYS.DESIGNER_API_URL] = 'http://localhost:8000';
      mockStorage[STORAGE_KEYS.DESIGNER_PROJECT_ID] = 'idempotent-test';

      await DesignerConfigManager.synchronizeToAxiaKeys();
      const firstResult = { ...mockStorage };

      await DesignerConfigManager.synchronizeToAxiaKeys();
      const secondResult = { ...mockStorage };

      expect(firstResult).toEqual(secondResult);
    });
  });

  describe('Mode transitions via setConfig', () => {
    it('should update mode and synchronize', async () => {
      const synchronizeSpy = jest.spyOn(DesignerConfigManager, 'synchronizeToAxiaKeys');

      await DesignerConfigManager.setConfig({ mode: 'live' });

      expect(mockStorage[STORAGE_KEYS.DESIGNER_MODE]).toBe('live');
      expect(synchronizeSpy).toHaveBeenCalled();

      synchronizeSpy.mockRestore();
    });

    it('should transition from Live to Mock and clear AXIA keys', async () => {
      mockStorage[STORAGE_KEYS.DESIGNER_MODE] = 'live';
      mockStorage['AXIA_BASE'] = 'http://localhost:8000';
      mockStorage['AXIA_PROJECT_ID'] = 'test-123';

      await DesignerConfigManager.setConfig({ mode: 'mock' });

      expect(mockStorage[STORAGE_KEYS.DESIGNER_MODE]).toBe('mock');
      expect(mockStorage['AXIA_BASE']).toBeUndefined();
      expect(mockStorage['AXIA_PROJECT_ID']).toBeUndefined();
    });

    it('should update API URL and synchronize', async () => {
      const synchronizeSpy = jest.spyOn(DesignerConfigManager, 'synchronizeToAxiaKeys');

      await DesignerConfigManager.setConfig({ apiUrl: 'http://new-api.com' });

      expect(mockStorage[STORAGE_KEYS.DESIGNER_API_URL]).toBe('http://new-api.com');
      expect(synchronizeSpy).toHaveBeenCalled();

      synchronizeSpy.mockRestore();
    });

    it('should update Project ID and synchronize', async () => {
      const synchronizeSpy = jest.spyOn(DesignerConfigManager, 'synchronizeToAxiaKeys');

      await DesignerConfigManager.setConfig({ projectId: 'new-project-789' });

      expect(mockStorage[STORAGE_KEYS.DESIGNER_PROJECT_ID]).toBe('new-project-789');
      expect(synchronizeSpy).toHaveBeenCalled();

      synchronizeSpy.mockRestore();
    });
  });

  describe('getEffectiveConfig', () => {
    it('should return default values in mock mode', async () => {
      mockStorage[STORAGE_KEYS.DESIGNER_MODE] = 'mock';

      const config = await DesignerConfigManager.getEffectiveConfig();

      expect(config.baseUrl).toBe('https://api.axia.to');
      expect(config.projectId).toBe('');
      expect(config.isLive).toBe(false);
    });

    it('should return configured URLs in live mode', async () => {
      mockStorage[STORAGE_KEYS.DESIGNER_MODE] = 'live';
      mockStorage[STORAGE_KEYS.DESIGNER_API_URL] = 'http://localhost:8000';
      mockStorage[STORAGE_KEYS.DESIGNER_PROJECT_ID] = 'live-project';

      const config = await DesignerConfigManager.getEffectiveConfig();

      expect(config.baseUrl).toBe('http://localhost:8000');
      expect(config.projectId).toBe('live-project');
      expect(config.isLive).toBe(true);
    });
  });

  describe('isLiveMode', () => {
    it('should return false for mock mode', async () => {
      mockStorage[STORAGE_KEYS.DESIGNER_MODE] = 'mock';

      const isLive = await DesignerConfigManager.isLiveMode();

      expect(isLive).toBe(false);
    });

    it('should return true for live mode', async () => {
      mockStorage[STORAGE_KEYS.DESIGNER_MODE] = 'live';

      const isLive = await DesignerConfigManager.isLiveMode();

      expect(isLive).toBe(true);
    });
  });

  describe('reset', () => {
    it('should clear all designer and AXIA keys', async () => {
      mockStorage[STORAGE_KEYS.DESIGNER_MODE] = 'live';
      mockStorage[STORAGE_KEYS.DESIGNER_API_URL] = 'http://localhost:8000';
      mockStorage[STORAGE_KEYS.DESIGNER_PROJECT_ID] = 'reset-test';
      mockStorage['AXIA_BASE'] = 'http://localhost:8000';
      mockStorage['AXIA_PROJECT_ID'] = 'reset-test';

      await DesignerConfigManager.reset();

      expect(mockStorage[STORAGE_KEYS.DESIGNER_MODE]).toBeUndefined();
      expect(mockStorage[STORAGE_KEYS.DESIGNER_API_URL]).toBeUndefined();
      expect(mockStorage[STORAGE_KEYS.DESIGNER_PROJECT_ID]).toBeUndefined();
      expect(mockStorage['AXIA_BASE']).toBeUndefined();
      expect(mockStorage['AXIA_PROJECT_ID']).toBeUndefined();
    });
  });

  describe('watch', () => {
    it('should call callback when config changes', async () => {
      const callback = jest.fn();
      DesignerConfigManager.watch(callback);

      await DesignerConfigManager.setConfig({ mode: 'live' });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(callback).toHaveBeenCalled();
    });

    it('should not call callback for unrelated storage changes', async () => {
      const callback = jest.fn();
      DesignerConfigManager.watch(callback);

      await chrome.storage.local.set({ unrelated_key: 'value' });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string values', async () => {
      await DesignerConfigManager.setConfig({
        mode: 'live',
        apiUrl: '',
        projectId: '',
      });

      const config = await DesignerConfigManager.getConfig();
      expect(config.apiUrl).toBe('');
      expect(config.projectId).toBe('');
    });

    it('should handle rapid mode transitions', async () => {
      await DesignerConfigManager.setConfig({ mode: 'live' });
      await DesignerConfigManager.setConfig({ mode: 'mock' });
      await DesignerConfigManager.setConfig({ mode: 'live' });
      await DesignerConfigManager.setConfig({ mode: 'mock' });

      const finalMode = await DesignerConfigManager.isLiveMode();
      expect(finalMode).toBe(false);
      expect(mockStorage['AXIA_BASE']).toBeUndefined();
    });

    it('should handle URL with trailing slash', async () => {
      mockStorage[STORAGE_KEYS.DESIGNER_MODE] = 'live';
      mockStorage[STORAGE_KEYS.DESIGNER_API_URL] = 'http://localhost:8000/';
      mockStorage[STORAGE_KEYS.DESIGNER_PROJECT_ID] = 'test';

      await DesignerConfigManager.synchronizeToAxiaKeys();

      expect(mockStorage['AXIA_BASE']).toBe('http://localhost:8000/');
    });
  });
});
