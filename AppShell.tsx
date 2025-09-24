import React, { createContext, useState, useEffect, useCallback } from 'react';
import App from './App';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import { authService } from './services/authService';
import { knowledgeBaseService } from './services/knowledgeBaseService';
import { User, AuthContextType, KnowledgeFile, KnowledgeBaseContextType } from './types';
import { supabase } from './services/supabaseClient';

export const AuthContext = createContext<AuthContextType | null>(null);
export const KnowledgeBaseContext = createContext<KnowledgeBaseContextType | null>(null);

const AppShell: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [currentView, setCurrentView] = useState<'login' | 'register'>('login');

    const [knowledgeContext, setKnowledgeContext] = useState('');
    const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFile[]>([]);
    const [isKbLoading, setIsKbLoading] = useState(true);

    // Effect for handling auth state changes
    useEffect(() => {
        let ignore = false;
        
        const checkUser = async () => {
            try {
                const user = await authService.getUser();
                if (!ignore) {
                    setCurrentUser(user);
                }
            } catch (e) {
                console.error("Error checking user session:", e);
                if (!ignore) {
                    setCurrentUser(null);
                }
            } finally {
                if (!ignore) {
                    setIsAuthLoading(false);
                }
            }
        };
        
        // Check user on initial component mount
        checkUser();

        // Listen for auth state changes (login, logout)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            // Re-check user info on any auth event to get updated profile data
             checkUser();
        });

        return () => {
            ignore = true;
            subscription?.unsubscribe();
        };
    }, []);

    // Effect for loading knowledge base once a user is logged in
    useEffect(() => {
        if (currentUser) {
            setIsKbLoading(true);
            knowledgeBaseService.getKnowledgeBase()
                .then(kb => {
                    setKnowledgeContext(kb.content);
                    setKnowledgeFiles(kb.files);
                })
                .catch(err => console.error("Failed to load knowledge base:", err))
                .finally(() => setIsKbLoading(false));
        } else {
            // If no user, clear knowledge base and stop loading
            setKnowledgeContext('');
            setKnowledgeFiles([]);
            setIsKbLoading(false);
        }
    }, [currentUser]);

    const login = async (email: string, pass: string) => {
        await authService.login(email, pass);
    };

    const register = (email: string, pass: string) => {
        return authService.register(email, pass);
    };

    const logout = () => {
        authService.logout();
        setCurrentUser(null);
        setCurrentView('login');
    };

    const updateKnowledgeBase = useCallback(async (contentToAppend: string, filesToAppend: KnowledgeFile[]) => {
        // Fetch the latest knowledge base to prevent overwrites from stale state
        const currentKb = await knowledgeBaseService.getKnowledgeBase();
        
        const newContent = (currentKb.content ? currentKb.content.trim() + "\n\n" : "") + contentToAppend;
        const newFiles = [...currentKb.files, ...filesToAppend];

        // Save the newly combined data
        await knowledgeBaseService.setKnowledgeBase(newContent, newFiles);

        // Update local state to reflect the change immediately
        setKnowledgeContext(newContent);
        setKnowledgeFiles(newFiles);
    }, []);

    const deleteKnowledgeFile = useCallback(async (fileName: string) => {
        setIsKbLoading(true);
        try {
            const currentKb = await knowledgeBaseService.getKnowledgeBase();
    
            const newFiles = currentKb.files.filter(f => f.name !== fileName);
    
            // Reconstruct the content string by removing the corresponding file block
            const blocks = currentKb.content.split(/(--- FILE: .*? ---\n)/).filter(Boolean);
            const newContentParts: string[] = [];
            for (let i = 0; i < blocks.length; i += 2) {
                const header = blocks[i];
                const content = blocks[i + 1] || '';
                if (header && !header.includes(`--- FILE: ${fileName} ---`)) {
                    newContentParts.push(header, content);
                }
            }
            
            const newContent = newContentParts.join('').trim();
    
            await knowledgeBaseService.setKnowledgeBase(newContent, newFiles);
    
            setKnowledgeContext(newContent);
            setKnowledgeFiles(newFiles);
        } catch (error) {
            console.error("Failed to delete knowledge file:", error);
            throw error; // Re-throw to allow UI to handle it
        } finally {
            setIsKbLoading(false);
        }
    }, []);

    const authContextValue = { currentUser, login, register, logout };
    const kbContextValue = { knowledgeContext, knowledgeFiles, updateKnowledgeBase, deleteKnowledgeFile, isLoading: isKbLoading };
    
    const renderContent = () => {
        if (isAuthLoading) {
            return (
                 <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
                    <div className="flex items-center justify-center space-x-2">
                        <div className="w-4 h-4 bg-indigo-500 rounded-full animate-bounce delay-0"></div>
                        <div className="w-4 h-4 bg-indigo-500 rounded-full animate-bounce delay-150"></div>
                        <div className="w-4 h-4 bg-indigo-500 rounded-full animate-bounce delay-300"></div>
                        <span className="ml-2 text-lg">Loading...</span>
                    </div>
                </div>
            );
        }

        if (currentUser) {
            return <App />;
        }
        
        switch(currentView) {
            case 'login':
                return <LoginPage onSwitchToRegister={() => setCurrentView('register')} />;
            case 'register':
                return <RegisterPage onSwitchToLogin={() => setCurrentView('login')} />;
            default:
                return <LoginPage onSwitchToRegister={() => setCurrentView('register')} />;
        }
    }

    return (
        <AuthContext.Provider value={authContextValue}>
            <KnowledgeBaseContext.Provider value={kbContextValue}>
                {renderContent()}
            </KnowledgeBaseContext.Provider>
        </AuthContext.Provider>
    );
};

export default AppShell;