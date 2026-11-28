import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';

interface TagEditorProps {
    id: string;
    tags: string[];
    onChange: (tags: string[]) => void;
    suggestions: string[];
}

export function TagEditor({ id, tags, onChange, suggestions }: TagEditorProps) {
    const [draft, setDraft] = useState('');

    const commit = (raw: string) => {
        const next = [...tags];
        raw
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
            .forEach((tag) => {
                if (!next.some((existing) => existing.toLowerCase() === tag.toLowerCase())) next.push(tag);
            });
        if (next.length !== tags.length) onChange(next);
        setDraft('');
    };

    const reusable = suggestions
        .filter((tag) => !tags.some((existing) => existing.toLowerCase() === tag.toLowerCase()))
        .slice(0, 6);

    return (
        <div className="space-y-2">
            <Label htmlFor={id}>Tags</Label>
            {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                        <span
                            key={tag}
                            className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                        >
                            #{tag}
                            <button
                                type="button"
                                aria-label={`Remove tag ${tag}`}
                                className="rounded-full text-primary/70 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                onClick={() => onChange(tags.filter((t) => t !== tag))}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}
            <Input
                id={id}
                value={draft}
                autoComplete="off"
                placeholder="travel, reimbursable — press Enter to add"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        commit(draft);
                    } else if (e.key === 'Backspace' && !draft && tags.length) {
                        onChange(tags.slice(0, -1));
                    }
                }}
                onBlur={() => commit(draft)}
            />
            {reusable.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">Reuse:</span>
                    {reusable.map((tag) => (
                        <button
                            key={tag}
                            type="button"
                            onClick={() => commit(tag)}
                            className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            #{tag}
                        </button>
                    ))}
                </div>
            )}
            <p className="text-[11px] text-muted-foreground">Optional labels used by the tag filter, budgets and tax deductions.</p>
        </div>
    );
}
