/** @jest-environment node */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import en from '../src/i18n/en.json';
import ms from '../src/i18n/ms.json';
import { MESSAGES, hasMessage, interpolate, translate } from '../src/i18n';
import { LANGUAGES } from '../src/lib/language';
import { LLM_ERROR_CODES } from '../src/lib/llm-errors';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('language files', () => {
  it('has a file for every supported language', () => {
    expect(Object.keys(MESSAGES).sort()).toEqual([...LANGUAGES].sort());
  });

  it('has exactly the same keys in English and Bahasa Melayu', () => {
    const enKeys = Object.keys(en).sort();
    const msKeys = Object.keys(ms).sort();
    expect(enKeys.filter((k) => !msKeys.includes(k))).toEqual([]); // missing in ms.json
    expect(msKeys.filter((k) => !enKeys.includes(k))).toEqual([]); // missing in en.json
  });

  it('has no empty strings', () => {
    for (const lang of LANGUAGES) {
      const empty = Object.entries(MESSAGES[lang]).filter(([, v]) => typeof v !== 'string' || !v.trim());
      expect(empty.map(([k]) => `${lang}:${k}`)).toEqual([]);
    }
  });

  it('uses the same {placeholders} in both languages', () => {
    const mismatched = Object.keys(en).filter(
      (k) => placeholders(en[k as keyof typeof en]).join() !== placeholders(ms[k as keyof typeof ms]).join(),
    );
    expect(mismatched).toEqual([]);
  });

  it('has a translated message for every API error code', () => {
    for (const code of LLM_ERROR_CODES) expect(hasMessage(`error.${code}`)).toBe(true);
    expect(hasMessage('error.network')).toBe(true);
    expect(hasMessage('error.generic')).toBe(true);
  });

  it('translates instead of copying English (except names and codes)', () => {
    const sameOnPurpose = new Set([
      'language.en',
      'language.ms',
      'language.enShort',
      'language.msShort',
      'settings.model',
      'stats.rowModel',
      'quiz.resultScore',
    ]);
    const copied = Object.keys(en).filter(
      (k) => !sameOnPurpose.has(k) && en[k as keyof typeof en] === ms[k as keyof typeof ms],
    );
    expect(copied).toEqual([]);
  });

  it('writes Malaysian Bahasa Melayu, not Indonesian', () => {
    // Common Indonesian words with a different Malaysian standard form.
    const indonesian = [
      'kirim', 'unduh', 'unggah', 'saat', 'karena', 'harus', 'bisa', 'coba', 'silakan', 'berhasil',
      'pengaturan', 'kata sandi', 'tombol', 'ponsel', 'mengunduh', 'mencoba', 'gimana', 'aja',
    ];
    const hits = Object.entries(ms).flatMap(([k, v]) =>
      indonesian.filter((w) => new RegExp(`(^|[^\\p{L}])${w}([^\\p{L}]|$)`, 'iu').test(v)).map((w) => `${k}: ${w}`),
    );
    expect(hits).toEqual([]);
  });
});

describe('translate()', () => {
  it('fills placeholders and leaves unknown ones visible', () => {
    expect(translate('en', 'flashcards.position', { i: 2, n: 8 })).toBe('Card 2 of 8');
    expect(translate('ms', 'flashcards.position', { i: 2, n: 8 })).toBe('Kad 2 daripada 8');
    expect(interpolate('Hi {name}, {missing}', { name: 'Aina' })).toBe('Hi Aina, {missing}');
  });

  it('uses natural Malaysian terms for the main features', () => {
    expect(translate('ms', 'nav.chat')).toBe('Sembang');
    expect(translate('ms', 'nav.flashcards')).toBe('Kad Imbas');
    expect(translate('ms', 'nav.quiz')).toBe('Kuiz');
    expect(translate('ms', 'nav.summarize')).toBe('Ringkasan');
    expect(translate('ms', 'nav.stats')).toBe('Statistik');
    expect(translate('ms', 'settings.title')).toBe('Tetapan');
    expect(translate('ms', 'settings.apiKey')).toBe('Kunci API');
  });
});

/** Every .tsx file under src/, so new screens are covered automatically. */
function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

describe('components', () => {
  const files = tsxFiles(join(__dirname, '..', 'src'));

  it('only use keys that exist in the language files', () => {
    const unknown = files.flatMap((file) => {
      const src = readFileSync(file, 'utf8');
      return [...src.matchAll(/\bt\('([^'`]+)'/g)].map((m) => m[1]).filter((key) => !hasMessage(key)).map((key) => `${file}: ${key}`);
    });
    expect(unknown).toEqual([]);
  });

  it('do not hard-code interface text in JSX', () => {
    // Text between tags (">Some words<") that is not an expression. The brand
    // name and the "SP" logo mark are the only literal text allowed.
    const allowed = new Set(['StudyPal', 'SP', '·']);
    const found = files.flatMap((file) => {
      const src = readFileSync(file, 'utf8');
      // Code (generics, arrows, ternaries) contains ( ) ; = ? & | ; JSX text does not.
      return [...src.matchAll(/>\s*([^<>{}\n();=?&|]*[A-Za-z\u00C0-\u024F][^<>{}\n();=?&|]*?)\s*</g)]
        .map((m) => m[1].trim())
        .filter((text) => text && !allowed.has(text))
        .map((text) => `${file}: ${text}`);
    });
    expect(found).toEqual([]);
  });
});
