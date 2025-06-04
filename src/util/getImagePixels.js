import gen2dArray from "./gen2dArray.js";

/**
 * @param {HTMLImageElement} image 
 */
export default function getImagePixels(image) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const width = image.width, height = image.height;
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, width, height);
  /** @type {[r: number, g: number, b: number, a: number][][]} */
  const pixels = gen2dArray(height, width, () => [0, 0, 0, 0]);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sIdx = 4 * (y * width + x);
      pixels[y][x] = [...imageData.data.slice(sIdx, sIdx + 4)];
    }
  }
  return pixels;
}