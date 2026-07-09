/**
 * BIP39 AUTOCOMPLETE INPUT - BRUTALIST DESIGN
 * Individual word input with BIP39 wordlist autocomplete dropdown
 * Security: Prevents keylogging of full phrase, validates against 2048-word list
 */

import React, { useState, useRef, useEffect, forwardRef } from 'react';
import { WORD_LIST } from '../../../../../totem-sdk/packages/core/src/bip39';

const BIP39_WORDLIST = WORD_LIST;
const BIP39_WORDSET = new Set(BIP39_WORDLIST);

interface BIP39AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelectSuggestion?: (word: string) => void;
  index: number;
  autoFocus?: boolean;
  placeholder?: string;
}

export const BIP39AutocompleteInput = forwardRef<HTMLInputElement, BIP39AutocompleteInputProps>(({
  value,
  onChange,
  onSelectSuggestion,
  index,
  autoFocus = false,
  placeholder,
}, ref) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter suggestions with debouncing (150ms)
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (value && value.length > 0) {
        const matches = BIP39_WORDLIST.filter(word => 
          word.startsWith(value.toLowerCase())
        ).slice(0, 8); // Cap at 8 suggestions
        
        setSuggestions(matches);
        setShowDropdown(matches.length > 0 && isFocused);
        setSelectedIndex(0);
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
    }, 150);

    return () => clearTimeout(timeout);
  }, [value, isFocused]);

  const handleSelectSuggestion = (word: string) => {
    onChange(word);
    setShowDropdown(false);
    setSuggestions([]);
    
    if (onSelectSuggestion) {
      onSelectSuggestion(word);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        handleSelectSuggestion(suggestions[selectedIndex]);
        break;
      case 'Escape':
        setShowDropdown(false);
        break;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toLowerCase().trim();
    onChange(newValue);
  };

  const isValid = value.length > 0 && BIP39_WORDSET.has(value);
  const isInvalid = value.length > 0 && !isValid && !showDropdown;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          setIsFocused(true);
          if (value && suggestions.length > 0) {
            setShowDropdown(true);
          }
        }}
        onBlur={() => {
          setIsFocused(false);
          // Delay to allow click on dropdown
          setTimeout(() => setShowDropdown(false), 200);
        }}
        autoFocus={autoFocus}
        autoComplete="off"
        inputMode="text"
        placeholder={placeholder || `${index + 1}`}
        style={{
          width: '100%',
          padding: '6px 8px',
          background: 'var(--bg-base)',
          border: `2px solid ${
            isInvalid
              ? '#EF4444'
              : isValid
              ? 'var(--accent-primary)'
              : isFocused
              ? 'var(--accent-primary)'
              : 'var(--border-default)'
          }`,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          outline: 'none',
          boxShadow: isValid ? 'var(--shadow-sm)' : 'none',
        }}
      />

      {/* Dropdown suggestions */}
      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'var(--bg-elevated)',
            border: '2px solid var(--accent-primary)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1000,
            maxHeight: '200px',
            overflow: 'hidden',
          }}
        >
          {suggestions.map((word, idx) => (
            <div
              key={word}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelectSuggestion(word);
              }}
              style={{
                padding: '6px 8px',
                cursor: 'pointer',
                background: idx === selectedIndex ? 'var(--accent-primary)' : 'transparent',
                color: idx === selectedIndex ? 'white' : 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                borderBottom: idx < suggestions.length - 1 ? '1px solid var(--border-default)' : 'none',
                fontWeight: 600,
                letterSpacing: '0.02em',
                lineHeight: '1.2',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {word}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

BIP39AutocompleteInput.displayName = 'BIP39AutocompleteInput';

// Validation helper
export function isValidBIP39Word(word: string): boolean {
  return BIP39_WORDSET.has(word.toLowerCase().trim());
}
