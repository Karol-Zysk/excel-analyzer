import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type DemoAnalysisPayload = {
  fileName: string;
  rowCount: number;
};

type UploadExcelFilePayload = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  bytes: number;
};

type ProfileUpdatePayload = {
  name?: string;
  position?: string;
};

type AccountSummary = {
  id: string;
  email: string | null;
  name: string;
  position: string | null;
  avatarUrl: string | null;
  role: "ADMIN" | "USER";
  ksefGeneratedCount: number;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
};

type KsefCompanyProfileInput = {
  id?: string;
  companyName: string;
  nip: string;
  countryCode: string;
  addressLine1: string;
  addressLine2?: string;
  email?: string;
  phone?: string;
  currency?: string;
  paymentMethod?: string;
  bankAccount?: string;
};

export type KsefCompanyProfile = {
  id: string;
  companyName: string;
  nip: string;
  countryCode: string;
  addressLine1: string;
  addressLine2: string | null;
  email: string | null;
  phone: string | null;
  currency: string | null;
  paymentMethod: string | null;
  bankAccount: string | null;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;
  private readonly excelBucketName = process.env.SUPABASE_EXCEL_BUCKET || "excel-files";
  private isExcelBucketEnsured = false;

  constructor() {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend .env");
    }

    this.client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }

  async pingStorage() {
    const { data, error } = await this.client.storage.listBuckets();

    if (error) {
      return {
        ok: false,
        error: error.message
      };
    }

    return {
      ok: true,
      bucketCount: data.length,
      buckets: data.map((bucket) => ({
        id: bucket.id,
        name: bucket.name
      }))
    };
  }

  async saveDemoAnalysis(payload: DemoAnalysisPayload) {
    const { data, error } = await this.client
      .from("excel_analysis_jobs")
      .insert({
        file_name: payload.fileName,
        row_count: payload.rowCount
      })
      .select("id, file_name, row_count, created_at")
      .single();

    if (error) {
      return {
        saved: false,
        error: error.message,
        info: "Utworz tabele public.excel_analysis_jobs, jesli chcesz zapisywac demo analizy."
      };
    }

    return {
      saved: true,
      row: data
    };
  }

  private sanitizeFileName(fileName: string) {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  }

  private async ensureExcelBucket() {
    if (this.isExcelBucketEnsured) {
      return;
    }

    const { data: buckets, error: bucketsError } = await this.client.storage.listBuckets();
    if (bucketsError) {
      throw new Error(`Unable to list storage buckets: ${bucketsError.message}`);
    }

    const bucketExists = buckets.some((bucket) => bucket.name === this.excelBucketName);
    if (!bucketExists) {
      const { error: createError } = await this.client.storage.createBucket(this.excelBucketName, {
        public: false,
        fileSizeLimit: 50 * 1024 * 1024
      });

      if (createError) {
        throw new Error(`Unable to create storage bucket '${this.excelBucketName}': ${createError.message}`);
      }
    }

    this.isExcelBucketEnsured = true;
  }

  async uploadExcelFile(payload: UploadExcelFilePayload, userId: string) {
    await this.ensureExcelBucket();

    const sanitizedOriginalName = this.sanitizeFileName(payload.originalName);
    const filePath = `${userId}/${Date.now()}-${sanitizedOriginalName}`;

    const { data, error } = await this.client.storage.from(this.excelBucketName).upload(filePath, payload.buffer, {
      contentType: payload.mimeType,
      upsert: false
    });

    if (error) {
      return {
        uploaded: false,
        error: error.message
      };
    }

    const { data: signedUrlData, error: signedUrlError } = await this.client.storage
      .from(this.excelBucketName)
      .createSignedUrl(filePath, 60 * 60);

    return {
      uploaded: true,
      bucket: this.excelBucketName,
      file: {
        path: data.path,
        originalName: payload.originalName,
        mimeType: payload.mimeType,
        bytes: payload.bytes
      },
      signedUrl: signedUrlError ? null : (signedUrlData?.signedUrl ?? null),
      signedUrlError: signedUrlError?.message ?? null
    };
  }

  private getMetadataStringValue(user: User, key: string) {
    const rawValue = user.user_metadata?.[key];
    if (typeof rawValue !== "string") {
      return null;
    }

    const value = rawValue.trim();
    if (!value) {
      return null;
    }

    return value;
  }

  private getMetadataNumberValue(user: User, key: string) {
    const rawValue = user.user_metadata?.[key];
    if (typeof rawValue === "number" && Number.isFinite(rawValue) && rawValue >= 0) {
      return Math.floor(rawValue);
    }

    if (typeof rawValue === "string") {
      const parsed = Number(rawValue.trim());
      if (Number.isFinite(parsed) && parsed >= 0) {
        return Math.floor(parsed);
      }
    }

    return 0;
  }

  private resolveUserDisplayName(user: User) {
    const metadataName = this.getMetadataStringValue(user, "name") ?? this.getMetadataStringValue(user, "full_name");
    if (metadataName) {
      return metadataName;
    }

    if (!user.email) {
      return "Uzytkownik";
    }

    return user.email.split("@")[0] || "Uzytkownik";
  }

  private toAccountSummary(user: User): AccountSummary {
    const rawRole = user.user_metadata?.["role"];
    const role: "ADMIN" | "USER" = rawRole === "ADMIN" ? "ADMIN" : "USER";
    return {
      id: user.id,
      email: user.email ?? null,
      name: this.resolveUserDisplayName(user),
      position: this.getMetadataStringValue(user, "position"),
      avatarUrl: this.getMetadataStringValue(user, "avatar_url"),
      role,
      ksefGeneratedCount: this.getMetadataNumberValue(user, "ksef_generated_xml_count"),
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at ?? null,
      emailConfirmedAt: user.email_confirmed_at ?? null
    };
  }

  private async listAllAuthUsers() {
    const allUsers: User[] = [];
    const perPage = 200;
    let page = 1;

    while (true) {
      const { data, error } = await this.client.auth.admin.listUsers({ page, perPage });
      if (error) {
        throw new Error(`Unable to list auth users: ${error.message}`);
      }

      allUsers.push(...data.users);
      if (data.users.length < perPage) {
        break;
      }

      page += 1;
    }

    return allUsers;
  }

  async listAccounts() {
    const users = await this.listAllAuthUsers();
    return users.map((user) => this.toAccountSummary(user));
  }

  async getAccountById(userId: string) {
    const { data, error } = await this.client.auth.admin.getUserById(userId);
    if (error || !data.user) {
      return null;
    }

    return this.toAccountSummary(data.user);
  }

  private async getCurrentUserMetadata(userId: string) {
    const { data, error } = await this.client.auth.admin.getUserById(userId);
    if (error) {
      throw new Error(`Unable to load user metadata: ${error.message}`);
    }

    if (!data.user) {
      throw new Error("Unable to load user metadata: user not found");
    }

    return data.user.user_metadata ?? {};
  }

  private mergeUserMetadata(currentMetadata: Record<string, unknown>, patch: Record<string, unknown>) {
    return Object.entries(patch).reduce<Record<string, unknown>>((acc, [key, value]) => {
      if (value === undefined) {
        return acc;
      }

      acc[key] = value;
      return acc;
    }, { ...currentMetadata });
  }

  private normalizeOptionalMetadataText(value: unknown) {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private normalizeKsefCompanyProfiles(rawProfiles: unknown) {
    if (!Array.isArray(rawProfiles)) {
      return [] as KsefCompanyProfile[];
    }

    return rawProfiles
      .map((item) => {
        if (typeof item !== "object" || item === null) {
          return null;
        }

        const candidate = item as Record<string, unknown>;
        const id = this.normalizeOptionalMetadataText(candidate.id);
        const companyName = this.normalizeOptionalMetadataText(candidate.companyName);
        const nip = this.normalizeOptionalMetadataText(candidate.nip);
        const countryCode = this.normalizeOptionalMetadataText(candidate.countryCode)?.toUpperCase();
        const addressLine1 = this.normalizeOptionalMetadataText(candidate.addressLine1);
        const createdAt = this.normalizeOptionalMetadataText(candidate.createdAt);
        const updatedAt = this.normalizeOptionalMetadataText(candidate.updatedAt);

        if (!id || !companyName || !nip || !countryCode || !addressLine1 || !createdAt || !updatedAt) {
          return null;
        }

        return {
          id,
          companyName,
          nip,
          countryCode,
          addressLine1,
          addressLine2: this.normalizeOptionalMetadataText(candidate.addressLine2),
          email: this.normalizeOptionalMetadataText(candidate.email),
          phone: this.normalizeOptionalMetadataText(candidate.phone),
          currency: this.normalizeOptionalMetadataText(candidate.currency)?.toUpperCase() ?? null,
          paymentMethod: this.normalizeOptionalMetadataText(candidate.paymentMethod),
          bankAccount: this.normalizeOptionalMetadataText(candidate.bankAccount),
          createdAt,
          updatedAt
        } satisfies KsefCompanyProfile;
      })
      .filter((profile): profile is KsefCompanyProfile => profile !== null)
      .sort((left, right) => left.companyName.localeCompare(right.companyName, "pl"));
  }

  async listKsefCompanyProfiles(userId: string) {
    const metadata = await this.getCurrentUserMetadata(userId);
    return this.normalizeKsefCompanyProfiles(metadata["ksef_company_profiles"]);
  }

  async saveKsefCompanyProfile(userId: string, payload: KsefCompanyProfileInput) {
    const profiles = await this.listKsefCompanyProfiles(userId);
    const existingProfile = payload.id
      ? profiles.find((profile) => profile.id === payload.id)
      : undefined;
    const now = new Date().toISOString();

    const savedProfile: KsefCompanyProfile = {
      id: existingProfile?.id ?? randomUUID(),
      companyName: payload.companyName.trim(),
      nip: payload.nip.trim(),
      countryCode: payload.countryCode.trim().toUpperCase(),
      addressLine1: payload.addressLine1.trim(),
      addressLine2: this.normalizeOptionalMetadataText(payload.addressLine2),
      email: this.normalizeOptionalMetadataText(payload.email),
      phone: this.normalizeOptionalMetadataText(payload.phone),
      currency: this.normalizeOptionalMetadataText(payload.currency)?.toUpperCase() ?? null,
      paymentMethod: this.normalizeOptionalMetadataText(payload.paymentMethod),
      bankAccount: this.normalizeOptionalMetadataText(payload.bankAccount),
      createdAt: existingProfile?.createdAt ?? now,
      updatedAt: now
    };

    const nextProfiles = [
      ...profiles.filter((profile) => profile.id !== savedProfile.id),
      savedProfile
    ].sort((left, right) => left.companyName.localeCompare(right.companyName, "pl"));

    const updateResult = await this.updateUserMetadata(userId, {
      ksef_company_profiles: nextProfiles
    });

    return {
      ...updateResult,
      profile: savedProfile,
      profiles: nextProfiles
    };
  }

  async deleteKsefCompanyProfile(userId: string, profileId: string) {
    const profiles = await this.listKsefCompanyProfiles(userId);
    const nextProfiles = profiles.filter((profile) => profile.id !== profileId);

    if (nextProfiles.length === profiles.length) {
      return {
        deleted: false,
        error: "Nie znaleziono wybranego podmiotu.",
        profiles
      };
    }

    const updateResult = await this.updateUserMetadata(userId, {
      ksef_company_profiles: nextProfiles
    });

    return {
      deleted: updateResult.updated,
      error: updateResult.updated ? undefined : updateResult.error,
      profiles: nextProfiles
    };
  }

  async updateUserProfile(userId: string, payload: ProfileUpdatePayload) {
    return this.updateUserMetadata(userId, payload);
  }

  async incrementKsefGeneratedCount(userId: string, incrementBy = 1) {
    const safeIncrement = Number.isFinite(incrementBy) ? Math.floor(incrementBy) : 0;
    if (safeIncrement <= 0) {
      const account = await this.getAccountById(userId);
      return {
        updated: true,
        count: account?.ksefGeneratedCount ?? 0
      };
    }

    const currentMetadata = await this.getCurrentUserMetadata(userId);
    const currentCountRaw = currentMetadata["ksef_generated_xml_count"];
    const currentCount =
      typeof currentCountRaw === "number" && Number.isFinite(currentCountRaw) && currentCountRaw >= 0
        ? Math.floor(currentCountRaw)
        : typeof currentCountRaw === "string" && Number.isFinite(Number(currentCountRaw))
          ? Math.max(0, Math.floor(Number(currentCountRaw)))
          : 0;

    const nextCount = currentCount + safeIncrement;
    const result = await this.updateUserMetadata(userId, {
      ksef_generated_xml_count: nextCount,
      ksef_generated_xml_updated_at: new Date().toISOString()
    });

    return {
      ...result,
      count: nextCount
    };
  }

  async updateUserMetadata(userId: string, patch: Record<string, unknown>) {
    try {
      const currentMetadata = await this.getCurrentUserMetadata(userId);
      const mergedMetadata = this.mergeUserMetadata(currentMetadata as Record<string, unknown>, patch);

      const { data, error } = await this.client.auth.admin.updateUserById(userId, {
        user_metadata: mergedMetadata
      });

      if (error) {
        return {
          updated: false,
          error: error.message
        };
      }

      return {
        updated: true,
        user: data.user
          ? {
              id: data.user.id,
              email: data.user.email ?? null,
              userMetadata: data.user.user_metadata ?? {}
            }
          : null
      };
    } catch (error) {
      return {
        updated: false,
        error: error instanceof Error ? error.message : "Unexpected error while updating user metadata"
      };
    }
  }

  async getUserFromAccessToken(accessToken: string): Promise<User | null> {
    const { data, error } = await this.client.auth.getUser(accessToken);

    if (error || !data.user) {
      return null;
    }

    return data.user;
  }

  async setUserAvatarUrl(userId: string, avatarUrl: string) {
    return this.updateUserMetadata(userId, {
      avatar_url: avatarUrl
    });
  }

  async deleteUser(userId: string) {
    const { error } = await this.client.auth.admin.deleteUser(userId);
    if (error) {
      return { deleted: false, error: error.message };
    }
    return { deleted: true };
  }
}
