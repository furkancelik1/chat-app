'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import { useChatStore } from '../../store/useChatStore';
import { useSocket } from '../../context/SocketContext';
import Link from 'next/link';

export default function RegisterPage() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { setUser } = useChatStore();
    const { connectSocket } = useSocket();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { data } = await api.post('/auth/register', {
                username,
                email,
                password,
            });

            setUser(data);
            connectSocket(data.token);
            router.push('/');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-[#0b141a] px-4 py-8">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1f2c34] p-6 sm:p-8 shadow-lg">
                <div className="text-center mb-6">
                    <div className="text-4xl mb-3">💬</div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Create Account</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Join the conversation</p>
                </div>
                {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-lg text-center">
                        {error}
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-gray-700 dark:text-gray-300 text-sm font-semibold mb-1.5">Username</label>
                        <input
                            type="text"
                            className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4a52] rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-[#2a3942] text-gray-800 dark:text-gray-100 text-base transition-colors"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            autoComplete="username"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700 dark:text-gray-300 text-sm font-semibold mb-1.5">Email</label>
                        <input
                            type="email"
                            className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4a52] rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-[#2a3942] text-gray-800 dark:text-gray-100 text-base transition-colors"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700 dark:text-gray-300 text-sm font-semibold mb-1.5">Password</label>
                        <input
                            type="password"
                            className="w-full px-4 py-3 border border-gray-200 dark:border-[#3d4a52] rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-[#2a3942] text-gray-800 dark:text-gray-100 text-base transition-colors"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="new-password"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold py-3 px-4 rounded-xl transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed touch-manipulation text-base mt-2"
                    >
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>
                </form>
                <p className="mt-5 text-center text-gray-600 dark:text-gray-400 text-sm">
                    Already have an account?{' '}
                    <Link href="/login" className="text-green-500 hover:underline font-semibold">
                        Sign In
                    </Link>
                </p>
            </div>
        </div>
    );
}
