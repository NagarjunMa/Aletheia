import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/database/types";
import { createLogger, startTimedStage, type SafeLogger } from "@/lib/logger";
import { parseResumeFile, validateResumeFile } from "./parser";

export const RESUME_BUCKET = "user-resumes";
export const MAX_RESUMES_PER_USER = 5;
const log = createLogger("resume-service");

export type ResumeListItem = Pick<
  Tables<"user_resumes">,
  | "id"
  | "label"
  | "file_name"
  | "file_mime"
  | "file_size"
  | "is_primary"
  | "created_at"
  | "updated_at"
> & {
  parsed_text_chars: number;
  has_storage_file: boolean;
};

export type ResumeUploadResult = {
  resume: ResumeListItem;
  truncated: boolean;
};

type Supabase = SupabaseClient<Database>;
type ResumeStorageClient = Pick<Supabase, "storage">;

function toListItem(row: Tables<"user_resumes">): ResumeListItem {
  return {
    id: row.id,
    label: row.label,
    file_name: row.file_name,
    file_mime: row.file_mime,
    file_size: row.file_size,
    is_primary: row.is_primary,
    created_at: row.created_at,
    updated_at: row.updated_at,
    parsed_text_chars: row.parsed_text.length,
    has_storage_file: Boolean(row.storage_path),
  };
}

export function sanitizeResumeFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() || "resume";
  return (
    base
      .normalize("NFKD")
      .replace(/[^\w.\- ]+/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 120)
      .replace(/^\.+/, "") || "resume"
  );
}

export async function listUserResumes(
  supabase: Supabase,
  userId: string,
): Promise<ResumeListItem[]> {
  const { data, error } = await supabase
    .from("user_resumes")
    .select(
      "id,label,file_name,file_mime,file_size,parsed_text,is_primary,storage_path,created_at,updated_at,user_id",
    )
    .eq("user_id", userId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toListItem);
}

