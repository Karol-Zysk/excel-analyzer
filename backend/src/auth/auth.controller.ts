import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import type { User } from "@supabase/supabase-js";
import { SupabaseAuthGuard } from "./supabase-auth.guard";

type RequestWithUser = Request & {
  user: User;
};

@Controller("auth")
export class AuthController {
  @Get("me")
  @UseGuards(SupabaseAuthGuard)
  me(@Req() req: RequestWithUser) {
    return {
      id: req.user.id,
      email: req.user.email ?? null,
      userMetadata: req.user.user_metadata ?? {},
      appMetadata: req.user.app_metadata ?? {}
    };
  }
}
