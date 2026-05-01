import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import deCommon from '@/locales/de-DE/common.json';
import enCommon from '@/locales/en-US/common.json';
import esCommon from '@/locales/es-ES/common.json';
import fiCommon from '@/locales/fi-FI/common.json';
import frCommon from '@/locales/fr-FR/common.json';
import itCommon from '@/locales/it-IT/common.json';
import ptBRCommon from '@/locales/pt-BR/common.json';
import ptPTCommon from '@/locales/pt-PT/common.json';

export const SUPPORTED_LOCALES = [
  'en-US',
  'fr-FR',
  'it-IT',
  'de-DE',
  'es-ES',
  'pt-PT',
  'pt-BR',
  'fi-FI',
] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const DEFAULT_LOCALE: SupportedLocale = 'en-US';
const NAMESPACES = ['common'] as const;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,
    defaultNS: 'common',
    ns: NAMESPACES,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['querystring', 'localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupQuerystring: 'lng',
    },
    resources: {
      'en-US': { common: enCommon },
      'fr-FR': { common: frCommon },
      'it-IT': { common: itCommon },
      'de-DE': { common: deCommon },
      'es-ES': { common: esCommon },
      'pt-PT': { common: ptPTCommon },
      'pt-BR': { common: ptBRCommon },
      'fi-FI': { common: fiCommon },
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
