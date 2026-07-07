"use client";

import React from "react";

export function AreaAutocomplete() {
  const [query, setQuery] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [noResults, setNoResults] = React.useState(false);
  const timeoutRef = React.useRef<number | null>(null);
  const latestQueryRef = React.useRef("");

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const scheduleSearch = (nextQuery: string) => {
    latestQueryRef.current = nextQuery;

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    if (nextQuery.length < 2) {
      setSuggestions([]);
      setActiveIndex(-1);
      setError(null);
      setNoResults(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setNoResults(false);

    timeoutRef.current = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/places/autocomplete?query=${encodeURIComponent(nextQuery)}`);
        const data = await response.json();

        if (!response.ok) {
          const message = data?.error || "Unable to fetch area suggestions";
          throw new Error(message + (data?.googleStatus ? ` (Google status: ${data.googleStatus})` : ""));
        }

        if (latestQueryRef.current !== nextQuery) {
          return;
        }

        const nextSuggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
        setSuggestions(nextSuggestions);
        setNoResults(nextSuggestions.length === 0);
      } catch (err) {
        if (latestQueryRef.current !== nextQuery) {
          return;
        }

        setError(err instanceof Error ? err.message : "Unable to load area suggestions");
        setSuggestions([]);
      } finally {
        if (latestQueryRef.current === nextQuery) {
          setLoading(false);
        }
      }
    }, 300);
  };

  const handleSelect = (value: string) => {
    latestQueryRef.current = value;
    setQuery(value);
    setSuggestions([]);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      if (activeIndex >= 0) {
        event.preventDefault();
        handleSelect(suggestions[activeIndex]);
      }
    }
  };

  return (
    <div className="relative">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-blue-700">Area</span>
        <input
          name="area"
          value={query}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            setActiveIndex(-1);
            scheduleSearch(nextQuery);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type area name"
          autoComplete="off"
          className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition placeholder:text-blue-400 focus:border-blue-400 focus:bg-white"
          required
        />
      </label>

      {loading ? (
        <div className="absolute left-0 right-0 z-10 mt-2 rounded-2xl border border-blue-200 bg-white p-3 text-sm text-blue-700 shadow-lg">
          Loading suggestions...
        </div>
      ) : null}

      {error ? (
        <div className="absolute left-0 right-0 z-10 mt-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 shadow-lg">
          {error}
        </div>
      ) : null}

      {noResults && !loading ? (
        <div className="absolute left-0 right-0 z-10 mt-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 shadow-lg">
          No area suggestions found. Try a different search.
        </div>
      ) : null}

      {!loading && suggestions.length > 0 ? (
        <ul className="absolute left-0 right-0 z-10 mt-2 max-h-64 overflow-auto rounded-2xl border border-blue-200 bg-white shadow-lg">
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion}
              onClick={() => handleSelect(suggestion)}
              className={`cursor-pointer px-4 py-3 text-sm text-blue-900 hover:bg-blue-50 ${index === activeIndex ? "bg-blue-100" : ""}`}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
