import { useMemo } from 'react';
import { Note } from '@/types';
import { SearchFilters } from '@/components/NotesSearch';
import { 
  isToday, 
  isThisWeek, 
  isThisMonth, 
  isThisYear,
  compareAsc,
  compareDesc
} from 'date-fns';

export function useNotesFilter(notes: Note[], searchQuery: string, filters: SearchFilters) {
  const filteredAndSortedNotes = useMemo(() => {
    let filtered = [...notes];

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(note => 
        note.title.toLowerCase().includes(query) ||
        note.description.toLowerCase().includes(query) ||
        note.transcript.toLowerCase().includes(query) ||
        (note.rewrittenText && note.rewrittenText.toLowerCase().includes(query)) ||
        note.keywords.some(keyword => keyword.toLowerCase().includes(query))
      );
    }

    // Apply date range filter
    if (filters.dateRange !== 'all') {
      filtered = filtered.filter(note => {
        const noteDate = note.createdAt;
        switch (filters.dateRange) {
          case 'today':
            return isToday(noteDate);
          case 'week':
            return isThisWeek(noteDate);
          case 'month':
            return isThisMonth(noteDate);
          case 'year':
            return isThisYear(noteDate);
          default:
            return true;
        }
      });
    }

    // Apply duration filters
    if (filters.minDuration !== undefined) {
      filtered = filtered.filter(note => note.duration >= filters.minDuration!);
    }
    if (filters.maxDuration !== undefined) {
      filtered = filtered.filter(note => note.duration <= filters.maxDuration!);
    }

    // Apply content filters
    if (filters.hasImage) {
      filtered = filtered.filter(note => !!note.photoBlob);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (filters.sortBy) {
        case 'date':
          comparison = filters.sortOrder === 'asc' 
            ? compareAsc(a.createdAt, b.createdAt)
            : compareDesc(a.createdAt, b.createdAt);
          break;
        case 'title':
          const titleA = a.title.toLowerCase();
          const titleB = b.title.toLowerCase();
          comparison = filters.sortOrder === 'asc'
            ? titleA.localeCompare(titleB)
            : titleB.localeCompare(titleA);
          break;
        case 'duration':
          comparison = filters.sortOrder === 'asc'
            ? a.duration - b.duration
            : b.duration - a.duration;
          break;
        default:
          comparison = compareDesc(a.createdAt, b.createdAt);
      }
      
      return comparison;
    });

    return filtered;
  }, [notes, searchQuery, filters]);

  return filteredAndSortedNotes;
}