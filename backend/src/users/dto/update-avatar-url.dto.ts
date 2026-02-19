import { IsString, IsUrl, MaxLength } from "class-validator";

export class UpdateAvatarUrlDto {
  @IsString()
  @IsUrl()
  @MaxLength(1000)
  avatarUrl!: string;
}
