import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ExcelController } from "./excel.controller";
import { ExcelService } from "./excel.service";

@Module({
  imports: [AuthModule],
  controllers: [ExcelController],
  providers: [ExcelService],
  exports: [ExcelService]
})
export class ExcelModule {}
