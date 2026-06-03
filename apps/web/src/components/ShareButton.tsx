'use client';

import { useState } from 'react';
import { Share, Check } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

/**
 * Share affordance using the Web Share API (mobile) with a clipboard fallback
 * (desktop). The shared URL is the product page; its OG image is the score card.
 */
export function ShareButton({
  title,
  text,
  className,
}: {
  title: string;
  text?: string;
  className?: string;
}) {
  const { show } = useToast();
  const [copied, setCopied] = useState(false);

  const onShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const shareData = { title, text: text ?? title, url };

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      show('Link kopiert', 'success');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      show('Teilen nicht möglich.', 'error');
    }
  };

  return (
    <button
      onClick={onShare}
      aria-label="Teilen"
      className={
        className ??
        'tap-dim grid h-9 w-9 place-items-center rounded-full bg-fill-2 text-label'
      }
    >
      {copied ? (
        <Check className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.4} />
      ) : (
        <Share className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.2} />
      )}
    </button>
  );
}
