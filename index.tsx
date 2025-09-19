/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// --- React and Gemini Imports ---
import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Modality } from "@google/genai";

// --- Inlined from types.ts ---
const AppState = {
  Idle: 0,
  Loading: 1,
  Result: 2,
  Error: 3,
};
Object.freeze(AppState);


// --- Inlined from services/geminiService.ts ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const imageModel = 'gemini-2.5-flash-image-preview';

const base64ToGenerativePart = (base64, mimeType) => {
    return {
      inlineData: {
        data: base64,
        mimeType,
      },
    };
};

const getAspectRatioDescription = (ratio, width, height) => {
    if (ratio === 'custom' && width > 0 && height > 0) {
        return `a (${width}:${height})`;
    }
    switch (ratio) {
        case '1:1': return 'a square (1:1)';
        case '3:4': return 'a portrait (3:4)';
        case '4:3': return 'a landscape (4:3)';
        default: return `a (${ratio})`;
    }
};

const executeImageGeneration = async (parts) => {
    const response = await ai.models.generateContent({
        model: imageModel,
        contents: [{ role: "user", parts }],
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    const responseParts = response.candidates?.[0]?.content?.parts;
    if (!responseParts) {
        throw new Error("Invalid response from model. No parts found.");
    }

    const imagePart = responseParts.find(p => p.inlineData);
    if (!imagePart?.inlineData?.data) {
        console.error("No image part found in response from image generation model", response);
        const text = responseParts.find(p => p.text)?.text;
        throw new Error(`Model did not return an image. Response: ${text ?? "<no text>"}`);
    }
    return { imageData: { data: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType } };
};


const generateCharacterPlacementImage = async (
    characterImage,
    productImage,
    outfitImage, // can be null
    userPrompt,
    aspectRatio,
    customWidth,
    customHeight
) => {
  try {
    const characterPart = base64ToGenerativePart(characterImage.base64, characterImage.mimeType);
    const productPart = base64ToGenerativePart(productImage.base64, productImage.mimeType);
    // FIX: Explicitly type parts as any[] to allow both image and text parts.
    const parts: any[] = [characterPart, productPart];
    let prompt;

    if (outfitImage) {
        const outfitPart = base64ToGenerativePart(outfitImage.base64, outfitImage.mimeType);
        parts.push(outfitPart);
        prompt = `You are a professional digital artist. Your task is to dress a character in a specific outfit and have them interact with a product.

INSTRUCTIONS:
1.  Analyze the first image, which contains the CHARACTER. Pay attention to their posture, lighting, and environment.
2.  Analyze the second image, which contains the PRODUCT. Note its shape, size, and branding.
3.  Analyze the third image, which contains the OUTFIT.
4.  Create a NEW, high-quality, photorealistic image where the CHARACTER from the first image is wearing the OUTFIT from the third image, and is naturally interacting with, holding, or using the PRODUCT from the second image.
5.  The final image should look like a single, cohesive photograph. The lighting on the product and outfit must match the lighting on the character and the scene.
6.  Maintain the character's appearance and identity (face, etc.), but change their clothing to match the provided OUTFIT.
7.  Maintain the product's appearance and branding.
8.  The final image MUST have ${getAspectRatioDescription(aspectRatio, customWidth, customHeight)} aspect ratio.
9.  The background can be inspired by the character's image or a simple, neutral studio background if the original is too complex.
${userPrompt ? `\nADDITIONAL USER REQUEST: "${userPrompt}"` : ''}

OUTPUT:
- You MUST return only the final image.
- DO NOT return any text, JSON, or other data.`;
    } else {
        prompt = `You are a professional digital artist specializing in photorealistic product placement. Your task is to seamlessly integrate a product into a scene with a character.

INSTRUCTIONS:
1.  Analyze the first image, which contains the CHARACTER. Pay attention to their posture, lighting, and environment.
2.  Analyze the second image, which contains the PRODUCT. Note its shape, size, and branding.
3.  Create a NEW, high-quality, photorealistic image where the CHARACTER from the first image is naturally interacting with, holding, or using the PRODUCT from the second image.
4.  The final image should look like a single, cohesive photograph. The lighting on the product must match the lighting on the character.
5.  Maintain the character's appearance and identity. Do not change their face or clothing unless necessary for the interaction.
6.  Maintain the product's appearance and branding.
7.  The final image MUST have ${getAspectRatioDescription(aspectRatio, customWidth, customHeight)} aspect ratio.
8.  The background can be inspired by the character's image or a simple, neutral studio background if the original is too complex.
${userPrompt ? `\nADDITIONAL USER REQUEST: "${userPrompt}"` : ''}

OUTPUT:
- You MUST return only the final image.
- DO NOT return any text, JSON, or other data.`;
    }
    
    parts.push({ text: prompt });
    return await executeImageGeneration(parts);

  } catch (error) {
    console.error("Error during character image generation:", error);
    throw new Error(`Failed to generate image. ${error instanceof Error ? error.message : ''}`);
  }
};

const generateProductConceptImage = async (
    productImage,
    backgroundImage, // can be null
    userPrompt,
    aspectRatio,
    customWidth,
    customHeight
) => {
  try {
    const productPart = base64ToGenerativePart(productImage.base64, productImage.mimeType);
    const parts: any[] = [productPart];
    let prompt;

    if (backgroundImage) {
        const backgroundPart = base64ToGenerativePart(backgroundImage.base64, backgroundImage.mimeType);
        parts.push(backgroundPart);
        prompt = `You are a professional product photographer and digital artist. Your task is to place the product from the first image into the background provided in the second image.
    
INSTRUCTIONS:
1.  Analyze the first image to understand the PRODUCT.
2.  Analyze the second image which is the BACKGROUND scene.
3.  Create a NEW, high-quality, photorealistic image that seamlessly places the PRODUCT into the BACKGROUND.
4.  The lighting, shadows, and reflections on the product MUST match the new environment perfectly.
5.  The final image should be a convincing and aesthetically pleasing product photograph.
6.  Do not change the product itself or the background. Only integrate the product into the background.
7.  The final image MUST have ${getAspectRatioDescription(aspectRatio, customWidth, customHeight)} aspect ratio.
${userPrompt ? `\nADDITIONAL USER REQUEST: "${userPrompt}"` : ''}

OUTPUT:
- You MUST return only the final image.
- DO NOT return any text, JSON, or other data.`;
    } else {
        prompt = `You are a professional product photographer and digital artist. Your task is to place the product from the provided image into a new, beautifully composed scene.
    
INSTRUCTIONS:
1.  Analyze the provided image to understand the PRODUCT.
2.  Read the user's description of the desired scene.
3.  Create a NEW, high-quality, photorealistic image that places the product into the scene described by the user.
4.  The lighting, shadows, and reflections on the product MUST match the new environment perfectly.
5.  The final image should be a convincing and aesthetically pleasing product photograph.
6.  Do not change the product itself.
7.  The final image MUST have ${getAspectRatioDescription(aspectRatio, customWidth, customHeight)} aspect ratio.

USER SCENE DESCRIPTION: "${userPrompt}"

OUTPUT:
- You MUST return only the final image.
- DO NOT return any text, JSON, or other data.`;
    }
      
    parts.push({ text: prompt });
    return await executeImageGeneration(parts);

  } catch (error) {
    console.error("Error during product concept generation:", error);
    throw new Error(`Failed to generate product concept. ${error instanceof Error ? error.message : ''}`);
  }
};

// --- Inlined from components/icons.tsx ---

const XCircleIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="12" r="10"></circle>
        <path d="m15 9-6 6"></path>
        <path d="m9 9 6 6"></path>
    </svg>
);

const DownloadIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
);

const UploadIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="17 8 12 3 7 8"></polyline>
    <line x1="12" y1="3" x2="12" y2="15"></line>
  </svg>
);

const UserIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
);
  
const PackageIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
      <line x1="12" y1="22.08" x2="12" y2="12"></line>
    </svg>
);

const ShirtIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"></path>
    </svg>
);

const ImageIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect>
        <circle cx="9" cy="9" r="2"></circle>
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
    </svg>
);

const ZoomInIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
);

const ArrowLeftIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <line x1="19" y1="12" x2="5" y2="12"></line>
        <polyline points="12 19 5 12 12 5"></polyline>
    </svg>
);

const ArrowRightIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <line x1="5" y1="12" x2="19" y2="12"></line>
        <polyline points="12 5 19 12 12 19"></polyline>
    </svg>
);

const RotateCcwIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
        <path d="M3 3v5h5"></path>
    </svg>
);

// --- Inlined from components/BananaLoader.tsx ---
const BananaLoader = ({ className }) => {
  const loaderSrc = 'https://www.gstatic.com/aistudio/starter-apps/bananimate/bananaloader2.gif';
  return <img src={loaderSrc} className={className} alt="Loading animation..." />;
};

// --- Inlined from components/LoadingOverlay.tsx ---
const LoadingOverlay = () => {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      <BananaLoader className="w-72 h-72" />
    </div>
  );
};

