import type {
    Character,
    Config,
    Conversation,
    Language,
    Level,
    Scene,
    Speech,
    User,
} from '../models/types';
import type { TranslationLanguage, TranslationResult } from '../models/translation';

export class ApiError extends Error {
    constructor(
        message: string,
        public status: number,
    ) {
        super(message);
    }
}

async function request<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
    const isForm = data instanceof FormData;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 240_000);
    try {
        const response = await fetch(`/api${path}`, {
            method,
            credentials: 'include',
            signal: controller.signal,
            headers: data && !isForm ? { 'Content-Type': 'application/json' } : undefined,
            body: data ? (isForm ? data : JSON.stringify(data)) : undefined,
        });
        const payload = await response.json();
        if (!response.ok) {
            const detail =
                typeof payload.detail === 'string'
                    ? payload.detail
                    : 'Confira os campos e tente novamente.';
            if (response.status === 401 && !path.startsWith('/auth/'))
                window.dispatchEvent(new Event('marai:unauthorized'));
            throw new ApiError(detail, response.status);
        }
        return payload as T;
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new Error(
            'Não foi possível conectar. Confira se o Marai está em execução e tente novamente.',
        );
    } finally {
        clearTimeout(timer);
    }
}

export const api = {
    translate: (text: string, source: TranslationLanguage, target: TranslationLanguage) =>
        request<TranslationResult>('/translate', 'POST', { text, source, target }),
    config: () => request<Config>('/config'),
    me: () => request<User>('/auth/me'),
    login: (email: string, password: string) =>
        request<User>('/auth/login', 'POST', { email, password }),
    register: (name: string, email: string, password: string) =>
        request<User>('/auth/register', 'POST', { name, email, password }),
    logout: () => request('/auth/logout', 'POST'),
    characters: () => request<Character[]>('/characters'),
    saveCharacter: (character: Character) =>
        request<Character>(
            character.id ? `/characters/${character.id}` : '/characters',
            character.id ? 'PUT' : 'POST',
            character,
        ),
    surprise: (language: Language) =>
        request<Pick<Character, 'name' | 'persona'>>('/characters/surprise', 'POST', { language }),
    conversations: () => request<Conversation[]>('/conversations'),
    conversation: (id: string) => request<Conversation>(`/conversations/${id}`),
    createConversation: (character_id: string, language: Language, level: Level, scene: Scene) =>
        request<Conversation>('/conversations', 'POST', { character_id, language, level, scene }),
    rename: (id: string, title: string) =>
        request<Conversation>(`/conversations/${id}`, 'PATCH', { title }),
    remove: (id: string) => request(`/conversations/${id}`, 'DELETE'),
    turn: (
        id: string,
        action: 'message' | 'start' | 'regenerate' | 'topic',
        text: string,
        expected_version: number,
        request_id: string,
    ) =>
        request<Conversation>(`/conversations/${id}/turn`, 'POST', {
            action,
            text,
            expected_version,
            request_id,
        }),
    transcribe: (id: string, audio: Blob) => {
        const form = new FormData();
        form.append('audio', audio, 'recording.webm');
        return request<{ text: string }>(`/conversations/${id}/transcribe`, 'POST', form);
    },
    speech: (conversation: string, message: string) =>
        request<Speech>(`/conversations/${conversation}/messages/${message}/speech`, 'POST'),
};
