import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser, JwtAuthGuard } from "@ceylon/nest-common";
import type { JwtAccessPayload } from "@ceylon/shared-types";
import { CreateRatingDto } from "./dto/create-rating.dto";
import { RatingsFilterQuery } from "./dto/ratings-filter.query";
import { RatingsService } from "./ratings.service";

@Controller("ratings")
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body() dto: CreateRatingDto,
    @CurrentUser() caller: JwtAccessPayload,
    @Headers("authorization") authorizationHeader: string,
  ) {
    return this.ratingsService.create(dto, caller, authorizationHeader);
  }

  // Public — shown on restaurant/event discovery pages.
  @Get()
  list(@Query() query: RatingsFilterQuery) {
    return this.ratingsService.list(
      query.restaurantId,
      query.subjectType,
      query.subjectId,
      query.page ?? 1,
      query.pageSize ?? 20,
    );
  }

  @Get("summary")
  summary(@Query() query: RatingsFilterQuery) {
    return this.ratingsService.summary(
      query.restaurantId,
      query.subjectType,
      query.subjectId,
    );
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param("id") id: string, @CurrentUser() caller: JwtAccessPayload) {
    return this.ratingsService.delete(id, caller);
  }
}
