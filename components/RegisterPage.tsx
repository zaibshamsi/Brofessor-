import React, { useState, useContext } from 'react';
import { AuthContext } from '../AppShell';
import { AuthContextType } from '../types';
import BotIcon from './icons/BotIcon';

interface RegisterPageProps {
    onSwitchToLogin: () => void;
}

const RegisterPage: React.FC<RegisterPageProps> = ({ onSwitchToLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { register } = useContext(AuthContext) as AuthContextType;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);

        if (password.length < 6) {
             setError("Password must be at least 6 characters long.");
             setIsLoading(false);
             return;
        }

        try {
            await register(email, password);
            setSuccess('Registration successful! Please check your inbox to confirm your email address.');
        } catch (err: any) {
            setError(err.message || 'Failed to register.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 p-4">
            <main className="flex-1 overflow-y-auto flex items-center justify-center">
                <div className="w-full max-w-md p-8 space-y-8 bg-gray-800 rounded-2xl shadow-lg">
                    <div className="text-center">
                        <BotIcon className="w-16 h-16 mx-auto text-indigo-500" />
                        <h2 className="mt-6 text-3xl font-extrabold text-white">
                            Create a new account
                        </h2>
                        <p className="mt-2 text-sm text-gray-400">
                            Or{' '}
                            <button onClick={onSwitchToLogin} className="font-medium text-indigo-400 hover:text-indigo-300">
                                sign in to an existing account
                            </button>
                        </p>
                    </div>
                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        {error && <p className="text-sm text-red-400 text-center bg-red-900/50 p-3 rounded-md">{error}</p>}
                        {success && <p className="text-sm text-green-400 text-center bg-green-900/50 p-3 rounded-md">{success}</p>}
                        <div className="rounded-md shadow-sm -space-y-px">
                            <div>
                                <input
                                    id="email-address"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-700 bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 text-base rounded-t-md"
                                    placeholder="Email address"
                                />
                            </div>
                            <div>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="new-password"
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-700 bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 text-base rounded-b-md"
                                    placeholder="Password (min. 6 characters)"
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={isLoading || !!success}
                                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed"
                            >
                            {isLoading ? 'Creating account...' : 'Create Account'}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default RegisterPage;