import { FooterTagline } from './FooterTagline';
import { LanguagePicker } from './LanguagePicker';
import { SupabaseWordmark } from './SupabaseWordmark';
import { ThemePicker } from './ThemePicker';

export function AppFooter(): JSX.Element {
  return (
    <footer className="border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="relative mx-auto flex w-full max-w-7xl flex-col items-center gap-3 px-4 py-5 text-sm sm:px-8 md:flex-row md:justify-center">
        <SupabaseWordmark />
        <FooterTagline />
        <div className="flex items-center gap-3 md:ml-auto">
          <LanguagePicker />
          <ThemePicker />
        </div>
      </div>
    </footer>
  );
}