export async function getPrimaryResumeText(
  supabase: Supabase,
  userId: string,
  logger: SafeLogger = log,
): Promise<{ text: string; source: "user_resumes" | "profiles" | "none" }> {
  const complete = startTimedStage(logger, "repository.primary_resume_read", {
    userId,
  });
  try {
    const { data: primary, error: primaryError } = await supabase
      .from("user_resumes")
      .select("parsed_text")
      .eq("user_id", userId)
      .eq("is_primary", true)
      .maybeSingle();

    if (primaryError) throw primaryError;
    if (primary?.parsed_text?.trim()) {
      complete("success", { source: "user_resumes", hasText: true });
      return { text: primary.parsed_text, source: "user_resumes" };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("resume")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (profile?.resume?.trim()) {
      complete("success", { source: "profiles", hasText: true });
      return { text: profile.resume, source: "profiles" };
    }

    complete("success", { source: "none", hasText: false });
    return { text: "", source: "none" };
  } catch (error) {
    complete("failure", { errorCode: "PRIMARY_RESUME_READ_FAILED" });
    throw error;
  }
}

export async function uploadUserResume(
  supabase: Supabase,
  userId: string,
  file: File,
  label?: string,
  storageSupabase: ResumeStorageClient = supabase,
): Promise<ResumeUploadResult> {
  const validationError = validateResumeFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const existing = await listUserResumes(supabase, userId);
  if (existing.length >= MAX_RESUMES_PER_USER) {
    throw new Error("Resume limit exceeded");
  }

  const parsed = await parseResumeFile(file);
  const resumeId = crypto.randomUUID();
  const safeName = sanitizeResumeFileName(file.name);
  const storagePath = `${userId}/${resumeId}/${safeName}`;
  const isPrimary =
    existing.length === 0 || !existing.some((r) => r.is_primary);

  const completeUpload = startTimedStage(log, "storage.resume_upload", {
    userId,
    fileSize: file.size,
  });
  const { error: uploadError } = await storageSupabase.storage
    .from(RESUME_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    completeUpload("failure", { errorCode: "RESUME_STORAGE_UPLOAD_FAILED" });
    throw uploadError;
  }
  completeUpload("success");

  const completeRecord = startTimedStage(
    log,
    "repository.resume_record_create",
    {
      userId,
    },
  );
  const { data, error: insertError } = await supabase
    .from("user_resumes")
    .insert({
      id: resumeId,
      user_id: userId,
      label: (label || safeName).trim().slice(0, 120),
      file_name: safeName,
      file_mime: file.type,
      file_size: file.size,
      storage_path: storagePath,
      parsed_text: parsed.text,
      is_primary: isPrimary,
    })
    .select(
      "id,label,file_name,file_mime,file_size,parsed_text,is_primary,storage_path,created_at,updated_at,user_id",
    )
    .single();

  if (insertError) {
    await storageSupabase.storage.from(RESUME_BUCKET).remove([storagePath]);
    completeRecord("failure", { errorCode: "RESUME_RECORD_CREATE_FAILED" });
    throw insertError;
  }

  completeRecord("success");
  return { resume: toListItem(data), truncated: parsed.truncated };
}

export async function renameUserResume(
  supabase: Supabase,
  userId: string,
  resumeId: string,
  label: string,
): Promise<ResumeListItem> {
  const { data, error } = await supabase
    .from("user_resumes")
    .update({ label: label.trim().slice(0, 120) })
    .eq("user_id", userId)
    .eq("id", resumeId)
    .select(
      "id,label,file_name,file_mime,file_size,parsed_text,is_primary,storage_path,created_at,updated_at,user_id",
    )
    .single();

  if (error) throw error;
  return toListItem(data);
}

export async function setPrimaryUserResume(
  supabase: Supabase,
  userId: string,
  resumeId: string,
): Promise<ResumeListItem> {
  const { data: target, error: targetError } = await supabase
    .from("user_resumes")
    .select("id")
    .eq("user_id", userId)
    .eq("id", resumeId)
    .single();

  if (targetError) throw targetError;
  if (!target) throw new Error("Resume not found");

  const { error: clearError } = await supabase
    .from("user_resumes")
    .update({ is_primary: false })
    .eq("user_id", userId)
    .eq("is_primary", true);

  if (clearError) throw clearError;

  const { data, error } = await supabase
    .from("user_resumes")
    .update({ is_primary: true })
    .eq("user_id", userId)
    .eq("id", resumeId)
    .select(
      "id,label,file_name,file_mime,file_size,parsed_text,is_primary,storage_path,created_at,updated_at,user_id",
    )
    .single();

  if (error) throw error;
  return toListItem(data);
}

export async function deleteUserResume(
  supabase: Supabase,
  userId: string,
  resumeId: string,
): Promise<{ promoted_resume_id: string | null }> {
  const { data: resume, error: fetchError } = await supabase
    .from("user_resumes")
    .select("id,user_id,storage_path,is_primary")
    .eq("user_id", userId)
    .eq("id", resumeId)
    .single();

  if (fetchError) throw fetchError;

  if (resume.storage_path) {
    const completeRemove = startTimedStage(log, "storage.resume_delete", {
      userId,
    });
    const { error: removeError } = await supabase.storage
      .from(RESUME_BUCKET)
      .remove([resume.storage_path]);
    if (removeError) {
      completeRemove("failure", { errorCode: "RESUME_STORAGE_DELETE_FAILED" });
      throw removeError;
    }
    completeRemove("success");
  }

  const completeRecordDelete = startTimedStage(
    log,
    "repository.resume_record_delete",
    {
      userId,
    },
  );
  const { error: deleteError } = await supabase
    .from("user_resumes")
    .delete()
    .eq("user_id", userId)
    .eq("id", resumeId);

  if (deleteError) {
    completeRecordDelete("failure", {
      errorCode: "RESUME_RECORD_DELETE_FAILED",
    });
    throw deleteError;
  }
  completeRecordDelete("success");

  if (!resume.is_primary) {
    return { promoted_resume_id: null };
  }

  const { data: nextResume, error: nextError } = await supabase
    .from("user_resumes")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (nextError) throw nextError;
  if (!nextResume) {
    return { promoted_resume_id: null };
  }

  const { error: promoteError } = await supabase
    .from("user_resumes")
    .update({ is_primary: true })
    .eq("user_id", userId)
    .eq("id", nextResume.id);

  if (promoteError) throw promoteError;
  return { promoted_resume_id: nextResume.id };
}
