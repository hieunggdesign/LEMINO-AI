/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef } from 'react';
import { UploadIcon, XCircleIcon } from './icons.tsx';

interface ImageUploaderProps {
  onImageUpload: (dataUrl: string) => void;
  onClearImage: () => void;
  imageSrc: string | null;
  title: string;
  icon: React.ReactNode;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload, onClearImage, imageSrc, title, icon }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onImageUpload(reader.result as string);
      };
      reader.onerror = () => {
        console.error("Failed to read file");
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="relative w-full aspect-square bg-gray-900 rounded-lg overflow-hidden shadow-lg flex items-center justify-center">
      {imageSrc ? (
        <>
          <img src={imageSrc} alt="Preview" className="w-full h-full object-contain" />
          <button
            onClick={onClearImage}
            className="absolute top-2 right-2 bg-black/50 p-2 rounded-full text-white hover:bg-black/75 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-indigo-500"
            aria-label={`Remove ${title}`}
          >
            <XCircleIcon className="w-6 h-6" />
          </button>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center text-center p-4">
          <div className="w-16 h-16 text-gray-500 mb-4">
            {icon}
          </div>
          <h3 className="text-lg font-semibold text-gray-300 mb-2">{title}</h3>
          <button
            onClick={handleUploadClick}
            className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-500 transition-colors duration-300 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-indigo-500"
            aria-label={`Upload ${title}`}
          >
            <UploadIcon className="w-5 h-5 mr-2" />
            Upload
          </button>
        </div>
      )}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
      />
    </div>
  );
};

export default ImageUploader;