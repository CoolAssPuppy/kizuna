/**
 * "Hello" in many languages, paired with the language label so the
 * greeting carousel doubles as a quiet brag about the team's reach.
 *
 * Source: each greeting is the most common informal hello plus the
 * English label. New entries welcome.
 */
export interface Greeting {
  text: string;
  lang: string;
}

export const GREETINGS: ReadonlyArray<Greeting> = [
  { text: 'Hello', lang: 'English' },
  { text: 'Bonjour', lang: 'French' },
  { text: 'Hola', lang: 'Spanish' },
  { text: 'Olá', lang: 'Portuguese' },
  { text: 'Ciao', lang: 'Italian' },
  { text: 'Hallo', lang: 'German' },
  { text: 'こんにちは', lang: 'Japanese' },
  { text: '안녕하세요', lang: 'Korean' },
  { text: '你好', lang: 'Mandarin' },
  { text: 'مرحبا', lang: 'Arabic' },
  { text: 'שלום', lang: 'Hebrew' },
  { text: 'नमस्ते', lang: 'Hindi' },
  { text: 'வணக்கம்', lang: 'Tamil' },
  { text: 'Привет', lang: 'Russian' },
  { text: 'Merhaba', lang: 'Turkish' },
  { text: 'Cześć', lang: 'Polish' },
  { text: 'Hej', lang: 'Swedish' },
  { text: 'Sawubona', lang: 'Zulu' },
  { text: 'Jambo', lang: 'Swahili' },
  { text: 'Aloha', lang: 'Hawaiian' },
];
