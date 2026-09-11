import { deflateSync, crc32 } from "node:zlib";

// A tiny, dependency-free PNG encoder for seed images. The point isn't
// photorealism — it's that every "photo" in seed data is a real,
// individually generated image file pushed through media-service's actual
// presign → PUT → confirm pipeline, not a fabricated URL string. Each
// image is a solid-color square (a distinct color per entity, optionally
// banded so different entities are visibly distinguishable in the UI).
export function makeSolidPng(
  width: number,
  height: number,
  [r, g, b]: [number, number, number],
): Buffer {
  function chunk(type: string, data: Buffer): Buffer {
    const typeBuf = Buffer.from(type, "ascii");
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const crcInput = Buffer.concat([typeBuf, data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(crcInput) >>> 0, 0);
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type: truecolor (RGB)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = chunk("IHDR", ihdrData);

  // A gentle vertical gradient (darker at the bottom) so seeded photos
  // aren't perfectly flat — still generated, still tiny, still real.
  const rowBytes = 1 + width * 3;
  const raw = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y++) {
    const shade = 1 - (y / height) * 0.35;
    const rowStart = y * rowBytes;
    raw[rowStart] = 0; // filter type: none
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 3;
      raw[px] = Math.round(r * shade);
      raw[px + 1] = Math.round(g * shade);
      raw[px + 2] = Math.round(b * shade);
    }
  }
  const idat = chunk("IDAT", deflateSync(raw));
  const iend = chunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// A small, fixed palette so re-running the seed script deterministically
// reuses the same colors per named entity rather than random noise.
const PALETTE: Record<string, [number, number, number]> = {
  red: [196, 60, 52],
  amber: [201, 138, 34],
  emerald: [46, 133, 96],
  teal: [32, 129, 138],
  indigo: [70, 90, 168],
  violet: [122, 78, 168],
  rose: [175, 62, 110],
  slate: [90, 98, 112],
};

export function colorForSeed(seed: string): [number, number, number] {
  const keys = Object.keys(PALETTE);
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETTE[keys[hash % keys.length]];
}