// --- Inlined from components/ImageUploader.tsx ---
const ImageUploader = ({ onImageUpload, onClearImage, imageSrc, title, icon, className = '' }) => {
  const fileInputRef = useRef(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
            onImageUpload(reader.result.toString());
        }
      };
      reader.onerror = () => {
        console.error("Failed to read file");
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className={`relative w-full aspect-square bg-gray-900 rounded-lg overflow-hidden shadow-lg flex items-center justify-center ${className}`}>
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

// --- Added ZoomModal component ---
const ZoomModal = ({ images, startIndex, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(startIndex);

    const handleNext = useCallback(() => {
        setCurrentIndex((prev) => (prev + 1) % images.length);
    }, [images.length]);
    
    const handlePrev = useCallback(() => {
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    }, [images.length]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight') {
                handleNext();
            } else if (e.key === 'ArrowLeft') {
                handlePrev();
            } else if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleNext, handlePrev, onClose]);

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
            <div className="relative w-full h-full flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
                <img src={images[currentIndex]} alt={`Zoomed result ${currentIndex + 1}`} className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" />

                <button onClick={onClose} className="absolute top-4 right-4 bg-black/50 p-2 rounded-full text-white hover:bg-black/75 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Close">
                    <XCircleIcon className="w-8 h-8" />
                </button>

                {images.length > 1 && (
                    <>
                        <button onClick={handlePrev} className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 p-2 rounded-full text-white hover:bg-black/75 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Previous image">
                            <ArrowLeftIcon className="w-8 h-8" />
                        </button>
                        <button onClick={handleNext} className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 p-2 rounded-full text-white hover:bg-black/75 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Next image">
                            <ArrowRightIcon className="w-8 h-8" />
                        </button>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 px-3 py-1 rounded-full text-white text-sm">
                            {currentIndex + 1} / {images.length}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};


// --- Inlined from components/ResultView.tsx ---
const ResultView = ({ imageSrcs, onStartOver, onContinue, onRegenerate, onZoom }) => {
  const handleDownload = (imageSrc, index) => {
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
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                <button
                    onClick={() => onZoom(imageSrcs, index)}
                    className="p-3 rounded-full text-white bg-black/50 hover:bg-black/75 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-indigo-500"
                    aria-label={`Zoom in on image ${index + 1}`}
                >
                    <ZoomInIcon className="w-7 h-7" />
                </button>
                <button
                    onClick={() => handleDownload(src, index)}
                    className="p-3 rounded-full text-white bg-black/50 hover:bg-black/75 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-indigo-500"
                    aria-label={`Download image ${index + 1}`}
                >
                    <DownloadIcon className="w-7 h-7" />
                </button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex w-full max-w-lg flex-col sm:flex-row gap-4">
        <button
          onClick={onStartOver}
          className="w-full bg-gray-700 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-600 transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-gray-500"
        >
          Start Over
        </button>
        <button
          onClick={onRegenerate}
          className="w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-500 transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-indigo-500"
        >
          Regenerate
        </button>
        <button
          onClick={onContinue}
          className="w-full bg-yellow-400 text-black font-bold py-3 px-6 rounded-lg hover:bg-yellow-300 transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-yellow-500"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

// --- Inlined from App.tsx ---
const App = () => {
  const [appState, setAppState] = useState(AppState.Idle);
  const [mode, setMode] = useState('character');
  const [characterImage, setCharacterImage] = useState(null);
  const [productImage, setProductImage] = useState(null);
  const [outfitImage, setOutfitImage] = useState(null);
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [characterPrompt, setCharacterPrompt] = useState('');
  const [productPrompt, setProductPrompt] = useState('');
  const [numberOfImages, setNumberOfImages] = useState(1);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [customWidth, setCustomWidth] = useState(1024);
  const [customHeight, setCustomHeight] = useState(1024);
  const [resultImages, setResultImages] = useState([]);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [zoomedImageState, setZoomedImageState] = useState({ isOpen: false, images: [], startIndex: 0 });

  const handleImageUpload = (type, dataUrl) => {
    if (type === 'character') {
      setCharacterImage(dataUrl);
    } else if (type === 'product') {
      setProductImage(dataUrl);
    } else if (type === 'outfit') {
        setOutfitImage(dataUrl);
    } else if (type === 'background') {
        setBackgroundImage(dataUrl);
    }
  };

  const handleImageClear = (type) => {
    if (type === 'character') {
      setCharacterImage(null);
    } else if (type === 'product') {
      setProductImage(null);
    } else if (type === 'outfit') {
        setOutfitImage(null);
    } else if (type === 'background') {
        setBackgroundImage(null);
    }
  };

  const handleGenerate = useCallback(async () => {
    setError(null);
    const currentPrompt = mode === 'character' ? characterPrompt : productPrompt;

    // Validation
    if (mode === 'character' && (!characterImage || !productImage)) {
      setError("Please upload both a character and a product image.");
      return;
    }
    if (mode === 'product' && !productImage) {
      setError("Please upload a product image.");
      return;
    }
    if (mode === 'product' && !currentPrompt.trim() && !backgroundImage) {
      setError("Please describe the scene or provide a background image for the product concept.");
      return;
    }

    setAppState(AppState.Loading);

    try {
      const parseDataUrl = (dataUrl) => {
        const parts = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.*)$/);
        if (!parts || parts.length !== 3) {
          throw new Error("Invalid image data URL.");
        }
        return { mimeType: parts[1], base64: parts[2] };
      };

      const generationTasks = [];

      for (let i = 0; i < numberOfImages; i++) {
          if (mode === 'character') {
              const charImgParts = parseDataUrl(characterImage);
              const prodImgParts = parseDataUrl(productImage);
              const outfitImgParts = outfitImage ? parseDataUrl(outfitImage) : null;
              generationTasks.push(generateCharacterPlacementImage(
                  { base64: charImgParts.base64, mimeType: charImgParts.mimeType },
                  { base64: prodImgParts.base64, mimeType: prodImgParts.mimeType },
                  outfitImgParts ? { base64: outfitImgParts.base64, mimeType: outfitImgParts.mimeType } : null,
                  currentPrompt,
                  aspectRatio,
                  customWidth,
                  customHeight
              ));
          } else { // mode === 'product'
              const prodImgParts = parseDataUrl(productImage);
              const backgroundImgParts = backgroundImage ? parseDataUrl(backgroundImage) : null;
              generationTasks.push(generateProductConceptImage(
                  { base64: prodImgParts.base64, mimeType: prodImgParts.mimeType },
                  backgroundImgParts ? { base64: backgroundImgParts.base64, mimeType: backgroundImgParts.mimeType } : null,
                  currentPrompt,
                  aspectRatio,
                  customWidth,
                  customHeight
              ));
          }
      }

      const results = await Promise.all(generationTasks);
      
      const generatedImages = results.map(result => {
          if (!result || !result.imageData.data) {
              throw new Error("One or more image generations failed. The model did not return a valid image.");
          }
          return `data:${result.imageData.mimeType};base64,${result.imageData.data}`;
      });
      
      const newHistoryItem = {
        id: Date.now(),
        images: generatedImages,
        prompt: currentPrompt,
        mode: mode,
        characterImage,
        productImage,
        outfitImage,
        backgroundImage,
      };
      setHistory(prev => [newHistoryItem, ...prev].slice(0, 10));

      setResultImages(generatedImages);
      setAppState(AppState.Result);

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setAppState(AppState.Idle);
    }
  }, [mode, characterImage, productImage, outfitImage, backgroundImage, characterPrompt, productPrompt, numberOfImages, aspectRatio, customWidth, customHeight]);

  const handleStartOver = () => {
    setAppState(AppState.Idle);
    setCharacterImage(null);
    setProductImage(null);
    setOutfitImage(null);
    setBackgroundImage(null);
    setCharacterPrompt('');
    setProductPrompt('');
    setNumberOfImages(1);
    setAspectRatio('1:1');
    setResultImages([]);
    setError(null);
  };

  const handleContinue = () => {
    setAppState(AppState.Idle);
    // Keep characterImage, productImage, outfitImage, backgroundImage and prompts
    setNumberOfImages(1);
    setResultImages([]);
    setError(null);
  };
  
  const handleOpenZoomModal = (images, startIndex = 0) => {
    setZoomedImageState({ isOpen: true, images: images, startIndex: startIndex });
  };

  const handleCloseZoomModal = () => {
      setZoomedImageState({ isOpen: false, images: [], startIndex: 0 });
  };
  
  const handleReuseHistoryItem = (item) => {
    setMode(item.mode);
    setCharacterImage(item.characterImage);
    setProductImage(item.productImage);
    setOutfitImage(item.outfitImage);
    setBackgroundImage(item.backgroundImage);
    if (item.mode === 'character') {
        setCharacterPrompt(item.prompt || '');
        setProductPrompt('');
    } else {
        setProductPrompt(item.prompt || '');
        setCharacterPrompt('');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  const renderIdleContent = () => {
    const currentPrompt = mode === 'character' ? characterPrompt : productPrompt;
    const isGenerateDisabled = 
      (mode === 'character' && (!characterImage || !productImage)) ||
      (mode === 'product' && (!productImage || (!currentPrompt.trim() && !backgroundImage) ));

    const modeButtonStyle = (selectedMode) => 
      `px-4 py-2 text-sm font-bold rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 focus-visible:ring-yellow-500 transition-colors duration-200 ${
        mode === selectedMode ? 'bg-yellow-400 text-black' : 'bg-gray-700 text-white hover:bg-gray-600'
      }`;
      
    const numImagesButtonStyle = (num) =>
      `w-12 h-12 flex items-center justify-center font-bold rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-yellow-500 transition-colors duration-200 ${
        numberOfImages === num ? 'bg-yellow-400 text-black' : 'bg-gray-700 text-white hover:bg-gray-600'
      }`;
    
    const aspectRatioButtonStyle = (value) =>
      `px-4 py-2 text-sm font-bold rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-yellow-500 transition-colors duration-200 ${
        aspectRatio === value ? 'bg-yellow-400 text-black' : 'bg-gray-700 text-white hover:bg-gray-600'
      }`;

    return (
      <div className="flex flex-col items-center w-full max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2">LEMINO AI Product Studio</h1>
        <p className="text-lg text-gray-400 mb-6">Create stunning product visuals with AI</p>

        <div className="text-center text-sm text-gray-500 border border-gray-700 rounded-lg py-2 px-4 mb-6 max-w-lg mx-auto">
          Image generation quota and billing are managed in your Google AI Studio account.
        </div>

        <div className="p-1 bg-gray-900 rounded-lg flex gap-1 mb-6">
          <button onClick={() => setMode('character')} className={modeButtonStyle('character')}>Character Placement</button>
          <button onClick={() => setMode('product')} className={modeButtonStyle('product')}>Product Concepts</button>
        </div>

        {error && (
          <div className="w-full bg-red-900/50 border border-red-700 text-red-100 px-4 py-3 rounded-lg relative mb-6 flex items-center justify-between animate-shake" role="alert">
            <p>{error}</p>
            <button onClick={() => setError(null)} className="p-1 -mr-2 flex-shrink-0" aria-label="Close error message">
              <XCircleIcon className="w-6 h-6" />
            </button>
          </div>
        )}
        
        <div className={`w-full grid grid-cols-1 ${mode === 'character' ? 'md:grid-cols-3' : 'md:grid-cols-2 max-w-lg mx-auto'} gap-6 mb-6`}>
            {mode === 'character' && (
                <ImageUploader 
                    title="Character"
                    icon={<UserIcon className="w-full h-full" />}
                    imageSrc={characterImage}
                    onImageUpload={(data) => handleImageUpload('character', data)}
                    onClearImage={() => handleImageClear('character')}
                />
            )}
            <ImageUploader 
              title="Product"
              icon={<PackageIcon className="w-full h-full" />}
              imageSrc={productImage}
              onImageUpload={(data) => handleImageUpload('product', data)}
              onClearImage={() => handleImageClear('product')}
            />
            {mode === 'character' && (
                <ImageUploader 
                    title="Outfit"
                    icon={<ShirtIcon className="w-full h-full" />}
                    imageSrc={outfitImage}
                    onImageUpload={(data) => handleImageUpload('outfit', data)}
                    onClearImage={() => handleImageClear('outfit')}
                />
            )}
            {mode === 'product' && (
                <ImageUploader 
                    title="Background"
                    icon={<ImageIcon className="w-full h-full" />}
                    imageSrc={backgroundImage}
                    onImageUpload={(data) => handleImageUpload('background', data)}
                    onClearImage={() => handleImageClear('background')}
                />
            )}
        </div>

        <div className={`w-full ${mode === 'character' ? '' : 'max-w-lg'} mb-6`}>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-300 mb-2">
              {mode === 'character' ? 'Optional Instructions' : 'Scene Description / Instructions'}
            </label>
            <div className="relative">
                <textarea
                  id="prompt"
                  rows={8}
                  value={mode === 'character' ? characterPrompt : productPrompt}
                  onChange={(e) => mode === 'character' ? setCharacterPrompt(e.target.value) : setProductPrompt(e.target.value)}
                  placeholder={
                    mode === 'character' 
                      ? "e.g., Make the character hold the product, place it on the table..."
                      : "e.g., A bottle of lotion on a marble countertop next to a lavender plant..."
                  }
                  className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg p-3 pr-10 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition"
                />
                {currentPrompt && (
                    <button
                      onClick={() => mode === 'character' ? setCharacterPrompt('') : setProductPrompt('')}
                      className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors"
                      aria-label="Clear prompt"
                    >
                        <XCircleIcon className="w-5 h-5" />
                    </button>
                )}
            </div>
        </div>
        
        <div className={`w-full ${mode === 'character' ? '' : 'max-w-lg'} mb-6`}>
          <label className="block text-sm font-medium text-gray-300 mb-2">Size</label>
          <div className="flex justify-center gap-2">
            <button onClick={() => setAspectRatio('1:1')} className={aspectRatioButtonStyle('1:1')}>Square</button>
            <button onClick={() => setAspectRatio('3:4')} className={aspectRatioButtonStyle('3:4')}>Portrait</button>
            <button onClick={() => setAspectRatio('4:3')} className={aspectRatioButtonStyle('4:3')}>Landscape</button>
            <button onClick={() => setAspectRatio('custom')} className={aspectRatioButtonStyle('custom')}>Custom</button>
          </div>
           {aspectRatio === 'custom' && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm">
                  <div>
                      <label htmlFor="customWidth" className="sr-only">Width</label>
                      <input id="customWidth" type="number" value={customWidth} onChange={(e) => setCustomWidth(Math.max(0, parseInt(e.target.value, 10) || 0))} className="w-24 bg-gray-800 text-white border border-gray-600 rounded-md p-2 text-center focus:ring-yellow-500 focus:border-yellow-500" placeholder="Width"/>
                  </div>
                  <span className="text-gray-400">x</span>
                  <div>
                      <label htmlFor="customHeight" className="sr-only">Height</label>
                      <input id="customHeight" type="number" value={customHeight} onChange={(e) => setCustomHeight(Math.max(0, parseInt(e.target.value, 10) || 0))} className="w-24 bg-gray-800 text-white border border-gray-600 rounded-md p-2 text-center focus:ring-yellow-500 focus:border-yellow-500" placeholder="Height"/>
                  </div>
              </div>
          )}
        </div>

        <div className={`w-full ${mode === 'character' ? '' : 'max-w-lg'} mb-8`}>
          <label className="block text-sm font-medium text-gray-300 mb-2">Number of Images</label>
          <div className="flex justify-center gap-4">
            {[1, 2, 3, 4, 5, 6].map(num => (
              <button key={num} onClick={() => setNumberOfImages(num)} className={numImagesButtonStyle(num)}>{num}</button>
            ))}
          </div>
        </div>
        
        <button
          onClick={handleGenerate}
          disabled={isGenerateDisabled}
          className="w-full max-w-xs bg-yellow-400 text-black font-bold py-4 px-8 rounded-lg hover:bg-yellow-300 transition-colors duration-300 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-yellow-500 text-xl"
        >
          Generate
        </button>

        {history.length > 0 && (
            <div className="w-full max-w-4xl mt-12">
                <h2 className="text-2xl font-bold text-center text-white mb-4">History</h2>
                <div className="space-y-6">
                    {history.map(item => (
                        <div key={item.id} className="bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                            <div className="flex items-start justify-between mb-3">
                                <p className="text-gray-400 text-sm flex-1 mr-4 break-words">
                                    <span className="font-semibold text-gray-300">Prompt: </span>
                                    {item.prompt || <span className="italic">No prompt provided</span>}
                                </p>
                                <button
                                    onClick={() => handleReuseHistoryItem(item)}
                                    className="flex items-center gap-2 bg-indigo-600 text-white font-bold text-sm py-1.5 px-3 rounded-md hover:bg-indigo-500 transition-colors duration-200 flex-shrink-0"
                                    aria-label="Reuse this prompt and images"
                                >
                                    <RotateCcwIcon className="w-4 h-4" />
                                    Reuse
                                </button>
                            </div>
                            <div className="flex overflow-x-auto space-x-3 pb-2 -mb-2">
                                {item.images.map((imgSrc, index) => (
                                    <img
                                        key={index}
                                        src={imgSrc}
                                        alt={`History image ${index + 1}`}
                                        className="w-24 h-24 object-cover rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={() => handleOpenZoomModal(item.images, index)}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

      </div>
    );
  }

  const renderContent = () => {
    switch (appState) {
      case AppState.Idle:
      case AppState.Error: // Error state is merged into Idle to show the error message there
        return renderIdleContent();
      case AppState.Loading:
        return <LoadingOverlay />;
      case AppState.Result:
        return resultImages.length > 0 ? <ResultView imageSrcs={resultImages} onStartOver={handleStartOver} onContinue={handleContinue} onRegenerate={handleGenerate} onZoom={handleOpenZoomModal} /> : null;
    }
  };

  return (
    <div className="min-h-dvh bg-black text-gray-100 flex flex-col items-center p-4 overflow-y-auto">
      {zoomedImageState.isOpen && (
        <ZoomModal
            images={zoomedImageState.images}
            startIndex={zoomedImageState.startIndex}
            onClose={handleCloseZoomModal}
        />
      )}
      <div className="w-full grow flex items-center justify-center">
        {renderContent()}
      </div>
      <footer className="w-full shrink-0 p-4 text-center text-gray-500 text-xs">
        Built with Gemini 2.5 Flash Image Preview
      </footer>
    </div>
  );
};

// --- Final render logic ---
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
