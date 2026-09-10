import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard, Roles, RolesGuard, CurrentUser } from "@ceylon/nest-common";
import { UserRole, type JwtAccessPayload } from "@ceylon/shared-types";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { InviteStaffDto } from "./dto/invite-staff.dto";
import { toUserResponse } from "../users/user-response";
import { UsersService } from "../users/users.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  // Tighter than this service's default 120/min: these three endpoints are
  // exactly what a credential-stuffing or brute-force attempt would hit,
  // so they get their own stricter per-IP limit regardless of the
  // gateway's own throttling in front of them.
  @Post("register")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async register(@Body() dto: RegisterDto) {
    const { user, tokens } = await this.authService.register(dto);
    return { user: toUserResponse(user), tokens };
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(@Body() dto: LoginDto) {
    const { user, tokens } = await this.authService.login(dto);
    return { user: toUserResponse(user), tokens };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async refresh(@Body() dto: RefreshDto) {
    const tokens = await this.authService.refresh(dto.refreshToken);
    return { tokens };
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshDto) {
    await this.authService.logout(dto.refreshToken);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: JwtAccessPayload) {
    const record = await this.usersService.findById(user.sub);
    return record ? toUserResponse(record) : null;
  }

  @Post("invite-restaurant-staff")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.RESTAURANT_OWNER)
  async inviteRestaurantStaff(
    @Body() dto: InviteStaffDto,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    const isPlatformAdmin = caller.roles.some(
      (role) => role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN,
    );
    if (!isPlatformAdmin) {
      // A restaurant owner may only invite staff into their own restaurant,
      // and may not grant another owner-level account.
      if (
        caller.restaurantId !== dto.restaurantId ||
        dto.role !== UserRole.RESTAURANT_STAFF
      ) {
        throw new ForbiddenException(
          "Restaurant owners may only invite staff into their own restaurant",
        );
      }
    }

    const { user, tempPassword } =
      await this.authService.inviteRestaurantStaff(dto);
    return { user: toUserResponse(user), tempPassword };
  }
}
