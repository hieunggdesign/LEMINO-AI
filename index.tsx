/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// --- React and Gemini Imports ---
import React, { useState, useCallback, useRef } from 'react';
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
    userPrompt
) => {
  try {
    const prompt = `You are a professional digital artist specializing in photorealistic product placement. Your task is to seamlessly integrate a product into a scene with a character.

INSTRUCTIONS:
1.  Analyze the first image, which contains the CHARACTER. Pay attention to their posture, lighting, and environment.
2.  Analyze the second image, which contains the PRODUCT. Note its shape, size, and branding.
3.  Create a NEW, high-quality, photorealistic image where the CHARACTER from the first image is naturally interacting with, holding, or using the PRODUCT from the second image.
4.  The final image should look like a single, cohesive photograph. The lighting on the product must match the lighting on the character.
5.  Maintain the character's appearance and identity. Do not change their face or clothing unless necessary for the interaction.
6.  Maintain the product's appearance and branding.
7.  The background can be inspired by the character's image or a simple, neutral studio background if the original is too complex.
${userPrompt ? `\nADDITIONAL USER REQUEST: "${userPrompt}"` : ''}

OUTPUT:
- You MUST return only the final image.
- DO NOT return any text, JSON, or other data.`;
    
    const characterPart = base64ToGenerativePart(characterImage.base64, characterImage.mimeType);
    const productPart = base64ToGenerativePart(productImage.base64, productImage.mimeType);
    const textPart = { text: prompt };

    return await executeImageGeneration([characterPart, productPart, textPart]);
  } catch (error) {
    console.error("Error during character image generation:", error);
    throw new Error(`Failed to generate image. ${error instanceof Error ? error.message : ''}`);
  }
};

