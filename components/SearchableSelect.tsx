"use client";

import { useState, useRef, useEffect } from "react";

type Option = {
  value: string;
  label: string;
};

type SearchableSelectProps = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  style?: React.CSSProperties;
  focusColor?: string;
  disabled?: boolean;
  placeholderColor?: string;
};

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  className = "",
  style = {},
  focusColor = "#3B82F6",
  disabled = false,
  placeholderColor = "#9ca3af"
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filtrar opciones basado en el término de búsqueda
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Encontrar la opción seleccionada
  const selectedOption = options.find(option => option.value === value);

  // Cerrar dropdown cuando se hace clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
        setHighlightedIndex(-1);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Manejar teclas de navegación
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex(0);
      return;
    }

    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex].value);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSearchTerm("");
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setIsOpen(false);
    setSearchTerm("");
    setHighlightedIndex(-1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = e.target.value;
    setSearchTerm(newSearchTerm);
    setHighlightedIndex(0);

    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const displayValue = isOpen ? searchTerm : (selectedOption?.label || "");

  return (
    <div ref={dropdownRef} className="relative">
      <div className={`relative ${className}`} style={style}>
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onClick={() => {
            if (disabled) return;
            setIsOpen(!isOpen);
            if (!isOpen) {
              setHighlightedIndex(0);
            }
          }}
          placeholder={placeholder}
          className={`w-full px-3 py-1.5 rounded border border-black text-sm h-8 bg-white pr-8 outline-none ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          style={{
            ...(style || {}),
            '--placeholder-color': placeholderColor
          } as React.CSSProperties & { '--placeholder-color': string }}
          onFocus={(e) => {
            if (!disabled) {
              e.target.style.borderColor = focusColor.replace('40', '');
              e.target.style.boxShadow = `0 0 0 2px ${focusColor}`;
            }
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#000000';
            e.target.style.boxShadow = '';
          }}
          autoComplete="off"
          disabled={disabled}
        />
        <style jsx>{`
          input::placeholder {
            color: ${placeholderColor};
          }
        `}</style>
        <div
          className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none"
          style={{
            width: "12px",
            height: "12px",
            backgroundImage: "url('data:image/svg+xml;charset=US-ASCII,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"4\" height=\"5\"><path fill=\"%23666\" d=\"M2 0L0 2h4zm0 5L0 3h4z\"/></svg>')",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            backgroundSize: "12px"
          }}
        />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredOptions.length > 0 ? (
            <>
              {/* Opción vacía si hay placeholder */}
              {placeholder && (
                <div
                  onClick={() => handleSelect("")}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100`}
                  style={value === "" ? { backgroundColor: "#C9D7A740", color: "#4b4b4b" } : {}}
                >
                  {placeholder}
                </div>
              )}
              {filteredOptions.map((option, index) => (
                <div
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 ${
                    index === highlightedIndex ? "bg-gray-100" : ""
                  }`}
                  style={option.value === value ? { backgroundColor: "#C9D7A740", color: "#4b4b4b" } : {}}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  {option.label}
                </div>
              ))}
            </>
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">
              No se encontraron opciones
            </div>
          )}
        </div>
      )}
    </div>
  );
}