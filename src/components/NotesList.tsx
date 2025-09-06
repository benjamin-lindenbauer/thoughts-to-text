'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Note } from '@/types';
import * as dateFns from 'date-fns';
import {
    MoreVertical,
    Edit,
    Trash2,
    Share2,
    Play,
    Pause,
    Clock,
    Calendar,
    Tag,
    Wand2
} from 'lucide-react';
// Simple audio player component for inline playback
function SimpleAudioPlayer({ audioBlob, onEnded }: { audioBlob: Blob; onEnded: () => void }) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const audioUrl = URL.createObjectURL(audioBlob);
        audio.src = audioUrl;

        const handleLoadedMetadata = () => {
            setDuration(audio.duration);
            setIsLoading(false);
        };

        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
        };

        const handleEnded = () => {
            onEnded();
        };

        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('ended', handleEnded);

        // Auto play
        audio.play().catch(console.error);

        return () => {
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('ended', handleEnded);
            URL.revokeObjectURL(audioUrl);
        };
    }, [audioBlob, onEnded]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const audio = audioRef.current;
        if (!audio) return;

        const seekTime = (parseFloat(e.target.value) / 100) * duration;
        audio.currentTime = seekTime;
    };

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                <div className="w-4 h-4 animate-spin rounded-full border-2 border-muted-foreground border-t-indigo-500" />
                <span className="text-sm text-muted-foreground">Loading audio...</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3 p-2 bg-muted rounded-lg">
            <audio ref={audioRef} />
            <Play className="w-4 h-4 text-indigo-500" />
            <input
                type="range"
                min="0"
                max="100"
                value={duration > 0 ? (currentTime / duration) * 100 : 0}
                onChange={handleSeek}
                className="flex-1 h-2 bg-border rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-muted-foreground min-w-[60px]">
                {formatTime(currentTime)} / {formatTime(duration)}
            </span>
        </div>
    );
}

interface NotesListProps {
    notes: Note[];
    loading: boolean;
    onDeleteNote: (note: Note) => Promise<void>;
    onGenerateMetadata: (note: Note) => Promise<void>;
    onEditNote?: (note: Note) => void;
    onShareNote?: (note: Note) => void;
    onViewNote?: (note: Note) => void;
}

interface ContextMenuState {
    isOpen: boolean;
    x: number;
    y: number;
    noteId: string | null;
}

// Virtual scrolling configuration
const ITEM_HEIGHT = 120; // Height of each note item in pixels
const BUFFER_SIZE = 5; // Number of items to render outside visible area

export function NotesList({
    notes,
    loading,
    onDeleteNote,
    onGenerateMetadata,
    onEditNote,
    onShareNote,
    onViewNote
}: NotesListProps) {
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        isOpen: false,
        x: 0,
        y: 0,
        noteId: null,
    });
    const [playingNoteId, setPlayingNoteId] = useState<string | null>(null);
    const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
    const [generatingMetadata, setGeneratingMetadata] = useState<Set<string>>(new Set());

    // Virtual scrolling state
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(600);
    const containerRef = useRef<HTMLDivElement>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);

    // Calculate visible items for virtual scrolling
    const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_SIZE);
    const endIndex = Math.min(
        notes.length,
        Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + BUFFER_SIZE
    );
    const visibleNotes = notes.slice(startIndex, endIndex);
    const totalHeight = notes.length * ITEM_HEIGHT;
    const offsetY = startIndex * ITEM_HEIGHT;

    // Handle scroll for virtual scrolling
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    }, []);

    // Update container height on resize
    useEffect(() => {
        const updateHeight = () => {
            if (containerRef.current) {
                setContainerHeight(containerRef.current.clientHeight);
            }
        };

        updateHeight();
        window.addEventListener('resize', updateHeight);
        return () => window.removeEventListener('resize', updateHeight);
    }, []);

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
            onViewNote(note);
        } else {
            // Fallback to expand/collapse if no navigation handler
            setExpandedNoteId(prev => prev === noteId ? null : noteId);
        }
    }, [notes, onViewNote]);

    // Handle audio play/pause
    const handleAudioToggle = useCallback((noteId: string) => {
        setPlayingNoteId(prev => prev === noteId ? null : noteId);
    }, []);

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
        <div className="relative">
            {/* Virtual scrolling container */}
            <div
                ref={containerRef}
                className="h-[600px] overflow-auto"
                onScroll={handleScroll}
            >
                <div style={{ height: totalHeight, position: 'relative' }}>
                    <div style={{ transform: `translateY(${offsetY}px)` }}>
                        {visibleNotes.map((note) => {
                            const isExpanded = expandedNoteId === note.id;
                            const isPlaying = playingNoteId === note.id;
                            const isGenerating = generatingMetadata.has(note.id);

                            return (
                                <div
                                    key={note.id}
                                    className="mb-4 p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                                    style={{ height: ITEM_HEIGHT }}
                                    onClick={() => handleNoteClick(note.id)}
                                    onContextMenu={(e) => handleContextMenu(e, note.id)}
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

                                        <div className="flex items-center gap-2 ml-3">
                                            {/* Audio play button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleAudioToggle(note.id);
                                                }}
                                                className="p-2 rounded-lg hover:bg-accent transition-colors"
                                            >
                                                {isPlaying ? (
                                                    <Pause className="w-4 h-4 text-indigo-500" />
                                                ) : (
                                                    <Play className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                                                )}
                                            </button>

                                            {/* Generate metadata button */}
                                            {(!note.title || note.title === 'Untitled Note' || !note.description) && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleContextMenuAction('generate', note.id);
                                                    }}
                                                    disabled={isGenerating}
                                                    className="p-2 rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
                                                >
                                                    <Wand2 className={`w-4 h-4 ${isGenerating ? 'animate-spin text-indigo-500' : 'text-muted-foreground hover:text-foreground'}`} />
                                                </button>
                                            )}

                                            {/* Context menu button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleContextMenu(e, note.id);
                                                }}
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

                                                {/* Audio player */}
                                                {isPlaying && (
                                                    <div className="mt-3">
                                                        <SimpleAudioPlayer
                                                            audioBlob={note.audioBlob}
                                                            onEnded={() => setPlayingNoteId(null)}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
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