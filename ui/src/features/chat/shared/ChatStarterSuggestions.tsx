import { ArrowUpRight, BarChart3, Database, Sparkles } from "lucide-react";

export interface StarterQuestion {
  id: string;
  prompt: string;
}

interface ChatStarterSuggestionsProps {
  disabled?: boolean;
  heading: string;
  onSelect: (prompt: string) => void;
  questions: StarterQuestion[];
}

const suggestionIcons = [Database, BarChart3, Sparkles];

export function ChatStarterSuggestions({
  disabled,
  heading,
  onSelect,
  questions,
}: ChatStarterSuggestionsProps) {
  return (
    <section className="flex min-h-[calc(100dvh-12rem)] min-w-0 w-full items-center justify-center overflow-hidden px-4 py-10 sm:py-12">
      <div className="min-w-0 w-full max-w-3xl">
        <div className="mb-7 text-center">
          <h1 className="text-balance text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">
            {heading}
          </h1>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {questions.slice(0, 3).map((question, index) => {
            const Icon = suggestionIcons[index] ?? Sparkles;
            return (
              <button
                key={question.id}
                type="button"
                disabled={disabled}
                className="group flex min-h-32 min-w-0 flex-col justify-between rounded-md border bg-background p-4 text-left shadow-sm transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5 hover:border-foreground/25 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                onClick={() => onSelect(question.prompt)}
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-8 items-center justify-center rounded-md border bg-muted/60">
                    <Icon className="size-4" />
                  </span>
                  <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
                <span className="mt-5 break-words text-sm font-medium leading-6 text-foreground">
                  {question.prompt}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
