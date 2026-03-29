import { v2 as cloudinary, UploadApiResponse, UploadStream } from 'cloudinary';

const {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  CLOUDINARY_URL,
} = process.env;

const hasDiscreteConfig = Boolean(
  CLOUDINARY_CLOUD_NAME
  && CLOUDINARY_API_KEY
  && CLOUDINARY_API_SECRET,
);

const hasUrlConfig = Boolean(CLOUDINARY_URL && CLOUDINARY_URL.trim().length > 0);

const isConfigured = hasDiscreteConfig || hasUrlConfig;

const missingDiscreteVars = [
  !CLOUDINARY_CLOUD_NAME ? 'CLOUDINARY_CLOUD_NAME' : null,
  !CLOUDINARY_API_KEY ? 'CLOUDINARY_API_KEY' : null,
  !CLOUDINARY_API_SECRET ? 'CLOUDINARY_API_SECRET' : null,
].filter(Boolean) as string[];

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  if (!hasUrlConfig) {
    console.warn(
      `[cloudinary] Missing configuration. Set CLOUDINARY_URL or all discrete vars (${missingDiscreteVars.join(', ')}). Profile photo uploads will fail until configured.`,
    );
  }
}

if (hasUrlConfig) {
  try {
    const parsed = new URL(CLOUDINARY_URL as string);
    cloudinary.config({
      cloud_name: parsed.hostname,
      api_key: decodeURIComponent(parsed.username),
      api_secret: decodeURIComponent(parsed.password),
      secure: true,
    });
  } catch {
    console.warn('[cloudinary] CLOUDINARY_URL is invalid. Expected format: cloudinary://<api_key>:<api_secret>@<cloud_name>');
  }
} else {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
}

interface UploadProfileImageParams {
  userId: number;
  buffer: Buffer;
}

interface UploadGroupImageParams {
  groupId: number;
  buffer: Buffer;
}

export function resolveStoredProfilePhotoUrl(photoUrl: string | null | undefined, size = 128): string | null {
  if (!photoUrl) return null;
  if (/^https?:\/\//i.test(photoUrl)) return photoUrl;
  if (!isConfigured) return photoUrl;

  return cloudinary.url(photoUrl, {
    secure: true,
    resource_type: 'image',
    transformation: [
      {
        fetch_format: 'auto',
        quality: 'auto',
        crop: 'thumb',
        gravity: 'face',
        width: size,
        height: size,
        radius: 'max',
      },
    ],
  });
}

export async function uploadProfileImage({ userId, buffer }: UploadProfileImageParams): Promise<UploadApiResponse> {
  if (!isConfigured) {
    throw new Error(`CLOUDINARY_NOT_CONFIGURED:${missingDiscreteVars.join(',')}`);
  }

  return new Promise((resolve, reject) => {
    const stream: UploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'profiles',
        public_id: `user_${userId}_${Date.now()}`,
        resource_type: 'image',
        transformation: [
          {
            crop: 'thumb',
            gravity: 'face',
            width: 512,
            height: 512,
          },
        ],
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error('Cloudinary upload failed.'));
          return;
        }
        resolve(result);
      },
    );

    stream.end(buffer);
  });
}

export async function uploadGroupImage({ groupId, buffer }: UploadGroupImageParams): Promise<UploadApiResponse> {
  if (!isConfigured) {
    throw new Error(`CLOUDINARY_NOT_CONFIGURED:${missingDiscreteVars.join(',')}`);
  }

  return new Promise((resolve, reject) => {
    const stream: UploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'groups',
        public_id: `group_${groupId}_${Date.now()}`,
        resource_type: 'image',
        transformation: [
          {
            crop: 'thumb',
            gravity: 'face',
            width: 512,
            height: 512,
          },
        ],
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error('Cloudinary upload failed.'));
          return;
        }
        resolve(result);
      },
    );

    stream.end(buffer);
  });
}

export async function deleteImage(publicId: string): Promise<void> {
  if (!isConfigured) return;

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (err) {
    // Non bloccare l'operazione principale se l'eliminazione fallisce; loggare per debug.
    // Caller può ignorare il fallimento.
    // eslint-disable-next-line no-console
    console.warn('[cloudinary] deleteImage failed for', publicId, err);
  }
}
