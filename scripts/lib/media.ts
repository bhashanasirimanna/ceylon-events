import type { Api } from "./http";
import { colorForSeed, makeSolidPng } from "./png";

export type MediaCategory = "menu-photo" | "event-banner" | "payment-proof" | "restaurant-cover";

const SIZE_BY_CATEGORY: Record<MediaCategory, [number, number]> = {
  "menu-photo": [480, 360],
  "event-banner": [960, 360],
  "restaurant-cover": [960, 480],
  "payment-proof": [480, 480],
};

/**
 * The real presign → PUT → confirm path media-service exposes to every
 * frontend uploader — used here instead of fabricating a URL string so
 * seeded photos exercise the exact same code path (and land in the same
 * MinIO bucket) a real user's upload would.
 */
export async function uploadSeedImage(
  api: Api,
  category: MediaCategory,
  seedName: string,
): Promise<string> {
  const [width, height] = SIZE_BY_CATEGORY[category];
  const png = makeSolidPng(width, height, colorForSeed(seedName));
  const fileName = `${seedName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;

  const presign = await api.post("/media/presign-upload", {
    fileName,
    contentType: "image/png",
    category,
  });

  const putRes = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/png" },
    body: png,
  });
  if (!putRes.ok) {
    throw new Error(
      `Upload PUT to MinIO failed for ${fileName}: ${putRes.status} ${await putRes.text()}`,
    );
  }

  const confirmed = await api.post("/media/confirm", { objectKey: presign.objectKey });
  return confirmed.publicUrl as string;
}
