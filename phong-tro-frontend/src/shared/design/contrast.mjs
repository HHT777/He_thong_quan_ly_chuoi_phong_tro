export function contrastRatio(foreground, background) {
  const luminance = (hex) => {
    const bytes = hex.replace("#", "").match(/.{2}/g).map((part) => parseInt(part, 16) / 255);
    const linear = bytes.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
