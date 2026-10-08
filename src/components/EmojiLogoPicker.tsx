import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Smile, X, Search, Sparkles } from 'lucide-react';

export interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: string[];
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'gestes',
    name: 'Gestes & Outils',
    icon: '⚡',
    emojis: [
      '💧', '🌱', '🪴', '🌿', '✂️', '🧺', '🍂', '🧪', '🪱', '🔍', '❄️', '🔨',
      '🧤', '🪣', '🧹', '🪓', '⛏️', '🛠️', '🔧', '🪚', '🚜', '🐝', '☀️', '🌧️',
      '📦', '🛒', '🏷️', '📌', '⭐', '💡', '✅', '❌'
    ]
  },
  {
    id: 'legumes',
    name: 'Légumes & Racines',
    icon: '🥕',
    emojis: [
      '🍅', '🍆', '🫑', '🌶️', '🥒', '🎃', '🥑', '🥕', '🥔', '🍠', '🧅', '🧄',
      '🫚', '🥦', '🥬', '🥗', '🫛', '🫘', '🌽', '🌾', '🍄', '🌿', '🌱', '🍃'
    ]
  },
  {
    id: 'fleurs',
    name: 'Fleurs & Herbes',
    icon: '🌸',
    emojis: [
      '🌸', '🌻', '🌼', '🌷', '🌹', '🪷', '💐', '🌺', '🥀', '☘️', '🍀', '🪴',
      '🎋', '🎍', '🍁', '🍂', '🌾'
    ]
  },
  {
    id: 'fruits',
    name: 'Fruits & Verger',
    icon: '🍎',
    emojis: [
      '🍎', '🍏', '🍐', '🍑', '🍒', '🍈', '🍇', '🫒', '🍓', '🫐', '🍊', '🍋',
      '🍌', '🍉', '🍍', '🥭', '🥝', '🥥', '🥜', '🌰', '🌳', '🌲', '🌴', '🪵'
    ]
  },
  {
    id: 'nature',
    name: 'Météo & Nature',
    icon: '☀️',
    emojis: [
      '☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '⛄',
      '🌬️', '💨', '🌈', '🌡️', '🔥', '🐝', '🦋', '🐞', '🐛', '🐜', '🪱', '🐌',
      '🐸', '🦎', '🐦', '🦔', '🐿️', '🐇', '🏡', '🛖', '⛺', '🪜', '📍', '❤️'
    ]
  }
];

export function extractEmoji(text: string): { emoji: string; cleanText: string } {
  if (!text) return { emoji: '', cleanText: '' };
  const trimmed = text.trim();
  const match = trimmed.match(/^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s*(.*)$/u);
  if (match) {
    return {
      emoji: match[1],
      cleanText: match[2].trim()
    };
  }
  return {
    emoji: '',
    cleanText: trimmed
  };
}

interface EmojiLogoPickerProps {
  selectedEmoji?: string;
  onSelect: (emoji: string) => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg';
  buttonClassName?: string;
}

