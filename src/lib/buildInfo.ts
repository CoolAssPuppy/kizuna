import pkg from '../../package.json';

const env = (typeof import.meta !== 'undefined' ? import.meta.env : undefined) as
  | Record<string, string | undefined>
  | undefined;

export const APP_VERSION: string = pkg.version;
export const BUILD_SHA: string = env?.['VITE_BUILD_SHA'] ?? 'dev';
