package realtime

import (
	"sync"
	"time"
)

type cacheEntry struct {
	entries   []PortfolioEntry
	timestamp int64
}

type PortfolioCache struct {
	mu           sync.RWMutex
	storage      map[string]cacheEntry
	maxCacheAge  int64
}

func NewPortfolioCache(maxCacheAge time.Duration) *PortfolioCache {
	if maxCacheAge == 0 {
		maxCacheAge = 24 * time.Hour
	}
	return &PortfolioCache{
		storage:     make(map[string]cacheEntry),
		maxCacheAge: maxCacheAge.Milliseconds(),
	}
}

func (c *PortfolioCache) Get(address string) ([]PortfolioEntry, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, ok := c.storage[address]
	if !ok {
		return nil, false
	}
	now := time.Now().UnixMilli()
	if now-entry.timestamp > c.maxCacheAge {
		return nil, false
	}
	return entry.entries, true
}

func (c *PortfolioCache) Set(address string, entries []PortfolioEntry) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.storage[address] = cacheEntry{
		entries:   entries,
		timestamp: time.Now().UnixMilli(),
	}
}

func (c *PortfolioCache) Remove(address string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.storage, address)
}

func (c *PortfolioCache) GetAll() map[string][]PortfolioEntry {
	c.mu.RLock()
	defer c.mu.RUnlock()

	result := make(map[string][]PortfolioEntry)
	now := time.Now().UnixMilli()
	for addr, entry := range c.storage {
		if now-entry.timestamp <= c.maxCacheAge {
			result[addr] = entry.entries
		}
	}
	return result
}

func (c *PortfolioCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.storage = make(map[string]cacheEntry)
}

func (c *PortfolioCache) Cleanup() int {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now().UnixMilli()
	removed := 0
	for addr, entry := range c.storage {
		if now-entry.timestamp > c.maxCacheAge {
			delete(c.storage, addr)
			removed++
		}
	}
	return removed
}
