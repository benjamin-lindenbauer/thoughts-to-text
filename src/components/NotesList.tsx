'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Note } from '@/types';
import * as dateFns from 'date-fns';
import { MoreVertical, Edit, Trash2, Share2, Clock, Calendar, Tag, Wand2 } from 'lucide-react';
import { useFocusManagement } from '@/hooks/useKeyboardNavigation';
import { useAriaLiveRegion } from '@/hooks/useAccessibility';
import { LazyComponent } from '@/components/LazyComponent';

interface NotesListProps {
    notes: Note[];
    loading: boolean;
    onDeleteNote: (note: Note) => Promise<void>;
    onGenerateMetadata: (note: Note) => Promise<void>;
    onEditNote?: (note: Note) => void;
    onShareNote?: (note: Note) => void;
    onViewNote?: (note: Note) => void;
    className?: string;
    // Infinite loading support
    onEndReached?: () => void;
    hasMore?: boolean;
}

interface ContextMenuState {
    isOpen: boolean;
    x: number;
    y: number;
    noteId: string | null;
}

export function NotesList({
    notes,
    loading,
    onDeleteNote,
    onGenerateMetadata,
    onEditNote,
    onShareNote,
    onViewNote,
    className,
    onEndReached,
    hasMore = false
}: NotesListProps) {
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        isOpen: false,
        x: 0,
        y: 0,
        noteId: null,
    });
    const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
    const [generatingMetadata, setGeneratingMetadata] = useState<Set<string>>(new Set());

    const containerRef = useRef<HTMLDivElement>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const loadingMoreRef = useRef(false);

    // Accessibility hooks
    const { announce, LiveRegion } = useAriaLiveRegion();
    const { containerRef: focusContainerRef, focusNext, focusPrevious } = useFocusManagement();

    // Intersection observer for infinite loading
    useEffect(() => {
        if (!onEndReached || !hasMore) return;
        const root = containerRef.current;
        const target = sentinelRef.current;
        if (!root || !target) return;

        const io = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry.isIntersecting && !loadingMoreRef.current) {
                    loadingMoreRef.current = true;
                    onEndReached();
                    // simple throttle to avoid rapid firing
                    setTimeout(() => {
                        loadingMoreRef.current = false;
                    }, 300);
                }
            },
            { root, rootMargin: '200px' }
        );

        io.observe(target);
        return () => io.disconnect();
    }, [onEndReached, hasMore]);

    // Close context menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
                setContextMenu(prev => ({ ...prev, isOpen: false }));
            }
        };

        if (contextMenu.isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [contextMenu.isOpen]);

    // Handle context menu
    const handleContextMenu = useCallback((e: React.MouseEvent, noteId: string) => {
        e.preventDefault();
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        setContextMenu({
            isOpen: true,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            noteId,
        });
    }, []);

    // Handle context menu actions
    const handleContextMenuAction = useCallback(async (action: string, noteId: string) => {
        const note = notes.find(n => n.id === noteId);
        if (!note) return;

        setContextMenu(prev => ({ ...prev, isOpen: false }));

        switch (action) {
            case 'edit':
                onEditNote?.(note);
                break;
            case 'delete':
                await onDeleteNote(note);
                break;
            case 'share':
                onShareNote?.(note);
                break;
            case 'generate':
                setGeneratingMetadata(prev => new Set(prev).add(noteId));
                try {
                    await onGenerateMetadata(note);
                } finally {
                    setGeneratingMetadata(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(noteId);
                        return newSet;
                    });
                }
                break;
        }
    }, [notes, onDeleteNote, onGenerateMetadata, onEditNote, onShareNote]);

    // Handle note click to navigate to details
    const handleNoteClick = useCallback((noteId: string) => {
        const note = notes.find(n => n.id === noteId);
        if (note && onViewNote) {
            announce(`Opening note: ${note.title || 'Untitled Note'}`, 'polite');
            onViewNote(note);
        } else {
            // Fallback to expand/collapse if no navigation handler
            const isExpanding = expandedNoteId !== noteId;
            setExpandedNoteId(prev => prev === noteId ? null : noteId);
            announce(
              isExpanding 
                ? `Expanded note: ${note?.title || 'Untitled Note'}` 
                : 'Collapsed note',
              'polite'
            );
        }
    }, [notes, onViewNote, expandedNoteId, announce]);

    // Format duration
    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Truncate text
    const truncateText = (text: string, maxLength: number): string => {
        return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
    };

    if (loading) {
        return (
            <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="p-4 rounded-xl border border-border bg-card animate-pulse">
                        <div className="flex justify-between items-start mb-3">
                            <div className="h-5 bg-muted rounded w-3/4"></div>
                            <div className="h-4 bg-muted rounded w-16"></div>
                        </div>
                        <div className="h-4 bg-muted rounded w-full mb-2"></div>
                        <div className="h-4 bg-muted rounded w-2/3"></div>
                    </div>
                ))}
            </div>
        );
    }

    if (notes.length === 0) {
        return (
            <div className="text-center py-12 md:py-16">
                <div className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 md:mb-6 rounded-full bg-muted flex items-center justify-center">
                    <Calendar className="w-8 h-8 md:w-10 md:h-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg md:text-xl font-medium text-foreground mb-2">
                    No notes yet
                </h3>
                <p className="text-sm md:text-base text-muted-foreground max-w-sm mx-auto">
                    Start recording to create your first note and build your collection of thoughts
                </p>
            </div>
        );
    }

    return (
        <div className="relative h-full min-h-0 flex flex-col">
            {/* Live region for announcements */}
            <LiveRegion />
            
            {/* Scroll container */}
            <div
                ref={(el) => {
                  containerRef.current = el;
                  focusContainerRef.current = el;
                }}
                role="list"
                aria-label={`Notes list with ${notes.length} notes`}
                tabIndex={0}
                className={className}
            >
                {notes.map((note) => {
                            const isExpanded = expandedNoteId === note.id;

                            return (
                                <LazyComponent
                                    key={note.id}
                                    fallback={
                                        <div 
                                            className="mb-4 p-4 rounded-xl border border-border bg-card animate-pulse"
                                        >
                                            <div className="h-5 bg-muted rounded w-3/4 mb-2"></div>
                                            <div className="h-4 bg-muted rounded w-full mb-2"></div>
                                            <div className="h-4 bg-muted rounded w-2/3"></div>
                                        </div>
                                    }
                                >
                                    <div
                                        className="mb-4 p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                                        onClick={() => handleNoteClick(note.id)}
                                        onContextMenu={(e) => handleContextMenu(e, note.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                handleNoteClick(note.id);
                                            }
                                        }}
                                        role="listitem"
                                        tabIndex={0}
                                        aria-label={`Note: ${note.title || 'Untitled'}. Created ${dateFns.formatDistanceToNow(note.createdAt, { addSuffix: true })}. Duration ${formatDuration(note.duration)}.`}
                                        aria-expanded={isExpanded}
                                    >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-medium text-foreground truncate">
                                                {note.title || 'Untitled Note'}
                                            </h3>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {dateFns.formatDistanceToNow(note.createdAt, { addSuffix: true })}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {formatDuration(note.duration)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 ml-2">
                                            {/* Context menu button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleContextMenu(e, note.id);
                                                }}
                                                aria-label={`More options for ${note.title || 'note'}`}
                                                aria-haspopup="menu"
                                                className="p-2 rounded-lg hover:bg-accent transition-colors"
                                            >
                                                <MoreVertical className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Note description */}
                                    <p className="text-sm text-muted-foreground mb-2">
                                        {note.description || truncateText(note.transcript, 100)}
                                    </p>

                                    {/* Keywords */}
                                    {note.keywords.length > 0 && (
                                        <div className="flex items-center gap-2 mb-2">
                                            <Tag className="w-3 h-3 text-muted-foreground" />
                                            <div className="flex flex-wrap gap-1">
                                                {note.keywords.slice(0, 3).map((keyword, index) => (
                                                    <span
                                                        key={index}
                                                        className="px-2 py-1 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full"
                                                    >
                                                        {keyword}
                                                    </span>
                                                ))}
                                                {note.keywords.length > 3 && (
                                                    <span className="text-xs text-muted-foreground">
                                                        +{note.keywords.length - 3} more
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Expanded content */}
                                    {isExpanded && (
                                        <div className="mt-3 pt-3 border-t border-border">
                                            <div className="space-y-3">
                                                <div>
                                                    <h4 className="text-sm font-medium text-foreground mb-1">Transcript</h4>
                                                    <p className="text-sm text-muted-foreground">{note.transcript}</p>
                                                </div>

                                                {note.rewrittenText && (
                                                    <div>
                                                        <h4 className="text-sm font-medium text-foreground mb-1">Enhanced Text</h4>
                                                        <p className="text-sm text-muted-foreground">{note.rewrittenText}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    </div>
                                </LazyComponent>
                            );
                        })}

                {/* Infinite load sentinel */}
                {hasMore && (
                    <div ref={sentinelRef} aria-hidden="true" className="h-8" />
                )}
            </div>

            {/* Context Menu */}
            {contextMenu.isOpen && (
                <div
                    ref={contextMenuRef}
                    className="absolute z-50 bg-card border border-border rounded-lg shadow-lg py-2 min-w-[160px]"
                    style={{
                        left: contextMenu.x,
                        top: contextMenu.y,
                    }}
                >
                    <button
                        onClick={() => handleContextMenuAction('edit', contextMenu.noteId!)}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                    >
                        <Edit className="w-4 h-4" />
                        Edit
                    </button>

                    <button
                        onClick={() => handleContextMenuAction('generate', contextMenu.noteId!)}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                    >
                        <Wand2 className="w-4 h-4" />
                        Generate Title & Description
                    </button>

                    <button
                        onClick={() => handleContextMenuAction('share', contextMenu.noteId!)}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                    >
                        <Share2 className="w-4 h-4" />
                        Share
                    </button>

                    <hr className="my-2 border-border" />

                    <button
                        onClick={() => handleContextMenuAction('delete', contextMenu.noteId!)}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-destructive/10 text-destructive transition-colors flex items-center gap-2"
                    >
                        <Trash2 className="w-4 h-4" />
                        Delete
                    </button>
                </div>
            )}
        </div>
    );
}