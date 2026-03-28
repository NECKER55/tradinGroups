import { CLOUDINARY_CLOUD_NAME } from '../config/env';

interface CloudinaryTransformOptions {
  width?: number;
  height?: number;
  crop?: string;
  gravity?: string;
  radius?: string;
}

function encodePublicId(publicId: string): string {
  return publicId
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function buildCloudinaryImageUrl(
  publicId: string,
  options: CloudinaryTransformOptions = {},
): string {
  if (!CLOUDINARY_CLOUD_NAME) return '';

  const {
    width = 64,
    height = 64,
    crop = 'thumb',
    gravity = 'face',
    radius = 'max',
  } = options;

  const transformations = [
    'f_auto',
    'q_auto',
    `c_${crop}`,
    `g_${gravity}`,
    `w_${width}`,
    `h_${height}`,
    `r_${radius}`,
  ].join(',');

  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${transformations}/${encodePublicId(publicId)}`;
}

export function resolveUserPhotoUrl(photoUrl: string | null | undefined, size = 64): string | null {
  if (!photoUrl) return null;

  if (/^https?:\/\//i.test(photoUrl)) {
    return photoUrl;
  }

  const cloudinaryUrl = buildCloudinaryImageUrl(photoUrl, { width: size, height: size });
  return cloudinaryUrl || null;
}

export function resolveGroupPhotoUrl(photoUrl: string | null | undefined, size = 64): string | null {
  if (!photoUrl) return null;

  if (/^https?:\/\//i.test(photoUrl)) {
    return photoUrl;
  }

  const cloudinaryUrl = buildCloudinaryImageUrl(photoUrl, { width: size, height: size });
  return cloudinaryUrl || null;
}
