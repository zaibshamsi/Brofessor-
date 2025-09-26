

import React, { useState, useRef, useEffect, useContext, useCallback } from 'react';
import { Message, KnowledgeFile, ProcessedFileResult } from './types';
import { getAiResponseStream, analyzeForDocumentFollowUp } from './services/geminiService';
import BotIcon from './components/icons/BotIcon';
import UserIcon from './components/icons/UserIcon';
import SendIcon from './components/icons/SendIcon';
import KnowledgeBaseModal from './components/KnowledgeBaseModal';
import { AuthContext, KnowledgeBaseContext } from './AppShell';
import { AuthContextType, KnowledgeBaseContextType } from './types';
import MicrophoneIcon from './components/icons/MicrophoneIcon';
import RefreshIcon from './components/icons/RefreshIcon';
import DotsVerticalIcon from './components/icons/DotsVerticalIcon';
import BellIcon from './components/icons/BellIcon';
import NotificationsPanel from './components/NotificationsPanel';
import NotificationModal from './components/NotificationModal';
import CopyIcon from './components/icons/CopyIcon';
import CheckIcon from './components/icons/CheckIcon';
import { databaseService } from './services/databaseService';
import DownloadIcon from './components/icons/DownloadIcon';
import { timetableService } from './services/timetableService';
import TimetableModal from './components/TimetableModal';
import CalendarIcon from './components/icons/CalendarIcon';


// Fix: Add type definitions for the experimental SpeechRecognition API
// This is to resolve TypeScript errors for a non-standard browser API.
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}

declare global {
  interface Window {
    SpeechRecognition: { new(): SpeechRecognition };
    webkitSpeechRecognition: { new(): SpeechRecognition };
  }
}

// A simple component to render message text and handle markdown-style links
const MessageContent: React.FC<{ text: string }> = ({ text }) => {
    // Split the text by our link format `[link text](url)`
    const parts = text.split(/(\[.*?\]\(.*?\))/g);

    return (
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {parts.map((part, index) => {
                const match = part.match(/\[(.*?)\]\((.*?)\)/);
                if (match) {
                    const linkText = match[1];
                    const url = match[2];
                    return (
                        <a 
                            key={index} 
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="inline-flex items-center gap-1.5 text-indigo-300 font-semibold underline hover:text-indigo-200 transition-colors"
                        >
                            <DownloadIcon className="w-4 h-4" />
                            {linkText}
                        </a>
                    );
                }
                return part; // Return the non-link part of the text
            })}
        </p>
    );
};

