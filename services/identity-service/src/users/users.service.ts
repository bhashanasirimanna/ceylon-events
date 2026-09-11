import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { UserRole } from "@ceylon/shared-types";
import { Repository } from "typeorm";
import { User } from "./entities/user.entity";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  findByInviteToken(inviteToken: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { inviteToken } });
  }

  async createUser(params: {
    email: string;
    passwordHash: string;
    fullName: string;
    roles?: UserRole[];
    restaurantId?: string | null;
    isActive?: boolean;
    inviteToken?: string | null;
    inviteTokenExpiresAt?: Date | null;
  }): Promise<User> {
    const user = this.usersRepository.create({
      email: params.email,
      passwordHash: params.passwordHash,
      fullName: params.fullName,
      roles: params.roles ?? [UserRole.CUSTOMER],
      restaurantId: params.restaurantId ?? null,
      isActive: params.isActive ?? true,
      inviteToken: params.inviteToken ?? null,
      inviteTokenExpiresAt: params.inviteTokenExpiresAt ?? null,
    });
    return this.usersRepository.save(user);
  }

  save(user: User): Promise<User> {
    return this.usersRepository.save(user);
  }
}
