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

  async createUser(params: {
    email: string;
    passwordHash: string;
    fullName: string;
    roles?: UserRole[];
    restaurantId?: string | null;
  }): Promise<User> {
    const user = this.usersRepository.create({
      email: params.email,
      passwordHash: params.passwordHash,
      fullName: params.fullName,
      roles: params.roles ?? [UserRole.CUSTOMER],
      restaurantId: params.restaurantId ?? null,
    });
    return this.usersRepository.save(user);
  }
}
