/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback } from 'react';
import { AppState } from './types';
import { generateCharacterPlacementImage, generateProductConceptImage } from './services/geminiService';
import LoadingOverlay from './components/LoadingOverlay';
import ImageUploader from './components/ImageUploader';
import ResultView from './components/ResultView';
import { UserIcon, PackageIcon, XCircleIcon } from './components/icons';

type Mode = 'character' | 'product';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.Idle);
  const [mode, setMode] = useState<Mode>('character');
  const [characterImage, setCharacterImage] = useState<string | null>(null);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [numberOfImages, setNumberOfImages] = useState(1);
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = (type: 'character' | 'product', dataUrl: string) => {
    if (type === 'character') {
      setCharacterImage(dataUrl);
    } else {
      setProductImage(dataUrl);
    }
  };

  const handleImageClear = (type: 'character' | 'product') => {
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
      const parseDataUrl = (dataUrl: string) => {
        const parts = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.*)$/);
        if (!parts || parts.length !== 3) {
          throw new Error("Invalid image data URL.");
        }
        return { mimeType: parts[1], base64: parts[2] };
      };

      const generationTasks = [];

      for (let i = 0; i < numberOfImages; i++) {
          if (mode === 'character') {
              const charImgParts = parseDataUrl(characterImage!);
              const prodImgParts = parseDataUrl(productImage!);
              generationTasks.push(generateCharacterPlacementImage(
                  { base64: charImgParts.base64, mimeType: charImgParts.mimeType },
                  { base64: prodImgParts.base64, mimeType: prodImgParts.mimeType },
                  prompt
              ));
          } else { // mode === 'product'
              const prodImgParts = parseDataUrl(productImage!);
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

    const modeButtonStyle = (selectedMode: Mode) => 
      `px-4 py-2 text-sm font-bold rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 focus-visible:ring-yellow-500 transition-colors duration-200 ${
        mode === selectedMode ? 'bg-yellow-400 text-black' : 'bg-gray-700 text-white hover:bg-gray-600'
      }`;
      
    const numImagesButtonStyle = (num: number) =>
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

export default App;
