import { IsIn, IsString } from "class-validator";

export class UpdateRoleDto {
  @IsString()
  @IsIn(["ADMIN", "USER"])
  role!: "ADMIN" | "USER";
}
