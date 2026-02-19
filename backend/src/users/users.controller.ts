import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Request } from "express";
import type { User } from "@supabase/supabase-js";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { CloudinaryService } from "../cloudinary/cloudinary.service";
import { SupabaseService } from "../supabase/supabase.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { UpdateAvatarUrlDto } from "./dto/update-avatar-url.dto";

type RequestWithUser = Request & {
  user: User;
};

type UploadedImage = {
  buffer: {
    toString: (encoding: "base64") => string;
  };
  mimetype: string;
  size: number;
  originalname: string;
};

function isAdmin(user: User): boolean {
  return user.user_metadata?.["role"] === "ADMIN";
}

@Controller("users")
export class UsersController {
  constructor(
    private readonly cloudinaryService: CloudinaryService,
    private readonly supabaseService: SupabaseService
  ) {}

  @Get("accounts")
  @UseGuards(SupabaseAuthGuard)
  async listAccounts(@Req() req: RequestWithUser) {
    try {
      const accounts = await this.supabaseService.listAccounts();

      return {
        count: accounts.length,
        accounts
      };
    } catch (error) {
      const currentAccount = await this.supabaseService.getAccountById(req.user.id);
      if (currentAccount) {
        return {
          count: 1,
          accounts: [currentAccount],
          partial: true,
          warning: "Falling back to current user account only"
        };
      }

      throw new BadRequestException(
        error instanceof Error ? error.message : "Unable to load user accounts"
      );
    }
  }

  @Patch("profile")
  @UseGuards(SupabaseAuthGuard)
  async updateProfile(@Body() payload: UpdateProfileDto, @Req() req: RequestWithUser) {
    const normalizedName = typeof payload.name === "string" ? payload.name.trim() : undefined;
    const normalizedPosition = typeof payload.position === "string" ? payload.position.trim() : undefined;

    if (!normalizedName && !normalizedPosition) {
      throw new BadRequestException("At least one field is required: name or position");
    }

    const result = await this.supabaseService.updateUserProfile(req.user.id, {
      name: normalizedName,
      position: normalizedPosition
    });

    return result;
  }

  @Post("avatar")
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: 5 * 1024 * 1024
      }
    })
  )
  async uploadAvatar(@UploadedFile() file: UploadedImage | undefined, @Req() req: RequestWithUser) {
    if (!file) {
      throw new BadRequestException("Missing file field in multipart/form-data");
    }

    if (!file.mimetype.startsWith("image/")) {
      throw new BadRequestException("Only image files are allowed");
    }

    const uploaded = await this.cloudinaryService.uploadUserAvatar({
      fileBase64: file.buffer.toString("base64"),
      mimeType: file.mimetype,
      userId: req.user.id
    });

    const metadataUpdate = await this.supabaseService.setUserAvatarUrl(req.user.id, uploaded.secureUrl);

    return {
      uploaded: true,
      file: {
        originalName: file.originalname,
        mimeType: file.mimetype,
        bytes: file.size
      },
      avatar: uploaded,
      user: {
        id: req.user.id,
        email: req.user.email ?? null
      },
      metadataUpdate
    };
  }

  @Post("bootstrap-admin")
  @UseGuards(SupabaseAuthGuard)
  async bootstrapAdmin(@Body() body: { bootstrapKey: string }, @Req() req: RequestWithUser) {
    if (body.bootstrapKey !== "superhasło") {
      throw new ForbiddenException("Invalid bootstrap key");
    }
    return this.supabaseService.updateUserMetadata(req.user.id, { role: "ADMIN" });
  }

  @Patch(":id/role")
  @UseGuards(SupabaseAuthGuard)
  async updateRole(@Param("id") id: string, @Body() payload: UpdateRoleDto, @Req() req: RequestWithUser) {
    if (!isAdmin(req.user)) {
      throw new ForbiddenException("Only admins can change roles");
    }

    return this.supabaseService.updateUserMetadata(id, { role: payload.role });
  }

  @Patch(":id/avatar-url")
  @UseGuards(SupabaseAuthGuard)
  async setAvatarUrl(@Param("id") id: string, @Body() payload: UpdateAvatarUrlDto, @Req() req: RequestWithUser) {
    if (id !== req.user.id && !isAdmin(req.user)) {
      throw new ForbiddenException("Only admins can set avatar URLs for other users");
    }

    return this.supabaseService.setUserAvatarUrl(id, payload.avatarUrl);
  }

  @Delete(":id")
  @UseGuards(SupabaseAuthGuard)
  async deleteUser(@Param("id") id: string, @Req() req: RequestWithUser) {
    if (!isAdmin(req.user)) {
      throw new ForbiddenException("Only admins can delete accounts");
    }

    if (id === req.user.id) {
      throw new BadRequestException("Cannot delete your own account");
    }

    return this.supabaseService.deleteUser(id);
  }
}
