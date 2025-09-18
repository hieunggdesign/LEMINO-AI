/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { DownloadIcon } from './icons.tsx';

interface ResultViewProps {
  imageSrcs: string[];
  onStartOver: () => void;
}

const ResultView: React.FC<ResultViewProps> = ({ imageSrcs, onStartOver }) => {

  const handleDownload = (imageSrc: string, index: number) => {
    const link = document.createElement('a');
    link.href = imageSrc;
    link.download = `generated-image-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-4xl">
       <div className={`w-full grid grid-cols-1 ${imageSrcs.length > 1 ? 'md:grid-cols-2' : ''} gap-4 mb-6`}>
        {imageSrcs.map((src, index) => (
          <div key={index} className="relative group aspect-square bg-black rounded-lg overflow-hidden shadow-2xl flex items-center justify-center">
            <img src={src} alt={`Generated result ${index + 1}`} className="max-w-full max-h-full object-contain" />
            <button
              onClick={() => handleDownload(src, index)}
              className="absolute top-2 right-2 bg-black/50 p-2 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-indigo-500"
              aria-label={`Download image ${index + 1}`}
            >
              <DownloadIcon className="w-6 h-6" />
            </button>
          </div>
        ))}
      </div>
      <div className="w-full max-w-xs">
        <button
          onClick={onStartOver}
          className="w-full bg-gray-700 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-600 transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-gray-500"
        >
          Start Over
        </button>
      </div>
    </div>
  );
};

export default ResultView;