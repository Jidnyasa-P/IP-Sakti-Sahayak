import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Language, SUPPORTED_LANGUAGES } from '../types';
import { BASE_DICTIONARY, getInstantDictionary } from './translations';
import { apiUrl } from '../components/auth/authStorage';

interface LanguageContextType {
  currentLanguage: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string, defaultText?: string) => string;
  isTranslating: boolean;
  translationSource: string;
  translateDynamicText: (text: string) => Promise<string>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const CACHE_PREFIX = 'ipsakti_trans_';

const UI_CACHE_PREFIX = 'ipsakti_ui_auto_trans_';

// The curated dictionary covers the main product copy, but some UI strings are
// rendered directly by feature components (notifications, jurisdiction
// controls, dialogs, status labels, etc.). Keep those strings synchronized with
// the selected language as well, without forcing every existing component to be
// rewritten just to wrap a label in t().
const UI_TEXT_MAX_LENGTH = 180;
const UI_BATCH_SIZE = 30;
const UI_TRANSLATION_DEBOUNCE_MS = 120;

function looksLikeUiText(value: string): boolean {
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text || text.length > UI_TEXT_MAX_LENGTH) return false;
  if (!/[A-Za-z]/.test(text)) return false;
  if (/^https?:\/\//i.test(text)) return false;
  if (/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(text)) return false;
  // Long prose is normally user/RAG content rather than interface copy.
  if (text.split(/\s+/).length > 28) return false;
  return true;
}

