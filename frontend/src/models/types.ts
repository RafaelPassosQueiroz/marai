export type Language = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ja';
export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type Scene =
    | 'park'
    | 'therapy'
    | 'candy'
    | 'paris'
    | 'theme'
    | 'kyoto'
    | 'stadium'
    | 'oktoberfest'
    | 'london'
    | 'rio'
    | 'venice';
export interface Appearance {
    presentation: 'masculine' | 'feminine';
    skin: string;
    face: 'oval' | 'round' | 'angular';
    eyes: 'almond' | 'round' | 'relaxed';
    eye_color: string;
    brows: 'soft' | 'bold' | 'arched';
    nose: 'soft' | 'straight' | 'round';
    mouth: 'smile' | 'gentle' | 'wide';
    hair:
        | 'swept'
        | 'curly'
        | 'long'
        | 'bob'
        | 'short'
        | 'braids'
        | 'pixie'
        | 'waves'
        | 'ponytail'
        | 'bun'
        | 'afro'
        | 'coils'
        | 'fade'
        | 'buzz'
        | 'locs'
        | 'bald';
    hair_color: string;
    outfit: 'jacket' | 'hoodie' | 'shirt' | 'sweater';
    clothing_color: string;
    glasses: 'none' | 'round' | 'square';
    hat: 'none' | 'cap' | 'beanie';
    earrings: boolean;
    necklace: boolean;
    freckles: boolean;
    beard: boolean;
}
export interface Persona {
    description_language?: Language;
    traits: string[];
    profession: string;
    age: number | null;
    origin: string;
    interests: string[];
    style: 'balanced' | 'talkative' | 'listener';
    biography: string;
    preferences: Record<string, string>;
}
export interface Character {
    id?: string;
    name: string;
    appearance: Appearance;
    persona: Persona;
    voice: 'male' | 'female';
}
export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    revision: number;
    created_at: string;
    blocked?: boolean;
}
export interface Conversation {
    id: string;
    title: string;
    character_id: string;
    snapshot: Character;
    language: Language;
    level: Level;
    scene: Scene;
    messages?: Message[];
    version: number;
    awaiting_user?: boolean;
    created_at: string;
    updated_at: string;
}
export interface User {
    id: string;
    name: string;
    email: string;
}
export interface Config {
    google_enabled: boolean;
    max_audio_seconds: number;
    max_audio_bytes: number;
    ai_configured: boolean;
}
export interface Speech {
    audio: string;
    mime: string;
    timings: { start: number; end: number; text: string }[];
    provider: string;
    voice: string;
}
export type ConversationState =
    | 'idle'
    | 'permission'
    | 'recording'
    | 'recording-paused'
    | 'recording-stopping'
    | 'recording-ready'
    | 'uploading'
    | 'thinking'
    | 'voicing'
    | 'playing'
    | 'paused'
    | 'error';
