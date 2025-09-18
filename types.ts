/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export enum AppState {
  Idle,
  Loading,
  Result,
  Error,
}

// Fix: Add definition for the Frame interface.
export interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Fix: Add definition for the AnimationAssets interface.
export interface AnimationAssets {
  imageData: {
    data: string;
    mimeType: string;
  };
  frameDuration?: number;
}
