import { Injectable, NotFoundException } from "@nestjs/common";
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

export type MediaCategory =
  | "menu-photo"
  | "event-banner"
  | "payment-proof"
  | "restaurant-cover";

const UPLOAD_URL_TTL_SECONDS = 5 * 60;

@Injectable()
export class MediaStorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor() {
    const endpoint = process.env.MINIO_ENDPOINT ?? "minio";
    const port = process.env.MINIO_PORT ?? "9000";
    const useSsl = process.env.MINIO_USE_SSL === "true";
    const scheme = useSsl ? "https" : "http";

    this.bucket = process.env.MEDIA_BUCKET ?? "ceylon-media";
    // NOTE: in production this would be a real S3/CDN public URL, not the
    // internal minio hostname — fine for local dev where the host also
    // maps this same port.
    this.publicBaseUrl = `${scheme}://${endpoint}:${port}/${this.bucket}`;

    this.s3 = new S3Client({
      endpoint: `${scheme}://${endpoint}:${port}`,
      region: "us-east-1",
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.MINIO_ROOT_USER ?? "ceylon",
        secretAccessKey: process.env.MINIO_ROOT_PASSWORD ?? "",
      },
    });
  }

  async createUploadUrl(params: {
    fileName: string;
    contentType: string;
    category: MediaCategory;
  }): Promise<{ uploadUrl: string; publicUrl: string; objectKey: string }> {
    const objectKey = buildObjectKey(params.category, params.fileName);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: params.contentType,
    });
    const uploadUrl = await getSignedUrl(this.s3, command, {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
    });

    return {
      uploadUrl,
      publicUrl: this.toPublicUrl(objectKey),
      objectKey,
    };
  }

  async confirmUpload(
    objectKey: string,
  ): Promise<{ objectKey: string; publicUrl: string; sizeBytes: number }> {
    try {
      const head = await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      );
      return {
        objectKey,
        publicUrl: this.toPublicUrl(objectKey),
        sizeBytes: head.ContentLength ?? 0,
      };
    } catch {
      throw new NotFoundException(
        `Object '${objectKey}' has not been uploaded yet`,
      );
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }),
    );
  }

  private toPublicUrl(objectKey: string): string {
    return `${this.publicBaseUrl}/${objectKey}`;
  }
}

function buildObjectKey(category: MediaCategory, fileName: string): string {
  const sanitized = fileName
    .replace(/[/\\]/g, "_")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/\.\./g, "_")
    .trim();
  const safeName = sanitized.length > 0 ? sanitized : "file";
  return `${category}/${randomUUID()}-${safeName}`;
}