const generateProductConceptImage = async (
    productImage,
    userPrompt,
) => {
  try {
    const prompt = `You are a professional product photographer and digital artist. Your task is to place the product from the provided image into a new, beautifully composed scene.
    
INSTRUCTIONS:
1.  Analyze the provided image to understand the PRODUCT.
2.  Read the user's description of the desired scene.
3.  Create a NEW, high-quality, photorealistic image that places the product into the scene described by the user.
4.  The lighting, shadows, and reflections on the product MUST match the new environment perfectly.
5.  The final image should be a convincing and aesthetically pleasing product photograph.
6.  Do not change the product itself.

USER SCENE DESCRIPTION: "${userPrompt}"

OUTPUT:
- You MUST return only the final image.
- DO NOT return any text, JSON, or other data.`;
      
      const productPart = base64ToGenerativePart(productImage.base64, productImage.mimeType);
      const textPart = { text: prompt };
      
      return await executeImageGeneration([productPart, textPart]);
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
const ImageUploader = ({ onImageUpload, onClearImage, imageSrc, title, icon }) => {
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

// --- Inlined from components/ResultView.tsx ---
const ResultView = ({ imageSrcs, onStartOver }) => {
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

// --- Inlined from App.tsx ---
const App = () => {
  const [appState, setAppState] = useState(AppState.Idle);
  const [mode, setMode] = useState('character');
  const [characterImage, setCharacterImage] = useState(null);
  const [productImage, setProductImage] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [numberOfImages, setNumberOfImages] = useState(1);
  const [resultImages, setResultImages] = useState([]);
  const [error, setError] = useState(null);

  const handleImageUpload = (type, dataUrl) => {
    if (type === 'character') {
      setCharacterImage(dataUrl);
    } else {
      setProductImage(dataUrl);
    }
  };

  const handleImageClear = (type) => {
    if (type === 'character') {
      setCharacterImage(null);
    } else {
      setProductImage(null);
    }
  };

  const handleGenerate = useCallback(async () => {
    setError(null);
    // Validation
    if (mode === 'character' && (!characterImage || !productImage)) {
      setError("Please upload both a character and a product image.");
      return;
    }
    if (mode === 'product' && !productImage) {
      setError("Please upload a product image.");
      return;
    }
    if (mode === 'product' && !prompt.trim()) {
      setError("Please describe the scene for the product concept.");
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
              generationTasks.push(generateCharacterPlacementImage(
                  { base64: charImgParts.base64, mimeType: charImgParts.mimeType },
                  { base64: prodImgParts.base64, mimeType: prodImgParts.mimeType },
                  prompt
              ));
          } else { // mode === 'product'
              const prodImgParts = parseDataUrl(productImage);
              generationTasks.push(generateProductConceptImage(
                  { base64: prodImgParts.base64, mimeType: prodImgParts.mimeType },
                  prompt
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

      setResultImages(generatedImages);
      setAppState(AppState.Result);

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setAppState(AppState.Idle);
    }
  }, [mode, characterImage, productImage, prompt, numberOfImages]);

  const handleStartOver = () => {
    setAppState(AppState.Idle);
    setCharacterImage(null);
    setProductImage(null);
    setPrompt('');
    setNumberOfImages(1);
    setResultImages([]);
    setError(null);
  };

  const renderIdleContent = () => {
    const isGenerateDisabled = 
      (mode === 'character' && (!characterImage || !productImage)) ||
      (mode === 'product' && (!productImage || !prompt.trim()));

    const modeButtonStyle = (selectedMode) => 
      `px-4 py-2 text-sm font-bold rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 focus-visible:ring-yellow-500 transition-colors duration-200 ${
        mode === selectedMode ? 'bg-yellow-400 text-black' : 'bg-gray-700 text-white hover:bg-gray-600'
      }`;
      
    const numImagesButtonStyle = (num) =>
      `w-12 h-12 flex items-center justify-center font-bold rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-yellow-500 transition-colors duration-200 ${
        numberOfImages === num ? 'bg-yellow-400 text-black' : 'bg-gray-700 text-white hover:bg-gray-600'
      }`;

    return (
      <div className="flex flex-col items-center w-full max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2">NanoBanana Product Studio</h1>
        <p className="text-lg text-gray-400 mb-6">Create stunning product visuals with AI</p>

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
        
        <div className={`w-full grid ${mode === 'character' ? 'md:grid-cols-2' : 'md:grid-cols-1 justify-center'} gap-6 mb-6`}>
            {mode === 'character' && (
                <ImageUploader 
                    title="Character Image"
                    icon={<UserIcon className="w-full h-full" />}
                    imageSrc={characterImage}
                    onImageUpload={(data) => handleImageUpload('character', data)}
                    onClearImage={() => handleImageClear('character')}
                />
            )}
            <div className={mode === 'product' ? 'max-w-lg mx-auto w-full' : ''}>
              <ImageUploader 
                title="Product Image"
                icon={<PackageIcon className="w-full h-full" />}
                imageSrc={productImage}
                onImageUpload={(data) => handleImageUpload('product', data)}
                onClearImage={() => handleImageClear('product')}
              />
            </div>
        </div>

        <div className="w-full max-w-lg mb-6">
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-300 mb-2">
              {mode === 'character' ? 'Optional Instructions' : 'Scene Description'}
            </label>
            <textarea
              id="prompt"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                mode === 'character' 
                  ? "e.g., Make the character hold the product, place it on the table..."
                  : "e.g., A bottle of lotion on a marble countertop next to a lavender plant..."
              }
              className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg p-3 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition"
            />
        </div>

        <div className="w-full max-w-lg mb-8">
          <label className="block text-sm font-medium text-gray-300 mb-2">Number of Images</label>
          <div className="flex justify-center gap-4">
            {[1, 2, 3, 4].map(num => (
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
        return resultImages.length > 0 ? <ResultView imageSrcs={resultImages} onStartOver={handleStartOver} /> : null;
    }
  };

  return (
    <div className="min-h-dvh bg-black text-gray-100 flex flex-col items-center p-4 overflow-y-auto">
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