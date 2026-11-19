import { useEffect } from 'react';

declare global {
  interface Window {
    createLemonSqueezy?: () => void;
    LemonSqueezy: { Url: { Open: (url: string) => void } };
  }
}

export function BuyButton() {
  useEffect(() => {
    window.createLemonSqueezy?.();
  }, []);
  return (
    <a className="lemonsqueezy-button" href="https://pocketnotes.lemonsqueezy.com/checkout/buy/00000000-0000-0000-0000-000000000000?embed=1">
      Buy Pocket Notes Pro
    </a>
  );
}

export function openCheckout(url: string) {
  window.LemonSqueezy.Url.Open(url);
}
