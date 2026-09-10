import { IsIn, IsNotEmpty, IsString } from "class-validator";
import type { MediaCategory } from "../media-storage.service";

const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const ALLOWED_CATEGORIES: MediaCategory[] = [
  "menu-photo",
  "event-banner",
  "payment-proof",
  "restaurant-cover",
];

export class PresignUploadDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsIn(ALLOWED_CONTENT_TYPES)
  contentType: (typeof ALLOWED_CONTENT_TYPES)[number];

  @IsIn(ALLOWED_CATEGORIES)
  category: MediaCategory;
}
