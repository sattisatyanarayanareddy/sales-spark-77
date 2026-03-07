// Cloudinary configuration
export const cloudinaryConfig = {
  cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dui2hcypl",
  uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "sales_qt_img",
  apiKey: import.meta.env.VITE_CLOUDINARY_API_KEY || "335644174775354",
};

/**
 * Upload image to Cloudinary
 * @param file Image file to upload
 * @param folder Folder path in Cloudinary (e.g., "quotations/QT-2026-001")
 * @returns Cloudinary image URL
 */
export async function uploadImageToCloudinary(
  file: File,
  folder: string = "sales-crm"
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", cloudinaryConfig.uploadPreset);
  formData.append("folder", folder);
  formData.append("resource_type", "auto");

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("✅ Image uploaded to Cloudinary:", data.secure_url);
    return data.secure_url; // Returns HTTPS URL
  } catch (error) {
    console.error("❌ Cloudinary upload error:", error);
    throw error;
  }
}

/**
 * Generate optimized Cloudinary image URL with transformations
 * @param url Original Cloudinary URL
 * @param width Image width (optional)
 * @param quality Quality level: auto, 80, 85, 90, etc
 * @returns Optimized image URL
 */
export function optimizeCloudinaryUrl(
  url: string,
  width?: number,
  quality: string = "auto"
): string {
  if (!url) return "";
  
  // If already optimized, return as-is
  if (url.includes("/c_")) return url;

  // Insert transformations into URL
  // Pattern: /upload/ -> /upload/w_800,q_auto/
  const transformations = [
    width ? `w_${width}` : "",
    `q_${quality}`,
    "f_auto", // Auto format selection
  ]
    .filter(Boolean)
    .join(",");

  return url.replace(
    `/upload/`,
    `/upload/${transformations}/`
  );
}

/**
 * Generate thumbnail URL from Cloudinary
 * @param url Original image URL
 * @returns Thumbnail URL (200x200px)
 */
export function getThumbnailUrl(url: string): string {
  return optimizeCloudinaryUrl(url, 200);
}

/**
 * Generate preview URL from Cloudinary
 * @param url Original image URL
 * @returns Preview URL (500x500px)
 */
export function getPreviewUrl(url: string): string {
  return optimizeCloudinaryUrl(url, 500);
}
