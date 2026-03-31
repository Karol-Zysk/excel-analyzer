import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { KsefController } from "./ksef.controller";
import { KsefService } from "./ksef.service";

@Module({
  imports: [AuthModule],
  controllers: [KsefController],
  providers: [KsefService],
  exports: [KsefService]
})
export class KsefModule {}
