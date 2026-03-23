/* eslint-disable @typescript-eslint/no-explicit-any */

declare module "@strudel/web" {
  export function initStrudel(opts?: {
    prebake?: () => Promise<unknown>;
  }): Promise<unknown>;
  export function hush(): void;
  export function evaluate(code: string, autoplay?: boolean): Promise<any>;
  export function s(miniNotation: string): any;
  export function stack(...patterns: any[]): any;
  export function note(miniNotation: string): any;
  export function getAudioContext(): AudioContext;
  export function aliasBank(url: string): Promise<void>;
  export function samples(
    source: string | Record<string, any>,
    baseUrl?: string,
    options?: { prebake?: boolean; tag?: string },
  ): Promise<void>;
}

declare module "@strudel/webaudio" {
  export function webaudioOutput(hap: unknown): void;
  export function getAudioContext(): AudioContext;
  export function initAudioOnFirstClick(): void;
  export function registerSynthSounds(): Promise<void>;
  export function aliasBank(url: string): Promise<void>;
  export function registerZZFXSounds(): Promise<void>;
  export function samples(
    source: string | { [key: string]: string[] },
    baseUrl?: string,
    options?: { prebake?: boolean; tag?: string },
  ): Promise<void>;
}

declare module "@strudel/core" {
  export function evalScope(...modules: Promise<unknown>[]): Promise<void>;
}

declare module "@strudel/transpiler" {
  export function transpiler(code: string): string;
}

declare module "@strudel/soundfonts" {
  export function registerSoundfonts(): Promise<void>;
}

declare module "@strudel/draw" {
  export function setTheme(settings: Record<string, string>): void;
  export function getDrawContext(): CanvasRenderingContext2D;
}

declare module "@strudel/mini" {}
declare module "@strudel/tonal" {}

declare module "superdough" {
  export const soundMap: { get(): Record<string, unknown> };
}
