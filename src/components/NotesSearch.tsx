'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Filter, X, Calendar, Clock, Tag, SortAsc, SortDesc } from 'lucide-react';
import { Note } from '@/types';

interface NotesSearchProps {
  onSearch: (query: string) => void;
  onFilter: (filters: SearchFilters) => void;
  searchQuery: string;
  totalNotes: number;
  filteredCount: number;
}

export interface SearchFilters {
  sortBy: 'date' | 'title' | 'duration';
  sortOrder: 'asc' | 'desc';
  dateRange: 'all' | 'today' | 'week' | 'month' | 'year';
  hasKeywords: boolean;
  hasRewrittenText: boolean;
  minDuration?: number;
  maxDuration?: number;
}

const DEFAULT_FILTERS: SearchFilters = {
  sortBy: 'date',
  sortOrder: 'desc',
  dateRange: 'all',
  hasKeywords: false,
  hasRewrittenText: false,
};

export function NotesSearch({ 
  onSearch, 
  onFilter, 
  searchQuery, 
  totalNotes, 
  filteredCount 
}: NotesSearchProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  
  const filterRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  const debouncedSearch = useCallback((query: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      onSearch(query);
    }, 300);
  }, [onSearch]);

  // Handle search input change
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setLocalSearchQuery(query);
    debouncedSearch(query);
  }, [debouncedSearch]);

  // Clear search
  const clearSearch = useCallback(() => {
    setLocalSearchQuery('');
    onSearch('');
  }, [onSearch]);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: Partial<SearchFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFilter(updatedFilters);
  }, [filters, onFilter]);

  // Reset filters
  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    onFilter(DEFAULT_FILTERS);
  }, [onFilter]);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };

    if (isFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isFilterOpen]);

  // Check if filters are active
  const hasActiveFilters = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search notes..."
            value={localSearchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-10 py-3 rounded-xl border"
          />
          {localSearchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-accent transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
        
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`p-3 md:p-4 rounded-xl border border-border bg-card transition-colors touch-manipulation active:scale-95 ${
              hasActiveFilters 
                ? 'text-indigo-500 border-indigo-200 bg-indigo-50 dark:bg-indigo-950 dark:border-indigo-800' 
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>
          
          {/* Filter Dropdown */}
          {isFilterOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 max-w-none bg-card border border-border rounded-xl shadow p-4 z-50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-foreground">Filter & Sort</h3>
                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="text-sm text-indigo-500 hover:text-indigo-600 transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
              
              {/* Sort Options */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Sort by
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={filters.sortBy}
                      onChange={(e) => handleFilterChange({ sortBy: e.target.value as SearchFilters['sortBy'] })}
                      className="px-3 py-2 rounded-lg border border-border bg-secondary text-foreground text-sm"
                    >
                      <option value="date">Date</option>
                      <option value="title">Title</option>
                      <option value="duration">Duration</option>
                    </select>
                    
                    <button
                      onClick={() => handleFilterChange({ 
                        sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' 
                      })}
                      className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border bg-secondary text-foreground text-sm hover:bg-accent transition-colors"
                    >
                      {filters.sortOrder === 'asc' ? (
                        <>
                          <SortAsc className="w-4 h-4" />
                          Asc
                        </>
                      ) : (
                        <>
                          <SortDesc className="w-4 h-4" />
                          Desc
                        </>
                      )}
                    </button>
                  </div>
                </div>
                
                {/* Date Range */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Date Range
                  </label>
                  <select
                    value={filters.dateRange}
                    onChange={(e) => handleFilterChange({ dateRange: e.target.value as SearchFilters['dateRange'] })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-foreground text-sm"
                  >
                    <option value="all">All time</option>
                    <option value="today">Today</option>
                    <option value="week">This week</option>
                    <option value="month">This month</option>
                    <option value="year">This year</option>
                  </select>
                </div>
                
                {/* Duration Range */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Duration (seconds)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={filters.minDuration || ''}
                      onChange={(e) => handleFilterChange({ 
                        minDuration: e.target.value ? parseInt(e.target.value) : undefined 
                      })}
                      className="px-3 py-2 rounded-lg border border-border bg-secondary text-foreground text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={filters.maxDuration || ''}
                      onChange={(e) => handleFilterChange({ 
                        maxDuration: e.target.value ? parseInt(e.target.value) : undefined 
                      })}
                      className="px-3 py-2 rounded-lg border border-border bg-secondary text-foreground text-sm"
                    />
                  </div>
                </div>
                
                {/* Content Filters */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-foreground">
                    Content
                  </label>
                  
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.hasKeywords}
                      onChange={(e) => handleFilterChange({ hasKeywords: e.target.checked })}
                      className="w-4 h-4 text-indigo-500 border-border rounded"
                    />
                    <span className="text-sm text-foreground">Has keywords</span>
                  </label>
                  
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.hasRewrittenText}
                      onChange={(e) => handleFilterChange({ hasRewrittenText: e.target.checked })}
                      className="w-4 h-4 text-indigo-500 border-border rounded"
                    />
                    <span className="text-sm text-foreground">Has enhanced text</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Results Summary */}
      {(searchQuery || hasActiveFilters) && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {filteredCount} of {totalNotes} notes
            {searchQuery && (
              <span> for "{searchQuery}"</span>
            )}
          </span>
          
          {(searchQuery || hasActiveFilters) && (
            <button
              onClick={() => {
                clearSearch();
                resetFilters();
              }}
              className="text-indigo-500 hover:text-indigo-600 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}