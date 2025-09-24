import React, { useState, useRef, useEffect, useContext, useCallback } from 'react';
import { Message, KnowledgeFile, ProcessedFileResult } from './types';
import { getAiResponse } from './services/geminiService';
import BotIcon from './components/icons/BotIcon';
import UserIcon from './components/icons/UserIcon';
import SendIcon from './components/icons/SendIcon';
import KnowledgeBaseModal from './components/KnowledgeBaseModal';
import { AuthContext, KnowledgeBaseContext } from './AppShell';
import { AuthContextType, KnowledgeBaseContextType } from './types';
import MicrophoneIcon from './components/icons/MicrophoneIcon';
import RefreshIcon from './components/icons/RefreshIcon';
import DotsVerticalIcon from './components/icons/DotsVerticalIcon';

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

const App: React.FC = () => {
  const { currentUser, logout } = useContext(AuthContext) as AuthContextType;
  const { knowledgeContext, knowledgeFiles, updateKnowledgeBase, isLoading: isKbLoading } = useContext(KnowledgeBaseContext) as KnowledgeBaseContextType;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isKbModalOpen, setIsKbModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [isListening, setIsListening] = useState(false);
  const [speechApiSupported, setSpeechApiSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const getInitialMessage = useCallback((): Message => {
    const welcomeText = knowledgeContext 
      ? "Welcome! I'm Brofessor, your university assistant. Ask me anything about the documents in my knowledge base."
      : "Hello! The knowledge base is empty. An administrator needs to upload documents to get started.";
    
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
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setIsDropdownOpen(false);
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
    // Refocus the input after the AI has responded and is no longer loading,
    // but not if the user is currently using voice input.
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
                text: `Knowledge base updated with ${processedCount} new file(s). You can now ask questions about the new content.`,
                sender: 'ai'
            }]);
        } else {
            setMessages(prev => [...prev, {
                id: 'kb-update-failed-' + Date.now(),
                text: `I couldn't process any of the new files. Please try uploading a valid .csv or .txt file.`,
                sender: 'ai'
            }]);
        }
    } else if (results.length > 0) {
        setMessages(prev => [...prev, {
            id: 'kb-no-new-files-' + Date.now(),
            text: `No new files were added. The selected files may already be in the knowledge base.`,
            sender: 'ai'
        }]);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = inputValue.trim();
    if (!trimmedInput || !knowledgeContext) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: trimmedInput,
      sender: 'user',
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      const aiResponseText = await getAiResponse(newMessages, trimmedInput, knowledgeContext);
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: aiResponseText,
        sender: 'ai',
      };
      setMessages((prevMessages) => [...prevMessages, aiMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, something went wrong. Please try again.',
        sender: 'ai',
      };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
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
    setMessages([getInitialMessage()]);
  };

  return (
    <>
      <div className="flex flex-col h-full bg-gray-900 text-white font-sans overflow-hidden">
        <header className="flex-shrink-0 bg-gray-800 shadow-md p-4 border-b border-gray-700 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-100">Brofessor</h1>
                <button
                    onClick={handleRefreshChat}
                    className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
                    aria-label="Start new chat"
                >
                    <RefreshIcon className="w-5 h-5" />
                </button>
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
                                <button
                                    onClick={() => {
                                        setIsKbModalOpen(true);
                                        setIsDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-gray-600 flex items-center gap-3"
                                    role="menuitem"
                                >
                                    Manage KB
                                </button>
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
        </header>
        
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start gap-3 max-w-[90%] sm:max-w-lg md:max-w-xl ${
                message.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
              }`}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${message.sender === 'ai' ? 'bg-indigo-500' : 'bg-blue-600'}`}>
                {message.sender === 'ai' ? <BotIcon className="w-5 h-5 text-white" /> : <UserIcon className="w-5 h-5 text-white" />}
              </div>
              <div
                className={`px-4 py-3 rounded-2xl animate-fade-in ${
                  message.sender === 'user'
                    ? 'bg-blue-600 rounded-br-none'
                    : 'bg-gray-700 rounded-bl-none'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-start gap-3 mr-auto max-w-[90%] sm:max-w-lg md:max-w-xl">
               <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-indigo-500">
                 <BotIcon className="w-5 h-5 text-white" />
               </div>
               <div className="px-4 py-3 rounded-2xl bg-gray-700 rounded-bl-none">
                  <div className="flex items-center justify-center space-x-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-0"></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-300"></span>
                  </div>
               </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </main>

        <footer className="flex-shrink-0 p-2 sm:p-4 bg-gray-800 border-t border-gray-700">
          <form onSubmit={handleSendMessage} className="flex items-center max-w-3xl mx-auto gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={isListening ? "Listening..." : knowledgeContext ? "Ask a question..." : "Waiting for admin..."}
              className="flex-1 w-full bg-gray-700 border border-gray-600 rounded-full py-2.5 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow duration-200 disabled:opacity-50"
              disabled={isLoading || !knowledgeContext || isListening}
            />
            {speechApiSupported && (
              <button
                type="button"
                onClick={handleToggleListening}
                disabled={isLoading || !knowledgeContext}
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
              disabled={isLoading || !inputValue.trim() || !knowledgeContext}
              className="flex-shrink-0 bg-indigo-600 text-white rounded-full h-10 w-10 flex items-center justify-center hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
              aria-label="Send message"
            >
              <SendIcon className="w-5 h-5" />
            </button>
          </form>
        </footer>
      </div>
      <KnowledgeBaseModal 
        isOpen={isKbModalOpen}
        onClose={() => setIsKbModalOpen(false)}
        onFilesProcess={handleFilesProcessed}
      />
    </>
  );
};

export default App;
