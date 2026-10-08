
/**
 * Generates a color that is as distinct as possible from a list of existing colors.
 * Uses HSL space to find a hue that is far from existing hues.
 */
export function getDistinctColor(existingColors: string[]): string {
  if (existingColors.length === 0) return '#10b981'; // Default emerald

  // Convert hex to HSL and extract hues
  const hues = existingColors.map(hex => {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;
    return rgbToHsl(rgb.r, rgb.g, rgb.b).h;
  });

  // Find the largest gap between hues
  hues.sort((a, b) => a - b);
  
  let maxGap = 0;
  let bestHue = 0;

  for (let i = 0; i < hues.length; i++) {
    const nextHue = hues[(i + 1) % hues.length];
    let gap = nextHue - hues[i];
    if (gap < 0) gap += 360;

    if (gap > maxGap) {
      maxGap = gap;
      bestHue = (hues[i] + gap / 2) % 360;
    }
  }

  // If no good gap found (e.g. only one color), use opposite hue
  if (hues.length === 1) {
    bestHue = (hues[0] + 180) % 360;
  }

  return hslToHex(bestHue, 70, 50);
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Generates a consistent hex color from a string.
 */
export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).slice(-2);
  }
  return color;
}