export function EmojiLogoPicker({
  selectedEmoji,
  onSelect,
  title = "Choisir un logo",
  size = 'md',
  buttonClassName
}: EmojiLogoPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('gestes');
  const [search, setSearch] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    placement: 'bottom' | 'top';
    maxHeight: number;
  }>({
    top: 0,
    left: 0,
    width: 288,
    placement: 'bottom',
    maxHeight: 360,
  });

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();

    // If button has disappeared from viewport or is disconnected
    if (rect.width === 0 && rect.height === 0) {
      setIsOpen(false);
      return;
    }

    const pickerWidth = Math.min(290, window.innerWidth - 20);
    const estimatedHeight = 310;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let placement: 'bottom' | 'top' = 'bottom';

    // If not enough room below (< 300px) and there is more room above, open above!
    if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
      placement = 'top';
    }

    // Horizontal positioning: align with button, keep inside viewport boundaries
    let left = rect.left;
    if (left + pickerWidth > window.innerWidth - 10) {
      left = Math.max(10, window.innerWidth - pickerWidth - 10);
    }
    if (left < 10) {
      left = 10;
    }

    let top = 0;
    let maxHeight = 360;

    if (placement === 'top') {
      top = rect.top - 6; // transformed with translateY(-100%)
      maxHeight = Math.min(360, Math.max(160, spaceAbove - 16));
    } else {
      top = rect.bottom + 6;
      maxHeight = Math.min(360, Math.max(160, spaceBelow - 16));
    }

    setCoords({
      top,
      left,
      width: pickerWidth,
      placement,
      maxHeight
    });
  }, []);

  // Update position on open, scroll, resize & close on click outside / escape
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    function handleClickOutside(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (
        popoverRef.current && !popoverRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }

    function handleScrollOrResize() {
      updatePosition();
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  const allEmojis = useMemo(() => {
    const list: string[] = [];
    EMOJI_CATEGORIES.forEach(c => c.emojis.forEach(e => {
      if (!list.includes(e)) list.push(e);
    }));
    return list;
  }, []);

  const currentCategoryObj = EMOJI_CATEGORIES.find(c => c.id === activeCategory) || EMOJI_CATEGORIES[0];

  const displayedEmojis = useMemo(() => {
    if (search.trim()) {
      const q = search.trim();
      // If user typed an emoji directly in search, show it as first option
      const userEmojiMatch = q.match(/\p{Extended_Pictographic}/u);
      const res: string[] = [];
      if (userEmojiMatch) {
        res.push(userEmojiMatch[0]);
      }
      return res.length > 0 ? res : allEmojis;
    }
    return currentCategoryObj.emojis;
  }, [search, currentCategoryObj, allEmojis]);

  const sizeClasses = {
    sm: 'w-7 h-7 text-sm rounded-lg',
    md: 'w-8 h-8 text-base rounded-lg',
    lg: 'w-10 h-10 text-lg rounded-xl'
  }[size];

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(prev => !prev);
  };

  return (
    <div className="relative inline-block">
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        title={title}
        className={
          buttonClassName ||
          `${sizeClasses} flex items-center justify-center border transition-all cursor-pointer shadow-2xs ${
            selectedEmoji 
              ? 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100 text-stone-900' 
              : 'bg-stone-50 border-stone-200 hover:bg-stone-100 text-stone-400'
          }`
        }
      >
        {selectedEmoji ? (
          <span>{selectedEmoji}</span>
        ) : (
          <Smile className="w-4 h-4 text-stone-400" />
        )}
      </button>

      {/* Popover Dropdown rendered into Portal with fixed positioning */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            maxHeight: `${coords.maxHeight}px`,
            transform: coords.placement === 'top' ? 'translateY(-100%)' : 'none',
            zIndex: 99999,
          }}
          className="bg-white rounded-xl shadow-2xl border border-stone-200 p-2.5 space-y-2 flex flex-col animate-in fade-in zoom-in-95 duration-100 select-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-1.5 border-b border-stone-100 shrink-0">
            <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Choisir un logo</span>
            </span>
            <div className="flex items-center gap-1">
              {selectedEmoji && (
                <button
                  type="button"
                  onClick={() => {
                    onSelect('');
                    setIsOpen(false);
                  }}
                  className="text-[10px] text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-1.5 py-0.5 rounded font-medium transition-colors cursor-pointer"
                  title="Enlever le logo"
                >
                  Sans logo
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-600 rounded-md hover:bg-stone-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-0.5 shrink-0 no-scrollbar">
            {EMOJI_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.id);
                  setSearch('');
                }}
                className={`px-2 py-1 text-xs rounded-md font-medium whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer ${
                  activeCategory === cat.id && !search
                    ? 'bg-emerald-100 text-emerald-800 font-semibold'
                    : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
                }`}
              >
                <span>{cat.icon}</span>
                <span className="text-[11px]">{cat.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>

          {/* Quick paste or search */}
          <div className="relative shrink-0">
            <Search className="w-3 h-3 text-stone-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Collez ou cherchez un emoji..."
              className="w-full pl-7 pr-2 py-1 text-xs rounded-lg border border-stone-200 bg-stone-50/50 focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
            />
          </div>

          {/* Emojis Grid with flexible scrolling */}
          <div className="grid grid-cols-6 gap-1 flex-1 min-h-[120px] overflow-y-auto p-1 bg-stone-50/50 rounded-lg border border-stone-100">
            {displayedEmojis.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onSelect(emoji);
                  setIsOpen(false);
                }}
                className={`h-8 rounded-lg flex items-center justify-center text-lg hover:scale-115 transition-transform cursor-pointer ${
                  selectedEmoji === emoji
                    ? 'bg-emerald-200 border border-emerald-400 shadow-2xs'
                    : 'hover:bg-white'
                }`}
                title={`Choisir ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
