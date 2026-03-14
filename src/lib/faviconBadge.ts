/**
 * Sets a numeric badge on the browser favicon using Canvas.
 * count = 0 restores the original favicon.
 */
export function setFaviconBadge(count: number): void {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const img = new Image();
  img.src = '/favicon.svg';

  img.onload = () => {
    ctx.clearRect(0, 0, 32, 32);
    ctx.drawImage(img, 0, 0, 32, 32);

    if (count > 0) {
      // Red badge circle (bottom-right)
      const r = 9;
      const cx = 32 - r;
      const cy = 32 - r;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#EF4444';
      ctx.fill();

      // White count text
      const label = count > 9 ? '9+' : String(count);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${label.length > 1 ? 8 : 10}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx, cy + 0.5);
    }

    updateFaviconHref(canvas.toDataURL('image/png'));
  };

  // Fallback if image fails to load
  img.onerror = () => {
    if (count > 0) {
      const r = 9;
      ctx.beginPath();
      ctx.arc(32 - r, 32 - r, r, 0, Math.PI * 2);
      ctx.fillStyle = '#EF4444';
      ctx.fill();
    }
    updateFaviconHref(canvas.toDataURL('image/png'));
  };
}

function updateFaviconHref(dataUrl: string): void {
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = dataUrl;
}
