import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CloudinaryService } from "../cloudinary/cloudinary.service";
import { UsersController } from "./users.controller";

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [CloudinaryService]
})
export class UsersModule {}

