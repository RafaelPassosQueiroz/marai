import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../services/api';
import type { Character, Config, Conversation, User } from '../models/types';

export function useAppViewModel() {
    const [user, setUser] = useState<User | null>(null);
    const [config, setConfig] = useState<Config | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [characters, setCharacters] = useState<Character[]>([]);
    const [conversation, setConversation] = useState<Conversation | null>(null);
    const [page, setPage] = useState<'home' | 'editor' | 'conversation'>('home');
    const [editing, setEditing] = useState<Character | null>(null);

    const refresh = useCallback(async () => {
        const [history, friends] = await Promise.all([api.conversations(), api.characters()]);
        setConversations(history);
        setCharacters(friends);
    }, []);

    useEffect(() => {
        let mounted = true;
        Promise.all([
            api.config(),
            api.me().catch((error) => {
                if (error instanceof ApiError && error.status === 401) return null;
                throw error;
            }),
        ])
            .then(([config, account]) => {
                if (mounted) {
                    setConfig(config);
                    setUser(account);
                }
            })
            .catch((error) => mounted && setError(error.message))
            .finally(() => mounted && setLoading(false));
        const unauthorized = () => {
            setUser(null);
            setConversation(null);
            setPage('home');
        };
        window.addEventListener('marai:unauthorized', unauthorized);
        return () => {
            mounted = false;
            window.removeEventListener('marai:unauthorized', unauthorized);
        };
    }, []);

    useEffect(() => {
        if (user) refresh().catch((error) => setError(error.message));
    }, [user, refresh]);

    async function openConversation(id: string) {
        setError('');
        setLoading(true);
        try {
            setConversation(await api.conversation(id));
            setPage('conversation');
        } catch (error) {
            setError((error as Error).message);
        } finally {
            setLoading(false);
        }
    }

    function updateConversation(value: Conversation) {
        setConversation(value);
        setConversations((list) => [value, ...list.filter((c) => c.id !== value.id)]);
    }

    function editCharacter(value?: Character) {
        setEditing(value ? structuredClone(value) : null);
        setPage('editor');
    }

    async function removeConversation(id: string) {
        await api.remove(id);
        setConversations((list) => list.filter((c) => c.id !== id));
        if (conversation?.id === id) {
            setConversation(null);
            setPage('home');
        }
    }

    async function renameConversation(id: string, title: string) {
        const updated = await api.rename(id, title);
        setConversations((list) => list.map((c) => (c.id === id ? updated : c)));
        if (conversation?.id === id) setConversation(updated);
    }

    async function logout() {
        try {
            await api.logout();
            setUser(null);
            setConversation(null);
            setConversations([]);
            setCharacters([]);
            setPage('home');
        } catch (error) {
            setError((error as Error).message);
        }
    }

    return {
        user,
        setUser,
        config,
        loading,
        error,
        setError,
        conversations,
        characters,
        conversation,
        page,
        setPage,
        editing,
        editCharacter,
        refresh,
        openConversation,
        updateConversation,
        removeConversation,
        renameConversation,
        logout,
    };
}
