import { Injectable } from "@nestjs/common";
import { v2 as cloudinary } from "cloudinary";

const CLOUDINARY_CLOUD_NAME = "dbtue1zsm";
const CLOUDINARY_API_KEY = "235144734536785";
const CLOUDINARY_API_SECRET = "kERC8NEd4LU9jJQDbV7GBNeS3N0";

type UploadAvatarInput = {
  fileBase64: string;
  mimeType: string;
  userId: string;
};

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      secure: true
    });
  }

  async uploadUserAvatar(input: UploadAvatarInput) {
    const dataUri = `data:${input.mimeType};base64,${input.fileBase64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "dem-bud/avatars",
      public_id: `${input.userId}-${Date.now()}`,
      overwrite: true,
      resource_type: "image",
      transformation: [{ width: 512, height: 512, crop: "fill", gravity: "auto" }]
    });

    return {
      publicId: result.public_id,
      secureUrl: result.secure_url,
      bytes: result.bytes ?? 0,
      width: result.width ?? null,
      height: result.height ?? null,
      format: result.format ?? null
    };
  }
}
