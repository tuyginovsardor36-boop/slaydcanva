interface TelegramDownloadWebApp {
  initData?: string;
  platform?: string;
  version?: string;
  downloadFile?: (
    params: { url: string; file_name: string },
    cb?: (accepted: boolean) => void
  ) => void;
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
}

function getTelegramWebAppObj(): TelegramDownloadWebApp | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { Telegram?: { WebApp?: TelegramDownloadWebApp } };
  return w.Telegram?.WebApp || null;
}

export function isTelegramMiniAppWebView(): boolean {
  const tg = getTelegramWebAppObj();
  return Boolean(tg && (tg.initData || (tg.platform && tg.platform !== 'unknown')));
}

function toAbsoluteUrl(pathOrUrl: string): string {
  if (typeof window === 'undefined') return pathOrUrl;
  try {
    return new URL(pathOrUrl, window.location.origin).toString();
  } catch {
    return pathOrUrl;
  }
}

function triggerAnchorDownload(href: string, fileName: string): void {
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  a.rel = 'noopener noreferrer';
  a.style.position = 'fixed';
  a.style.left = '-9999px';
  a.style.top = '-9999px';
  a.style.opacity = '0';
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    if (a.parentNode) a.parentNode.removeChild(a);
  }, 1500);
}

/**
 * Safely triggers a file download on Desktop, Mobile Browser, and Telegram Mini App WebView
 * without causing a blank white screen ("oq sahifa") on blob navigation.
 */
export async function triggerSafeFileDownload(params: {
  fileName: string;
  blob?: Blob;
  serverDownloadPath?: string;
}): Promise<'telegram_native' | 'telegram_link' | 'browser_blob' | 'browser_url'> {
  const { fileName, blob, serverDownloadPath } = params;
  const tg = getTelegramWebAppObj();
  const inTelegram = isTelegramMiniAppWebView();

  if (inTelegram && serverDownloadPath) {
    const absUrl = toAbsoluteUrl(serverDownloadPath);
    if (typeof tg?.downloadFile === 'function') {
      try {
        const result = await new Promise<'telegram_native' | 'fallback'>((resolve) => {
          let settled = false;
          const timer = window.setTimeout(() => {
            if (!settled) {
              settled = true;
              resolve('telegram_native');
            }
          }, 800);
          try {
            tg.downloadFile?.({ url: absUrl, file_name: fileName }, () => {
              if (!settled) {
                settled = true;
                window.clearTimeout(timer);
                resolve('telegram_native');
              }
            });
          } catch {
            if (!settled) {
              settled = true;
              window.clearTimeout(timer);
              resolve('fallback');
            }
          }
        });
        if (result === 'telegram_native') {
          return 'telegram_native';
        }
      } catch {
        // Fallback below
      }
    }

    if (typeof tg?.openLink === 'function') {
      tg.openLink(absUrl, { try_instant_view: false });
      return 'telegram_link';
    }
  }

  if (blob) {
    const url = URL.createObjectURL(blob);
    triggerAnchorDownload(url, fileName);
    window.setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignore
      }
    }, 60_000);
    return 'browser_blob';
  }

  if (serverDownloadPath) {
    const absUrl = toAbsoluteUrl(serverDownloadPath);
    triggerAnchorDownload(absUrl, fileName);
    return 'browser_url';
  }

  return 'browser_url';
}