const App: React.FC = () => {
  const { currentUser, logout } = useContext(AuthContext) as AuthContextType;
  const { 
    knowledgeContext, 
    knowledgeFiles, 
    updateKnowledgeBase, 
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
  } = useContext(KnowledgeBaseContext) as KnowledgeBaseContextType;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isKbModalOpen, setIsKbModalOpen] = useState(false);
  const [isTimetableModalOpen, setIsTimetableModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [pendingPdfOffer, setPendingPdfOffer] = useState<{ fileName: string } | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [isListening, setIsListening] = useState(false);
  const [speechApiSupported, setSpeechApiSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const initialChips = [
    "What is the syllabus for CS? 📚",
    "Tell me about upcoming events 🎉",
    "What is the fee structure? 🤔",
    "Show me the academic calendar 📝",
  ];

  const getInitialMessage = useCallback((): Message => {
    const welcomeText = knowledgeContext 
      ? "Greetings! I'm Brofessor, your virtual assistant for Invertis University. Feel free to ask me anything about campus life, courses, or events. How can I help you today? 🎓"
      : "Hello! I'm Brofessor. It looks like I'm still getting set up. An administrator needs to provide me with campus information before I can answer questions. Check back soon! 🛠️";
    
    return {
      id: 'initial-ai-message-' + Date.now(),
      text: welcomeText,
      sender: 'ai',
    };
  }, [knowledgeContext]);

  useEffect(() => {
    if (!isKbLoading) {
      setMessages([getInitialMessage()]);
    }
  }, [isKbLoading, getInitialMessage]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        setSpeechApiSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            setIsListening(false);
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            setInputValue(prev => prev + finalTranscript);
        };

        recognitionRef.current = recognition;
    } else {
        console.warn("Speech Recognition API is not supported in this browser.");
        setSpeechApiSupported(false);
    }

    return () => {
        recognitionRef.current?.stop();
    };
  }, []);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Node;
        if (dropdownRef.current && !dropdownRef.current.contains(target)) {
            setIsDropdownOpen(false);
        }
        if (notificationsRef.current && !notificationsRef.current.contains(target)) {
            setIsNotificationsOpen(false);
        }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages, isLoading]);
  
  useEffect(() => {
    if (!isLoading && !isListening) {
      inputRef.current?.focus();
    }
  }, [isLoading, isListening]);

  const handleFilesProcessed = async (results: ProcessedFileResult[]) => {
    setIsKbModalOpen(false);

    const existingFileNames = new Set(knowledgeFiles.map(f => f.name));
    let contentToAppend = "";
    const filesToAppend: KnowledgeFile[] = [];

    for (const result of results) {
        if (!existingFileNames.has(result.fileInfo.name)) {
            filesToAppend.push(result.fileInfo);
            if (result.fileInfo.status === 'processed' && result.content) {
                contentToAppend += `--- FILE: ${result.fileInfo.name} ---\n${result.content}\n\n`;
            }
        }
    }
    
    const processedCount = filesToAppend.filter(f => f.status === 'processed').length;

    if (filesToAppend.length > 0) {
        await updateKnowledgeBase(contentToAppend.trim(), filesToAppend);
        
        if (processedCount > 0) {
            setMessages(prev => [...prev, {
                id: 'kb-updated-' + Date.now(),
                text: `My information has been updated with ${processedCount} new document(s). You can now ask me about the new content.`,
                sender: 'ai'
            }]);
        } else {
            setMessages(prev => [...prev, {
                id: 'kb-update-failed-' + Date.now(),
                text: `I couldn't process any of the new files. Please try uploading a valid .csv, .txt, or .pdf file.`,
                sender: 'ai'
            }]);
        }
    } else if (results.length > 0) {
        setMessages(prev => [...prev, {
            id: 'kb-no-new-files-' + Date.now(),
            text: `No new files were added. The selected files may already be part of my knowledge.`,
            sender: 'ai'
        }]);
    }
  };
  
  const handleSendNotification = async (message: string) => {
      await sendNotification(message);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedMessageId(id);
      setTimeout(() => setCopiedMessageId(null), 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };
  
  const submitUserQuery = async (query: string) => {
    const trimmedInput = query.trim();
    if (!trimmedInput || (!knowledgeContext && timetables.length === 0)) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: trimmedInput,
      sender: 'user',
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    const lowerInput = trimmedInput.toLowerCase();
    const affirmativeWords = ['yes', 'yeah', 'sure', 'ok', 'please', 'yep', 'yup', 'do it', 'great', 'awesome', 'send', 'link', 'document'];
    const negativeWords = ['no', 'not', 'don\'t', 'dont', 'stop', 'nah', 'nope', 'nevermind'];
    const hasAffirmative = affirmativeWords.some(w => lowerInput.includes(w));
    const hasNegative = negativeWords.some(w => lowerInput.includes(w));
    const isAffirmative = hasAffirmative && !hasNegative;

    if (pendingPdfOffer && isAffirmative) {
        const allFiles = [
            ...knowledgeFiles,
            ...timetables.map(t => ({ name: t.file_name, storagePath: t.storage_path }))
        ];
        const file = allFiles.find(f => f.name === pendingPdfOffer.fileName);
        
        if (file && file.storagePath) {
            const { publicUrl } = databaseService.getPublicUrl(file.storagePath);
            const downloadMessageText = `Great! Here is the link to download the document:\n[${file.name}](${publicUrl})`;
            
            const downloadMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: downloadMessageText,
                sender: 'ai',
            };
            setMessages(prev => [...prev, downloadMessage]);
        } else {
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: "I'm sorry, I couldn't find the document. There might have been an issue.",
                sender: 'ai',
            };
            setMessages(prev => [...prev, errorMessage]);
        }
        setPendingPdfOffer(null);
        setIsLoading(false);
        return;
    }
    
    if (pendingPdfOffer) {
        setPendingPdfOffer(null);
    }
    
    // Create a placeholder for the streaming AI response
    const aiMessageId = (Date.now() + 1).toString();
    const aiMessagePlaceholder: Message = { id: aiMessageId, text: '', sender: 'ai' };
    setMessages(prev => [...prev, aiMessagePlaceholder]);
    
    let fullAiResponseText = '';

    try {
        const timetableContext = timetableService.formatTimetablesAsContext(timetables);
        const history = messages.slice(0, -1); // Exclude the placeholder from history

        const stream = getAiResponseStream(history, trimmedInput, knowledgeContext, timetableContext);

        for await (const textChunk of stream) {
            fullAiResponseText += textChunk;
            setMessages(prev => prev.map(m => 
                m.id === aiMessageId ? { ...m, text: fullAiResponseText } : m
            ));
        }

        // After stream is complete, analyze for document follow-up
        const allDownloadableFiles = [
            ...knowledgeFiles,
            ...timetables.map(t => ({ name: t.file_name, type: 'timetable', status: 'processed' as const, storagePath: t.storage_path }))
        ];
        const followUp = await analyzeForDocumentFollowUp(trimmedInput, fullAiResponseText, allDownloadableFiles);

        if (followUp) {
            const followUpText = `\n\n${followUp.question}`;
            setMessages(prev => prev.map(m =>
                m.id === aiMessageId ? { ...m, text: m.text + followUpText } : m
            ));
            setPendingPdfOffer({ fileName: followUp.fileName });
        }

    } catch (error) {
        setMessages(prev => prev.map(m =>
            m.id === aiMessageId ? { ...m, text: 'Sorry, something went wrong. Please try again.' } : m
        ));
    } finally {
        setIsLoading(false);
    }
  };


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitUserQuery(inputValue);
  };
  
  const handleToggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const handleRefreshChat = () => {
    setIsLoading(false);
    if (isListening) {
      recognitionRef.current?.stop();
    }
    setInputValue('');
    setPendingPdfOffer(null);
    setMessages([getInitialMessage()]);
  };

  const showInitialChips = messages.length <= 1 && knowledgeContext;

  return (
    <>
      <div className="flex flex-col h-full bg-gray-900 text-white font-sans overflow-hidden">
        <header className="flex-shrink-0 bg-gray-800 shadow-md p-4 border-b border-gray-700 flex justify-between items-center z-20">
            <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-100">Brofessor</h1>
                <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">24/7</span>
                <button
                    onClick={handleRefreshChat}
                    className="ml-2 text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
                    aria-label="New chat"
                >
                    <RefreshIcon className="w-6 h-6" />
                </button>
            </div>
            <div className="flex items-center gap-2">
                <div className="relative" ref={notificationsRef}>
                    <button
                        onClick={() => setIsNotificationsOpen(prev => !prev)}
                        className="relative text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
                        aria-label={`View notifications (${unreadNotificationsCount} unread)`}
                    >
                        <BellIcon className="w-6 h-6" />
                        {unreadNotificationsCount > 0 && (
                            <span className="absolute top-1 right-1 flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-red-600 text-xs font-semibold text-white ring-2 ring-gray-800">
                                {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                            </span>
                        )}
                    </button>
                    {isNotificationsOpen && (
                        <NotificationsPanel
                            isLoading={isLoadingNotifications}
                            notifications={notifications}
                            onMarkAsRead={markNotificationAsRead}
                            onMarkAllAsRead={markAllNotificationsAsRead}
                            onClear={clearNotification}
                            onClearAll={clearAllNotifications}
                            onClose={() => setIsNotificationsOpen(false)}
                            hasUnread={unreadNotificationsCount > 0}
                        />
                    )}
                </div>

                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsDropdownOpen(prev => !prev)}
                        className="flex items-center text-left p-2 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
                        aria-haspopup="true"
                        aria-expanded={isDropdownOpen}
                    >
                        <DotsVerticalIcon className="w-6 h-6 text-gray-300" />
                    </button>

                    {isDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-56 bg-gray-700 rounded-md shadow-lg z-10 origin-top-right ring-1 ring-black ring-opacity-5 focus:outline-none">
                            <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="menu-button">
                                <div className="px-4 py-3 border-b border-gray-600">
                                    <p className="text-sm font-medium text-gray-200 truncate" id="menu-item-user-email">{currentUser?.email}</p>
                                    <p className="text-xs text-indigo-400 font-semibold uppercase">{currentUser?.role}</p>
                                </div>
                                {currentUser?.role === 'admin' && (
                                    <>
                                        <button
                                            onClick={() => {
                                                setIsKbModalOpen(true);
                                                setIsDropdownOpen(false);
                                            }}
                                            className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-gray-600 flex items-center gap-3"
                                            role="menuitem"
                                        >
                                            Manage Knowledge Base
                                        </button>
                                         <button
                                            onClick={() => {
                                                setIsTimetableModalOpen(true);
                                                setIsDropdownOpen(false);
                                            }}
                                            className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-gray-600 flex items-center gap-3"
                                            role="menuitem"
                                        >
                                            <CalendarIcon className="w-5 h-5 text-gray-400" />
                                            Upload Timetable
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsNotificationModalOpen(true);
                                                setIsDropdownOpen(false);
                                            }}
                                            className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-gray-600 flex items-center gap-3"
                                            role="menuitem"
                                        >
                                            Send Notification
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={() => {
                                        logout();
                                        setIsDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-gray-600 flex items-center gap-3"
                                    role="menuitem"
                                >
                                    Logout
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
        
        <main className="flex-1 overflow-y-auto min-h-0 p-3 sm:p-4 md:p-6 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`group relative flex items-start gap-3 max-w-[90%] sm:max-w-lg md:max-w-xl ${
                message.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
              }`}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${message.sender === 'ai' ? 'bg-indigo-500' : 'bg-blue-600'}`}>
                {message.sender === 'ai' ? <BotIcon className="w-5 h-5 text-white" /> : <UserIcon className="w-5 h-5 text-white" />}
              </div>
              <div
                className={`px-4 py-3 rounded-2xl animate-fade-in min-w-[60px] ${
                  message.sender === 'user'
                    ? 'bg-blue-600 rounded-br-none'
                    : 'bg-gray-700 rounded-bl-none'
                }`}
              >
                 {message.sender === 'ai' && message.text.length === 0 && isLoading ? (
                    <div className="flex items-center justify-center space-x-1 p-1">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-0"></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-300"></span>
                    </div>
                ) : (
                    <MessageContent text={message.text} />
                )}
              </div>
              {message.sender === 'ai' && !isLoading && message.text.length > 0 && (
                <button 
                    onClick={() => handleCopy(message.text, message.id)}
                    className="absolute -bottom-2 -right-2 p-1.5 bg-gray-600 rounded-full text-gray-300 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-200 hover:bg-gray-500"
                    aria-label="Copy response"
                >
                    {copiedMessageId === message.id ? (
                        <CheckIcon className="w-4 h-4 text-green-400" />
                    ) : (
                        <CopyIcon className="w-4 h-4" />
                    )}
                </button>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </main>

        <footer className="flex-shrink-0 p-2 sm:p-4">
            <div className="max-w-3xl mx-auto">
                {showInitialChips && (
                    <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-2 px-1 hide-scrollbar animate-fade-in-up">
                        {initialChips.map((chip, index) => (
                            <button
                                key={index}
                                onClick={() => submitUserQuery(chip)}
                                disabled={isLoading || isListening}
                                className="flex-shrink-0 text-left p-3 bg-gray-800/80 backdrop-blur-sm border border-gray-700 rounded-lg hover:bg-gray-700/80 transition-colors duration-200 text-sm text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {chip}
                            </button>
                        ))}
                    </div>
                )}
                <form onSubmit={handleSendMessage} className="relative flex items-center gap-2 bg-gray-800/90 backdrop-blur-sm border border-gray-600 rounded-full p-2 shadow-2xl transition-all duration-300 focus-within:ring-2 focus-within:ring-indigo-500">
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={isListening ? "Listening..." : (knowledgeContext || timetables.length > 0) ? "Ask a question..." : "Waiting for admin..."}
                    className="flex-1 w-full bg-transparent py-1.5 px-4 text-base text-white placeholder-gray-400 focus:outline-none disabled:opacity-50"
                    disabled={isLoading || (!knowledgeContext && timetables.length === 0) || isListening}
                />
                {speechApiSupported && (
                    <button
                    type="button"
                    onClick={handleToggleListening}
                    disabled={isLoading || (!knowledgeContext && timetables.length === 0)}
                    className={`flex-shrink-0 text-white rounded-full h-10 w-10 flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 ${
                        isListening 
                        ? 'bg-red-600 animate-pulse' 
                        : 'bg-gray-600 hover:bg-gray-500'
                    } disabled:bg-gray-700 disabled:cursor-not-allowed`}
                    aria-label={isListening ? "Stop listening" : "Start voice input"}
                    >
                    <MicrophoneIcon className="w-5 h-5" />
                    </button>
                )}
                <button
                    type="submit"
                    disabled={isLoading || !inputValue.trim() || (!knowledgeContext && timetables.length === 0)}
                    className="flex-shrink-0 bg-indigo-600 text-white rounded-full h-10 w-10 flex items-center justify-center hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
                    aria-label="Send message"
                >
                    <SendIcon className="w-5 h-5" />
                </button>
                </form>
            </div>
        </footer>
      </div>
      <KnowledgeBaseModal 
        isOpen={isKbModalOpen}
        onClose={() => setIsKbModalOpen(false)}
        onFilesProcess={handleFilesProcessed}
      />
       <TimetableModal
        isOpen={isTimetableModalOpen}
        onClose={() => setIsTimetableModalOpen(false)}
      />
      <NotificationModal 
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        onSend={handleSendNotification}
      />
    </>
  );
};

// Fix: Removed duplicate 'export' keyword in the default export statement.
export default App;