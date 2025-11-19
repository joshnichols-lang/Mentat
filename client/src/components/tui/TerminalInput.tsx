import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";

interface TerminalInputProps {
  onSubmit: (command: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function TerminalInput({ onSubmit, placeholder = "Enter command...", disabled = false }: TerminalInputProps) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || disabled) return;
    
    onSubmit(input);
    setHistory(prev => [...prev, input]);
    setInput("");
    setHistoryIndex(-1);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput("");
      }
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 p-2 bg-background border-t border-primary">
      <span className="text-primary text-sm font-bold">&gt;</span>
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 bg-transparent border-none outline-none text-primary text-sm font-mono placeholder:text-primary/30"
        data-testid="terminal-input"
      />
      <button
        type="submit"
        disabled={!input.trim() || disabled}
        className="text-primary hover:text-secondary disabled:opacity-30 disabled:cursor-not-allowed"
        data-testid="terminal-submit"
      >
        <Send size={14} />
      </button>
    </form>
  );
}