function shouldSkipUiTranslationElement(element: Element | null): boolean {
  if (!element) return true;
  if (element.closest('[data-no-auto-translate]')) return true;
  const tag = element.tagName.toLowerCase();
  return ['script', 'style', 'svg', 'path', 'code', 'pre', 'textarea'].includes(tag);
}

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentLanguage, setCurrentLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('ipsakti_pref_language') as Language;
      if (saved && SUPPORTED_LANGUAGES.some(l => l.code === saved)) {
        return saved;
      }
    } catch {}
    return 'en';
  });

  const [activeDictionary, setActiveDictionary] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('ipsakti_pref_language') as Language;
      if (saved && saved !== 'en' && SUPPORTED_LANGUAGES.some(l => l.code === saved)) {
        return getInstantDictionary(saved);
      }
    } catch {}
    return BASE_DICTIONARY;
  });

  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [translationSource, setTranslationSource] = useState<string>('default');

  const fetchTranslations = useCallback(async (lang: Language) => {
    if (lang === 'en') {
      setActiveDictionary(BASE_DICTIONARY);
      setTranslationSource('default');
      return;
    }

    // Immediately load verified statutory dictionary for zero lag
    const instantDictionary = getInstantDictionary(lang);
    setActiveDictionary(instantDictionary);
    setTranslationSource('statutory-dictionary');

    // Check localStorage cache and validate that it's actually translated
    try {
      const cached = localStorage.getItem(`${CACHE_PREFIX}${lang}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (
          parsed.strings &&
          typeof parsed.strings === 'object' &&
          parsed.strings['landing.btn_ask'] &&
          parsed.strings['landing.btn_ask'] !== BASE_DICTIONARY['landing.btn_ask']
        ) {
          setActiveDictionary({ ...instantDictionary, ...parsed.strings });
          setTranslationSource(parsed.source || 'bhashini_live (cached)');
        } else {
          localStorage.removeItem(`${CACHE_PREFIX}${lang}`);
        }
      }
    } catch {
      localStorage.removeItem(`${CACHE_PREFIX}${lang}`);
    }

    // Call server translation endpoint using BHASHINI
    setIsTranslating(true);
    try {
      const response = await fetch(apiUrl('/api/translate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_language: lang,
          strings: BASE_DICTIONARY,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.translated_strings && typeof data.translated_strings === 'object') {
          const sanitized: Record<string, string> = { ...instantDictionary };
          for (const [k, v] of Object.entries(data.translated_strings as Record<string, string>)) {
            if (v && typeof v === 'string' && (v !== BASE_DICTIONARY[k] || instantDictionary[k] === BASE_DICTIONARY[k])) {
              sanitized[k] = v;
            }
          }
          setActiveDictionary(sanitized);
          setTranslationSource(data.source || 'bhashini_live');
          try {
            localStorage.setItem(
              `${CACHE_PREFIX}${lang}`,
              JSON.stringify({
                strings: sanitized,
                source: data.source || 'bhashini_live',
                timestamp: Date.now(),
              })
            );
          } catch {}
        }
      }
    } catch (err) {
      console.warn('Live translation via BHASHINI encountered a network issue, using verified statutory dictionary:', err);
    } finally {
      setIsTranslating(false);
    }
  }, []);

  useEffect(() => {
    if (currentLanguage !== 'en') {
      fetchTranslations(currentLanguage);
    }
  }, [currentLanguage, fetchTranslations]);

  const setLanguage = async (lang: Language) => {
    setCurrentLanguageState(lang);
    try {
      localStorage.setItem('ipsakti_pref_language', lang);
    } catch {}
    const initialDict = getInstantDictionary(lang);
    setActiveDictionary(initialDict);
    await fetchTranslations(lang);
  };

  const t = useCallback(
    (key: string, defaultText?: string): string => {
      if (currentLanguage === 'en') {
        return BASE_DICTIONARY[key] || defaultText || key;
      }
      const targetDict = getInstantDictionary(currentLanguage);
      const val = activeDictionary[key];
      const baseVal = BASE_DICTIONARY[key];

      // 1. Direct active dictionary lookup if translated
      if (val && (val !== baseVal || targetDict[key] === baseVal)) {
        return val;
      }

      // 2. Verified target dictionary lookup
      if (targetDict[key]) {
        return targetDict[key];
      }

      // 3. Header title / Title aliases
      if (key.endsWith('.title')) {
        const alt = key.replace(/\.title$/, '.header_title');
        if (activeDictionary[alt] && activeDictionary[alt] !== BASE_DICTIONARY[alt]) return activeDictionary[alt];
        if (targetDict[alt]) return targetDict[alt];
      }
      if (key.endsWith('.header_title')) {
        const alt = key.replace(/\.header_title$/, '.title');
        if (activeDictionary[alt] && activeDictionary[alt] !== BASE_DICTIONARY[alt]) return activeDictionary[alt];
        if (targetDict[alt]) return targetDict[alt];
      }
      if (key.endsWith('.subtitle')) {
        const alt = key.replace(/\.subtitle$/, '.header_subtitle');
        if (activeDictionary[alt] && activeDictionary[alt] !== BASE_DICTIONARY[alt]) return activeDictionary[alt];
        if (targetDict[alt]) return targetDict[alt];
      }
      if (key.endsWith('.header_subtitle')) {
        const alt = key.replace(/\.header_subtitle$/, '.subtitle');
        if (activeDictionary[alt] && activeDictionary[alt] !== BASE_DICTIONARY[alt]) return activeDictionary[alt];
        if (targetDict[alt]) return targetDict[alt];
      }

      return val || defaultText || baseVal || key;
    },
    [currentLanguage, activeDictionary]
  );

  const translateDynamicText = async (text: string): Promise<string> => {
    if (!text || currentLanguage === 'en') return text;
    try {
      const res = await fetch(apiUrl('/api/translate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_language: currentLanguage,
          text,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.translated_text || text;
      }
    } catch (e) {
      console.error('Dynamic text translation error:', e);
    }
    return text;
  };


  useEffect(() => {
    if (currentLanguage === 'en') return;

    let disposed = false;
    let timer: number | null = null;
    let translating = false;
    const originalText = new WeakMap<Text, string>();
    const originalAttributes = new WeakMap<Element, Map<string, string>>();
    const translatedForLanguage = new Map<string, string>();

    try {
      const cached = localStorage.getItem(`${UI_CACHE_PREFIX}${currentLanguage}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          for (const [source, translated] of Object.entries(parsed)) {
            if (typeof translated === 'string' && translated && translated !== source) {
              translatedForLanguage.set(source, translated);
            }
          }
        }
      }
    } catch {}

    const persistCache = () => {
      try {
        const entries = Array.from(translatedForLanguage.entries()).slice(-2000);
        localStorage.setItem(`${UI_CACHE_PREFIX}${currentLanguage}`, JSON.stringify(Object.fromEntries(entries)));
      } catch {}
    };

    const collectUiStrings = (): Array<{ key: string; source: string; apply: (value: string) => void }> => {
      const collected = new Map<string, { key: string; source: string; apply: (value: string) => void }>();
      const root = document.getElementById('root');
      if (!root) return [];

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const textNode = node as Text;
        const parent = textNode.parentElement;
        if (shouldSkipUiTranslationElement(parent)) continue;

        const source = (originalText.get(textNode) ?? textNode.nodeValue ?? '').replace(/\s+/g, ' ').trim();
        if (!looksLikeUiText(source)) continue;

        originalText.set(textNode, source);
        if (translatedForLanguage.has(source)) {
          const translated = translatedForLanguage.get(source)!;
          if (textNode.nodeValue?.trim() !== translated) textNode.nodeValue = textNode.nodeValue?.replace(source, translated) ?? translated;
          continue;
        }

        if (!collected.has(source)) {
          collected.set(source, {
            key: `ui_${collected.size}`,
            source,
            apply: (value: string) => {
              if (!disposed && textNode.isConnected) {
                textNode.nodeValue = textNode.nodeValue?.replace(source, value) ?? value;
              }
            },
          });
        }
      }

      // Translate accessible labels, titles and placeholders too. These are
      // especially visible in the header, buttons, search boxes and dialogs.
      root.querySelectorAll<HTMLElement>('[aria-label], [title], [placeholder]').forEach((element) => {
        if (shouldSkipUiTranslationElement(element)) return;
        for (const attribute of ['aria-label', 'title', 'placeholder']) {
          const current = element.getAttribute(attribute);
          if (!current || !looksLikeUiText(current)) continue;
          let attrs = originalAttributes.get(element);
          if (!attrs) {
            attrs = new Map();
            originalAttributes.set(element, attrs);
          }
          const source = attrs.get(attribute) ?? current;
          attrs.set(attribute, source);

          if (translatedForLanguage.has(source)) {
            element.setAttribute(attribute, translatedForLanguage.get(source)!);
            continue;
          }

          if (!collected.has(`attr:${attribute}:${source}`)) {
            collected.set(`attr:${attribute}:${source}`, {
              key: `attr_${collected.size}`,
              source,
              apply: (value: string) => {
                if (!disposed && element.isConnected) element.setAttribute(attribute, value);
              },
            });
          }
        }
      });

      return Array.from(collected.values());
    };

    const runTranslation = async () => {
      if (disposed || translating) return;
      const items = collectUiStrings().filter(item => !translatedForLanguage.has(item.source));
      if (!items.length) return;

      translating = true;
      try {
        for (let start = 0; start < items.length && !disposed; start += UI_BATCH_SIZE) {
          const batch = items.slice(start, start + UI_BATCH_SIZE);
          const strings: Record<string, string> = {};
          batch.forEach((item, index) => { strings[`ui_${index}`] = item.source; });

          const response = await fetch(apiUrl('/api/translate'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              target_language: currentLanguage,
              strings,
            }),
          });

          if (!response.ok) continue;
          const data = await response.json();
          const translated = data?.translated_strings;
          if (!translated || typeof translated !== 'object') continue;

          batch.forEach((item, index) => {
            const value = translated[`ui_${index}`];
            if (typeof value !== 'string' || !value.trim() || value === item.source) return;
            translatedForLanguage.set(item.source, value);
            item.apply(value);
          });
          persistCache();
        }
      } catch (error) {
        console.warn('Automatic UI translation encountered a network issue:', error);
      } finally {
        translating = false;
      }
    };

    const schedule = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => { void runTranslation(); }, UI_TRANSLATION_DEBOUNCE_MS);
    };

    const observer = new MutationObserver(() => schedule());
    observer.observe(document.getElementById('root') ?? document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['aria-label', 'title', 'placeholder'],
    });

    schedule();
    return () => {
      disposed = true;
      observer.disconnect();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [currentLanguage]);

  return (
    <LanguageContext.Provider
      value={{
        currentLanguage,
        setLanguage,
        t,
        isTranslating,
        translationSource,
        translateDynamicText,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
