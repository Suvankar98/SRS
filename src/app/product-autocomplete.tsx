"use client";

import React from "react";

type ProductOption = {
  id: string;
  name: string;
};

type ProductAutocompleteProps = {
  products: ProductOption[];
  name?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  inputClassName?: string;
};

export function ProductAutocomplete({
  products,
  name,
  label = "Product",
  placeholder = "Type product name",
  required = false,
  value,
  defaultValue = "",
  onChange,
  inputClassName,
}: ProductAutocompleteProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const query = value ?? internalValue;

  const suggestions = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery === "") {
      return [];
    }

    return products
      .filter((product) => product.name.toLowerCase().startsWith(normalizedQuery))
      .slice(0, 10);
  }, [products, query]);

  const updateValue = (nextValue: string) => {
    setInternalValue(nextValue);
    onChange?.(nextValue);
  };

  const selectProduct = (nextValue: string) => {
    updateValue(nextValue);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectProduct(suggestions[activeIndex].name);
    } else if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div className="relative">
      <label className="block">
        {label ? <span className="mb-2 block text-sm font-medium text-blue-700">{label}</span> : null}
        <input
          name={name}
          value={query}
          onChange={(event) => {
            updateValue(event.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setIsOpen(query.trim() !== "")}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className={
            inputClassName ??
            "w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition placeholder:text-blue-400 focus:border-blue-400 focus:bg-white"
          }
          required={required}
        />
      </label>

      {isOpen && query.trim() !== "" && suggestions.length === 0 ? (
        <div className="absolute left-0 right-0 z-20 mt-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 shadow-lg">
          No matching products found.
        </div>
      ) : null}

      {isOpen && suggestions.length > 0 ? (
        <ul className="absolute left-0 right-0 z-20 mt-2 max-h-64 overflow-auto rounded-2xl border border-blue-200 bg-white shadow-lg">
          {suggestions.map((product, index) => (
            <li
              key={product.id}
              onMouseDown={(event) => {
                event.preventDefault();
                selectProduct(product.name);
              }}
              className={`cursor-pointer px-4 py-3 text-sm text-blue-900 hover:bg-blue-50 ${
                index === activeIndex ? "bg-blue-100" : ""
              }`}
            >
              {product.name}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
