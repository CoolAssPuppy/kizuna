import { FooterTagline } from './FooterTagline';
import { LanguagePicker } from './LanguagePicker';
import { SupabaseWordmark } from './SupabaseWordmark';
import { ThemePicker } from './ThemePicker';

export function AppFooter(): JSX.Element {
  return (
    <footer className="border-t bg-background">
      <div className="relative mx-auto flex w-full max-w-7xl flex-col items-center gap-3 px-8 py-5 text-sm md:flex-row md:justify-center">
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
