import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "@ceylon/nest-common";
import { MediaStorageService } from "./media-storage.service";
import { PresignUploadDto } from "./dto/presign-upload.dto";
import { ConfirmUploadDto } from "./dto/confirm-upload.dto";

@Controller("media")
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly mediaStorageService: MediaStorageService) {}

  @Post("presign-upload")
  presignUpload(@Body() dto: PresignUploadDto) {
    return this.mediaStorageService.createUploadUrl(dto);
  }

  @Post("confirm")
  @HttpCode(HttpStatus.OK)
  confirmUpload(@Body() dto: ConfirmUploadDto) {
    return this.mediaStorageService.confirmUpload(dto.objectKey);
  }

  @Delete(":objectKey(*)")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteObject(@Param("objectKey") objectKey: string) {
    await this.mediaStorageService.deleteObject(objectKey);
  }
}
