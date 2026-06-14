"use client";

import { useState, useRef, useEffect } from "react";

/**
 * Props for the SearchableSelect component
 */
export type SearchableSelectProps<T> = {
  /** Array of options to display */
  options: T[];
  /** Currently selected value (null if nothing selected) */
  value: string | null;
  /** Callback when selection changes */
  onChange: (value: string | null) => void;
  /** Function to extract value from option */
  getOptionValue: (option: T) => string;
  /** Function to extract display label from option */
  getOptionLabel: (option: T) => string;
  /** Placeholder text when no value is selected */
  placeholder?: string;
  /** Placeholder text for search input */
  searchPlaceholder?: string;
  /** Whether options are currently loading */
  loading?: boolean;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Text to show when no options match search */
  emptyText?: string;
};

/**
 * SearchableSelect - A combobox component with search, keyboard navigation, and accessibility
 * 
 * Features:
 * - Real-time search filtering
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Click outside to close
 * - Smooth animations
 * - ARIA accessibility attributes
 * - Loading and empty states
 */
export function SearchableSelect<T>({
  options,
  value,
  onChange,
  getOptionValue,
  getOptionLabel,
  placeholder = "Select an option",
  searchPlaceholder = "Search...",
  loading = false,
  disabled = false,
  emptyText = "No results found",
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Find currently selected option
  const selectedOption = options.find((opt) => getOptionValue(opt) === value);

  // Filter options based on search text
  const filteredOptions = options.filter((opt) =>
    getOptionLabel(opt).toLowerCase().includes(searchText.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchText("");
        setHighlightedIndex(-1);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Reset highlighted index when filtered options change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchText]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[
        highlightedIndex
      ] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!isOpen) return;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          event.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case "Enter":
          event.preventDefault();
          if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
            handleSelect(filteredOptions[highlightedIndex]);
          }
          break;
        case "Escape":
          event.preventDefault();
          setIsOpen(false);
          setSearchText("");
          setHighlightedIndex(-1);
          break;
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, highlightedIndex, filteredOptions]);

  const handleToggle = () => {
    if (disabled || loading) return;
    setIsOpen(!isOpen);
    if (isOpen) {
      setSearchText("");
      setHighlightedIndex(-1);
    }
  };

  const handleSelect = (option: T) => {
    onChange(getOptionValue(option));
    setIsOpen(false);
    setSearchText("");
    setHighlightedIndex(-1);
  };

  const handleClear = (event: React.MouseEvent) => {
    event.stopPropagation();
    onChange(null);
    setSearchText("");
    setHighlightedIndex(-1);
  };

  // Show loading skeleton
  if (loading) {
    return (
      <div className="w-full bg-sidebar border border-border rounded-lg px-3 py-2 animate-pulse">
        <div className="h-5 bg-gray-700/50 rounded" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Closed State - Button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className="w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-left text-sm text-white focus:outline-none focus:border-sweat disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between transition-colors"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls="searchable-select-list"
        role="combobox"
      >
        <span className={selectedOption ? "text-white" : "text-gray-500"}>
          {selectedOption ? getOptionLabel(selectedOption) : placeholder}
        </span>
        <div className="flex items-center gap-2">
          {selectedOption && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleClear(e as any);
                }
              }}
              className="text-gray-400 hover:text-white transition-colors cursor-pointer"
              aria-label="Clear selection"
            >
              ×
            </span>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
              isOpen ? "rotate-180" : "rotate-0"
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {/* Open State - Dropdown */}
      {isOpen && (
        <div
          className="absolute z-50 w-full mt-1 bg-sidebar border border-border rounded-lg shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
          role="listbox"
          id="searchable-select-list"
        >
          {/* Search Input */}
          <div className="p-2 border-b border-border">
            <input
              ref={searchInputRef}
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-card border border-border rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sweat"
              aria-label="Search options"
            />
          </div>

          {/* Options List */}
          <ul
            ref={listRef}
            className="max-h-48 overflow-y-auto"
            role="listbox"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-gray-500">
                {options.length === 0 ? "No options available" : emptyText}
              </li>
            ) : (
              filteredOptions.map((option, index) => {
                const optionValue = getOptionValue(option);
                const optionLabel = getOptionLabel(option);
                const isSelected = optionValue === value;
                const isHighlighted = index === highlightedIndex;

                return (
                  <li
                    key={optionValue}
                    onClick={() => handleSelect(option)}
                    className={`px-3 py-2 text-sm cursor-pointer transition-colors flex items-center justify-between ${
                      isSelected
                        ? "text-sweat bg-sweat/10"
                        : isHighlighted
                        ? "text-white bg-white/10"
                        : "text-white hover:bg-white/10"
                    }`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span className="truncate">{optionLabel}</span>
                    {isSelected && (
                      <svg
                        className="w-4 h-4 text-sweat flex-shrink-0 ml-2"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
