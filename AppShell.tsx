import React, { createContext, useState, useEffect, useCallback } from 'react';
import App from './App';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import ConfirmationPage from './components/ConfirmationPage';
import { authService } from './services/authService';
import { knowledgeBaseService } from './services/knowledgeBaseService';
import { User, AuthContextType, KnowledgeFile, KnowledgeBaseContextType, Notification, Timetable } from './types';
import { supabase } from './services/supabaseClient';
import { notificationService } from './services/notificationService';
import { RealtimeChannel } from '@supabase/supabase-js';
import { databaseService } from './services/databaseService';
import { timetableService } from './services/timetableService';
import { extractTextFromFile } from './services/geminiService';

export const AuthContext = createContext<AuthContextType | null>(null);
export const KnowledgeBaseContext = createContext<KnowledgeBaseContextType | null>(null);


const AppShell: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isAuthLoading, setIsAuthLoading] = useState(true);

    const getInitialView = (): 'login' | 'register' | 'confirmed' => {
        if (window.location.hash.includes('type=signup')) {
            return 'confirmed';
        }
        return 'login';
    };

    const [view, setView] = useState<'login' | 'register' | 'confirmed'>(getInitialView);

    const [knowledgeContext, setKnowledgeContext] = useState('');
    const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFile[]>([]);
    const [isKbLoading, setIsKbLoading] = useState(true);
    
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);
    const unreadNotificationsCount = notifications.filter(n => !n.is_read).length;

    const [timetables, setTimetables] = useState<Timetable[]>([]);
    const [isTimetablesLoading, setIsTimetablesLoading] = useState(true);

    useEffect(() => {
        if (view === 'confirmed') {
            window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
        }
    }, [view]);

    const fetchNotifications = useCallback(async () => {
        if (!currentUser) return;
        setIsLoadingNotifications(true);
        try {
            const fetchedNotifications = await notificationService.getNotificationsForUser();
            setNotifications(fetchedNotifications);
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
        } finally {
            setIsLoadingNotifications(false);
        }
    }, [currentUser]);

    const fetchTimetables = useCallback(async () => {
        if(!currentUser) return;
        setIsTimetablesLoading(true);
        try {
            const fetchedTimetables = await timetableService.getTimetables();
            setTimetables(fetchedTimetables);
        } catch (error) {
            console.error("Failed to fetch timetables:", error);
        } finally {
            setIsTimetablesLoading(false);
        }
    }, [currentUser]);

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
        
        checkUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
             checkUser();
        });

        return () => {
            ignore = true;
            subscription?.unsubscribe();
        };
    }, []);

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
            
            fetchNotifications(); // Fetch initial notifications
            fetchTimetables(); // Fetch initial timetables
        } else {
            setKnowledgeContext('');
            setKnowledgeFiles([]);
            setTimetables([]);
            setIsKbLoading(false);
            setNotifications([]);
            setIsLoadingNotifications(false);
            setIsTimetablesLoading(false);
        }
    }, [currentUser, fetchNotifications, fetchTimetables]);

    useEffect(() => {
        if (!currentUser) return;

        let channel: RealtimeChannel;

        const setupSubscription = async () => {
            channel = await notificationService.subscribeToNotifications((payload) => {
                console.log('New notification received!', payload);
                fetchNotifications(); 
            });
        };

        setupSubscription();

        return () => {
            if (channel) {
                notificationService.unsubscribeFromNotifications(channel);
            }
        };
    }, [currentUser, fetchNotifications]);


    const login = async (email: string, pass: string) => {
        await authService.login(email, pass);
    };

    const register = (email: string, pass: string) => {
        return authService.register(email, pass);
    };

    const logout = () => {
        authService.logout();
        setCurrentUser(null);
        setView('login');
    };

    const updateKnowledgeBase = useCallback(async (contentToAppend: string, filesToAppend: KnowledgeFile[]) => {
        const currentKb = await knowledgeBaseService.getKnowledgeBase();
        
        const newContent = (currentKb.content ? currentKb.content.trim() + "\n\n" : "") + contentToAppend;
        const newFiles = [...currentKb.files, ...filesToAppend];

        await knowledgeBaseService.setKnowledgeBase(newContent, newFiles);

        setKnowledgeContext(newContent);
        setKnowledgeFiles(newFiles);
    }, []);

    const deleteKnowledgeFile = useCallback(async (fileName: string) => {
        setIsKbLoading(true);
        try {
            const currentKb = await knowledgeBaseService.getKnowledgeBase();
            
            const fileToDelete = currentKb.files.find(f => f.name === fileName);
            if (fileToDelete?.storagePath) {
                await databaseService.deleteFile(fileToDelete.storagePath);
            }
    
            const newFiles = currentKb.files.filter(f => f.name !== fileName);
    
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
            throw error; 
        } finally {
            setIsKbLoading(false);
        }
    }, []);

    const addTimetable = useCallback(async (file: File, department: string, year: string) => {
        if (!currentUser) throw new Error("User must be logged in to add a timetable.");
        
        setIsTimetablesLoading(true);
        let storagePath: string | undefined;
        try {
            // 1. Upload file to storage
            const uploadResult = await databaseService.uploadFile(file, currentUser.id);
            storagePath = uploadResult.path;

            // 2. Extract text content
            const reader = new FileReader();
            const content = await new Promise<string>((resolve, reject) => {
                reader.onload = async (e) => {
                    if (e.target?.result) {
                        const extracted = await extractTextFromFile(e.target.result as string, file.type);
                        resolve(extracted);
                    } else {
                        reject(new Error('Failed to read timetable file.'));
                    }
                };
                reader.onerror = () => reject(new Error('FileReader error.'));
                reader.readAsDataURL(file);
            });
            
            // 3. Add record to database
            const newTimetable = await timetableService.addTimetable({
                department,
                year,
                file_name: file.name,
                storage_path: storagePath,
                content: content,
                user_id: currentUser.id,
            });

            // 4. Update local state
            setTimetables(prev => [...prev, newTimetable]);

        } catch (error) {
            console.error("Failed to add timetable:", error);
             if (storagePath) {
                await databaseService.deleteFile(storagePath);
            }
            throw error;
        } finally {
            setIsTimetablesLoading(false);
        }
    }, [currentUser]);

    const deleteTimetable = useCallback(async (timetableId: number, storagePath: string) => {
        setIsTimetablesLoading(true);
        try {
            // DB record is deleted first by service
            await timetableService.deleteTimetable(timetableId, storagePath);
            setTimetables(prev => prev.filter(t => t.id !== timetableId));
        } catch (error) {
            console.error("Failed to delete timetable:", error);
            throw error;
        } finally {
            setIsTimetablesLoading(false);
        }
    }, []);

    const markNotificationAsRead = useCallback(async (notificationId: string) => {
        setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
        try {
            await notificationService.markNotificationAsRead(notificationId);
        } catch (error) {
            console.error("Failed to mark notification as read:", error);
            fetchNotifications();
        }
    }, [fetchNotifications]);

    const markAllNotificationsAsRead = useCallback(async () => {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        try {
            await notificationService.markAllNotificationsAsRead();
        } catch (error) {
            console.error("Failed to mark all notifications as read:", error);
            fetchNotifications();
        }
    }, [fetchNotifications]);

    const clearNotification = useCallback(async (notificationId: string) => {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        try {
            await notificationService.clearNotification(notificationId);
        } catch (error) {
            console.error("Failed to clear notification:", error);
            fetchNotifications();
        }
    }, [fetchNotifications]);
    
    const clearAllNotifications = useCallback(async () => {
        setNotifications([]);
        try {
            await notificationService.clearAllNotifications();
        } catch (error) {
            console.error("Failed to clear all notifications:", error);
            fetchNotifications();
        }
    }, [fetchNotifications]);

    const sendNotification = useCallback(async (message: string) => {
        if (!currentUser?.email) {
            throw new Error("Cannot send notification without a sender email.");
        }
        await notificationService.sendNotification(message, currentUser.email);
        fetchNotifications();
    }, [currentUser, fetchNotifications]);


    const authContextValue = { currentUser, login, register, logout };
    const kbContextValue: KnowledgeBaseContextType = { 
        knowledgeContext, 
        knowledgeFiles, 
        updateKnowledgeBase, 
        deleteKnowledgeFile, 
        isLoading: isKbLoading,
        notifications,
        isLoadingNotifications,
        unreadNotificationsCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        clearNotification,
        clearAllNotifications,
        sendNotification,
        timetables,
        isTimetablesLoading,
        addTimetable,
        deleteTimetable,
    };
    
    const renderContent = () => {
        if (isAuthLoading) {
            return (
                 <div className="flex items-center justify-center h-full bg-gray-900 text-white">
                    <div className="flex items-center justify-center space-x-2">
                        <div className="w-4 h-4 bg-indigo-500 rounded-full animate-bounce delay-0"></div>
                        <div className="w-4 h-4 bg-indigo-500 rounded-full animate-bounce delay-150"></div>
                        <div className="w-4 h-4 bg-indigo-500 rounded-full animate-bounce delay-300"></div>
                        <span className="ml-2 text-lg">Loading...</span>
                    </div>
                </div>
            );
        }

        if (view === 'confirmed') {
            return <ConfirmationPage onSwitchToLogin={() => setView('login')} />;
        }

        if (currentUser) {
            return <App />;
        }
        
        switch(view) {
            case 'login':
                return <LoginPage onSwitchToRegister={() => setView('register')} />;
            case 'register':
                return <RegisterPage onSwitchToLogin={() => setView('login')} />;
            default:
                return <LoginPage onSwitchToRegister={() => setView('register')} />;
        }
    }

    return (
        <AuthContext.Provider value={authContextValue}>
            <KnowledgeBaseContext.Provider value={kbContextValue}>
                <div className="h-[100dvh]">
                  {renderContent()}
                </div>
            </KnowledgeBaseContext.Provider>
        </AuthContext.Provider>
    );
};

export default AppShell;
