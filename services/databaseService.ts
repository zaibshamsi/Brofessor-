
import { supabase } from './supabaseClient';

const BUCKET_NAME = 'knowledge_files';

/**
 * Sanitizes a filename by replacing characters that are problematic for URLs or file systems.
 * It allows letters, numbers, hyphens, underscores, and periods.
 * All other characters are replaced with an underscore.
 * @param filename The original filename.
 * @returns The sanitized filename.
 */
const sanitizeFileName = (filename: string): string => {
  // Replace any character that is not a letter, number, hyphen, underscore, or period with an underscore.
  // This also handles spaces and special characters like `[` and `]`.
  return filename.replace(/[^a-zA-Z0-9-._]/g, '_');
};


export const databaseService = {
  /**
   * Uploads a file to Supabase Storage.
   * @param file The file to upload.
   * @param userId The ID of the user uploading the file.
   * @returns The storage path of the uploaded file.
   */
  async uploadFile(file: File, userId: string): Promise<{ path: string }> {
    // Sanitize the filename to remove invalid characters before creating the path.
    const sanitizedFileName = sanitizeFileName(file.name);
    
    // We use a user-specific folder and a timestamp to prevent overwriting files.
    // This aligns with common Supabase RLS policies where users can only write to their own folder.
    const filePath = `${userId}/${Date.now()}-${sanitizedFileName}`;
    
    const { error } = await supabase.storage.from(BUCKET_NAME).upload(filePath, file);
    if (error) {
        console.error("Supabase storage upload error:", error);
        throw error;
    }
    return { path: filePath };
  },

  /**
   * Deletes a file from Supabase Storage.
   * @param path The storage path of the file to delete.
   */
  async deleteFile(path: string): Promise<void> {
    const { error } = await supabase.storage.from(BUCKET_NAME).remove([path]);
    if (error) {
        // Log the error but don't throw, as we still want to proceed with
        // removing the file reference from the database table.
        console.error("Error deleting file from storage:", error.message);
    }
  },

  /**
   * Gets the public URL for a file in Supabase Storage.
   * @param path The storage path of the file.
   * @returns The public URL of the file.
   */
  getPublicUrl(path: string): { publicUrl: string } {
    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
    return { publicUrl: data.publicUrl };
  }
};