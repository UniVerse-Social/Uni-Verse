// client/src/components/AdSenseBanner.jsx
import React, { useEffect } from 'react';

const PUB = process.env.REACT_APP_ADSENSE_PUB_ID;
const SLOT = process.env.REACT_APP_ADSENSE_SLOT_FEED_BANNER;
const MODE = (process.env.REACT_APP_AD_MODE || 'dev').toLowerCase();
const ENABLED = process.env.REACT_APP_ADS_ENABLED === 'true';
const HOST_RE = new RegExp(process.env.REACT_APP_PROD_HOST_REGEX || '^$');

const isDevHost = typeof window !== 'undefined'
  ? /localhost|127\.0\.0\.1|trycloudflare|ngrok/i.test(window.location.hostname)
  : true;
const hostOk = typeof window !== 'undefined'
  ? (HOST_RE.source === '^$' ? !isDevHost : HOST_RE.test(window.location.hostname))
  : false;

const canServe = ENABLED && MODE === 'prod' && hostOk && PUB && SLOT;

function ensureScript(pub) {
  if (typeof window === 'undefined' || !pub) return;
  if (window.__adsenseLoaded) return;
  const already = document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]');
  if (!already) {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${pub}`;
    s.crossOrigin = 'anonymous';
    document.head.appendChild(s);
  }
  window.__adsenseLoaded = true;
}

export default function AdSenseBanner() {
  useEffect(() => {
    if (!canServe) return;
    ensureScript(PUB);
    try {
      const adtest = (typeof window !== 'undefined' && window.location.search.includes('adtest=on')) ? 'on' : undefined;
      // If adtest=on, AdSense will show test ads (no revenue).
      (window.adsbygoogle = window.adsbygoogle || []).push(adtest ? { params: { google_adtest: 'on' } } : {});
    } catch {}
  }, []);

  if (!canServe) return null;

  return (
    <div role="region" aria-label="Advertisements" style={{ margin: '16px 0' }}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={PUB}
        data-ad-slot={SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
