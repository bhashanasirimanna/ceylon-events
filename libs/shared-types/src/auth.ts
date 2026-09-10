import { z } from "zod";
import { UserRole } from "./roles";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
});
export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginDto = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshDto = z.infer<typeof refreshSchema>;

export interface JwtAccessPayload {
  sub: string;
  email: string;
  roles: UserRole[];
  restaurantId?: string;
  type: "access";
}

export interface JwtRefreshPayload {
  sub: string;
  tokenId: string;
  type: "refresh";
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
