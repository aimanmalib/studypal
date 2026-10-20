"use client";

import { useCallback } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { useStore } from '@/lib/store';
import { StreamEvent, postJson, postStream } from '@/lib/client/request';

/**
 * API calls from the pages. Every request carries the visitor's provider
 * settings (headers) and the interface language (`language` in the body), so
 * the model answers in the language the visitor is reading.
 */
export function useStudyApi() {
  const settings = useStore((s) => s.settings);
  const { language } = useI18n();

  const json = useCallback(
    <T,>(path: string, body: Record<string, unknown>) => postJson<T>(path, { ...body, language }, settings),
    [language, settings],
  );
  const stream = useCallback(
    (path: string, body: Record<string, unknown>, onEvent: (event: StreamEvent) => void) =>
      postStream(path, { ...body, language }, settings, onEvent),
    [language, settings],
  );
  return { postJson: json, postStream: stream };
}
