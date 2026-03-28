import type { Area } from 'react-easy-crop';

function createImage(imageSrc: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('Unable to load selected image.')));
    image.src = imageSrc;
  });
}

export async function getCircularCroppedImageFile(
  imageSrc: string,
  pixelCrop: Area,
  fileName = 'profile-photo.jpg',
): Promise<File> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to initialize image editor.');
  }

  context.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.92);
  });

  if (!blob) {
    throw new Error('Unable to finalize cropped image.');
  }

  return new File([blob], fileName, { type: 'image/jpeg' });
}
