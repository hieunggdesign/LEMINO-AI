/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const imageModel = 'gemini-2.5-flash-image-preview';

export interface GeneratedImage {
  imageData: { data: string, mimeType: string };
}

const base64ToGenerativePart = (base64: string, mimeType: string) => {
    return {
      inlineData: {
        data: base64,
        mimeType,
      },
    };
};

const executeImageGeneration = async (parts: any[]): Promise<GeneratedImage> => {
    const response: GenerateContentResponse = await ai.models.generateContent({
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


export const generateCharacterPlacementImage = async (
    characterImage: { base64: string, mimeType: string },
    productImage: { base64: string, mimeType: string },
    userPrompt: string
): Promise<GeneratedImage | null> => {
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

export const generateProductConceptImage = async (
    productImage: { base64: string, mimeType: string },
    userPrompt: string,
): Promise<GeneratedImage | null> => {
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
