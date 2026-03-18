import { useState, useEffect } from 'react';
import '../styles/install-prompt.css';

const STORAGE_KEY = 'campo-iluminado-install-dismissed';
const DISMISS_DAYS = 7;

function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 768px)').matches
    || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (window.matchMedia('(display-mode: standalone)').matches)
    || (window.navigator as unknown as { standalone?: boolean }).standalone === true
    || document.referrer.includes('android-app://');
}

function wasDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const t = parseInt(raw, 10);
    if (Number.isNaN(t)) return false;
    return Date.now() - t < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function setDismissed(): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {}
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<{ prompt: () => Promise<{ outcome: string }> } | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    if (!isMobile()) return;
    if (wasDismissedRecently()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as unknown as { prompt: () => Promise<{ outcome: string }> });
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // No iOS/Safari não existe beforeinstallprompt; mostrar aviso genérico após um momento
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const timer = isIOS
      ? window.setTimeout(() => {
          setDeferredPrompt(null);
          setShowBanner(true);
        }, 1500)
      : undefined;

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      try {
        const { outcome } = await deferredPrompt.prompt();
        if (outcome === 'accepted') {
          setShowBanner(false);
          setInstalled(true);
        }
      } catch {
        setShowBanner(false);
      }
    } else {
      // iOS: não há prompt nativo; fechar o aviso (instruções já estão no texto)
      handleDismiss();
    }
  };

  const handleDismiss = () => {
    setDismissed();
    setShowBanner(false);
  };

  const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  if (!showBanner || installed) return null;

  return (
    <div className="install-prompt" role="dialog" aria-label="Instalar o jogo">
      <div className="install-prompt-inner">
        <p className="install-prompt-text">
          {deferredPrompt
            ? 'Instale o jogo para uma experiência melhor no celular: tela cheia e mais fluido.'
            : isIOS
              ? 'Para jogar em tela cheia: toque no ícone de partilhar (ou no menu) e depois em "Adicionar ao Ecrã Inicial".'
              : 'Instale o jogo para uma experiência melhor no celular: tela cheia e mais fluido.'}
        </p>
        <div className="install-prompt-actions">
          <button type="button" className="install-prompt-btn install-prompt-btn-primary" onClick={handleInstall}>
            {deferredPrompt ? 'Instalar' : 'Entendi'}
          </button>
          <button type="button" className="install-prompt-btn install-prompt-btn-secondary" onClick={handleDismiss}>
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
