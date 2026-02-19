import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";
import type { User } from "@supabase/supabase-js";
import { SupabaseService } from "../supabase/supabase.service";

type RequestWithUser = Request & {
  user?: User;
};

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      throw new UnauthorizedException("Missing Bearer token");
    }

    const accessToken = authHeader.slice(7).trim();
    if (!accessToken) {
      throw new UnauthorizedException("Missing access token");
    }

    const user = await this.supabaseService.getUserFromAccessToken(accessToken);
    if (!user) {
      throw new UnauthorizedException("Invalid Supabase access token");
    }

    req.user = user;
    return true;
  }
}
