'use client';

import type React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Note } from '@/types';
import * as dateFns from 'date-fns';
import { MoreVertical, Trash2, Share2, Clock, Calendar, Tag, Wand2 } from 'lucide-react';
import { useFocusManagement } from '@/hooks/useKeyboardNavigation';
import { useAriaLiveRegion } from '@/hooks/useAccessibility';
import { LazyComponent } from '@/components/LazyComponent';

interface NotesListProps {
    notes: Note[];
    loading: boolean;
    onDeleteNote: (note: Note) => Promise<void>;
    onShareNote?: (note: Note) => void;
    onViewNote?: (note: Note) => void;
    className?: string;
    // Infinite loading support
    onEndReached?: () => void;
    hasMore?: boolean;
    // Expandable inline details support
    isOnline?: boolean;
    expandedNoteId?: string | null;
    onExpandNote?: (note: Note) => void;
    onCollapseNote?: () => void;
    renderExpanded?: (note: Note) => React.ReactNode;
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
    onShareNote,
    onViewNote,
    className,
    onEndReached,
    hasMore = false,
    isOnline,
    expandedNoteId,
    onExpandNote,
    onCollapseNote,
    renderExpanded,
}: NotesListProps) {
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        isOpen: false,
        x: 0,
        y: 0,
        noteId: null,
    });
    const containerRef = useRef<HTMLDivElement>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const loadingMoreRef = useRef(false);
    const [isTouch, setIsTouch] = useState(false);
    const [mobileSelectedId, setMobileSelectedId] = useState<string | null>(null);

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

    // Detect touch-capable (mobile) devices
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const mq = window.matchMedia('(hover: none), (pointer: coarse)');
            const hasTouch = mq.matches || ('ontouchstart' in window);
            setIsTouch(hasTouch);
        } catch {
            // Fallback
            setIsTouch('ontouchstart' in (window as any));
        }
    }, []);

    // Close context menu when clicking/tapping outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
                setContextMenu(prev => ({ ...prev, isOpen: false }));
                setMobileSelectedId(null);
            }
        };

        if (contextMenu.isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
                document.removeEventListener('touchstart', handleClickOutside);
            };
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
        // On mobile (long-press), visually mark the pressed card as selected
        if (isTouch) {
            setMobileSelectedId(noteId);
        }
    }, [isTouch]);

    // Handle context menu actions
    const handleContextMenuAction = useCallback(async (action: string, noteId: string) => {
        const note = notes.find(n => n.id === noteId);
        if (!note) return;

        setContextMenu(prev => ({ ...prev, isOpen: false }));
        setMobileSelectedId(null);

        switch (action) {
            case 'delete':
                await onDeleteNote(note);
                break;
            case 'share':
                onShareNote?.(note);
                break;
        }
    }, [notes, onDeleteNote, onShareNote]);

    // Handle note click: expand inline when offline, navigate when online
    const handleNoteClick = useCallback((noteId: string) => {
        const note = notes.find(n => n.id === noteId);
        if (!note) return;

        // If offline and we can render inline details, expand
        const offline = (isOnline === false) || (typeof navigator !== 'undefined' && navigator.onLine === false);
        if (offline && renderExpanded && (onExpandNote || onCollapseNote)) {
            if (expandedNoteId === note.id) {
                onCollapseNote?.();
            } else {
                announce(`Expanding note inline: ${note.title || 'Untitled Note'}`, 'polite');
                onExpandNote?.(note);
            }
            return;
        }

        // Otherwise delegate to onViewNote (navigate)
        if (onViewNote) {
            announce(`Opening note: ${note.title || 'Untitled Note'}`, 'polite');
            onViewNote(note);
        }
    }, [notes, onViewNote, onExpandNote, onCollapseNote, renderExpanded, announce, isOnline, expandedNoteId]);

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
                                className={`mb-4 p-4 rounded-xl border border-border bg-card hover:bg-accent transition-colors cursor-pointer ${isTouch ? 'select-none' : 'select-text'} ${isTouch && mobileSelectedId === note.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
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
                                data-note-id={note.id}
                                aria-expanded={((isOnline === false) || (typeof navigator !== 'undefined' && navigator.onLine === false)) && expandedNoteId === note.id}
                                aria-label={`Note: ${note.title || 'Untitled'}. Created ${dateFns.formatDistanceToNow(note.createdAt, { addSuffix: true })}. Duration ${formatDuration(note.duration)}.`}
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

                                <div className="hidden lg:flex items-center gap-2 ml-2">
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

                            {/* Inline expanded content (offline) */}
                            {expandedNoteId === note.id && renderExpanded && (
                                <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                                    {renderExpanded(note)}
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
                    className="absolute min-w-24 z-50 bg-card border border-border rounded-lg shadow-md py-2 left-[var(--x)] top-[var(--y)] max-sm:left-auto max-sm:right-2"
                    style={{
                        // Use CSS variables to allow Tailwind arbitrary values for positioning
                        ['--x' as any]: `${contextMenu.x}px`,
                        ['--y' as any]: `${contextMenu.y}px`,
                    }}
                >
                    <button
                        onClick={() => handleContextMenuAction('share', contextMenu.noteId!)}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                    >
                        <Share2 className="w-4 h-4" />
                        Share
                    </button>

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