import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { ExcelModule } from "./excel/excel.module";
import { HealthController } from "./health/health.controller";
import { SupabaseModule } from "./supabase/supabase.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [SupabaseModule, AuthModule, ExcelModule, UsersModule],
  controllers: [HealthController]
})
export class AppModule {}
