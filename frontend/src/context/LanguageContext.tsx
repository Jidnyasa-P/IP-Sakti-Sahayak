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
