import React, { useState, useRef, useEffect, useContext } from 'react';
import { Message, KnowledgeFile, ProcessedFileResult } from './types';
import { getAiResponse } from './services/geminiService';
import BotIcon from './components/icons/BotIcon';
import UserIcon from './components/icons/UserIcon';
import SendIcon from './components/icons/SendIcon';
import KnowledgeBaseModal from './components/KnowledgeBaseModal';
import { AuthContext, KnowledgeBaseContext } from './AppShell';
import { AuthContextType, KnowledgeBaseContextType } from './types';

const App: React.FC = () => {
  const { currentUser, logout } = useContext(AuthContext) as AuthContextType;
  const { knowledgeContext, knowledgeFiles, updateKnowledgeBase, isLoading: isKbLoading } = useContext(KnowledgeBaseContext) as KnowledgeBaseContextType;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isKbModalOpen, setIsKbModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isKbLoading) {
       const welcomeText = knowledgeContext 
        ? `Hello! The knowledge base is loaded from ${knowledgeFiles.filter(f => f.status === 'processed').length} file(s). Ask me anything about the content.`
        : "Hello! The knowledge base is empty. An administrator needs to upload documents to get started.";
      
      setMessages([{
        id: 'initial-ai-message',
        text: welcomeText,
        sender: 'ai',
      }]);
    }
  }, [isKbLoading, knowledgeContext, knowledgeFiles]);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages, isLoading]);
  
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

    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const aiResponseText = await getAiResponse(trimmedInput, knowledgeContext);
      
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

  return (
    <>
      <div className="flex flex-col h-screen bg-gray-900 text-white font-sans">
        <header className="bg-gray-800 shadow-md p-4 border-b border-gray-700 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-100">AI Document Assistant</h1>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-300">{currentUser?.email}</p>
              <p className="text-xs text-indigo-400 font-semibold uppercase">{currentUser?.role}</p>
            </div>
             {currentUser?.role === 'admin' && (
              <button 
                onClick={() => setIsKbModalOpen(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-500 transition-colors duration-200 text-sm font-semibold"
              >
                Manage Knowledge Base
              </button>
            )}
            <button
                onClick={logout}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-500 transition-colors duration-200 text-sm font-semibold"
            >
                Logout
            </button>
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start gap-3 max-w-xl ${
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
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-start gap-3 mr-auto max-w-xl">
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

        <footer className="p-4 bg-gray-800 border-t border-gray-700">
          <form onSubmit={handleSendMessage} className="flex items-center max-w-3xl mx-auto">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={knowledgeContext ? "Ask a question about the documents..." : "Knowledge base is empty. Waiting for admin..."}
              className="flex-1 w-full bg-gray-700 border border-gray-600 rounded-full py-3 px-5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow duration-200 disabled:opacity-50"
              disabled={isLoading || !knowledgeContext}
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim() || !knowledgeContext}
              className="ml-3 flex-shrink-0 bg-indigo-600 text-white rounded-full h-12 w-12 flex items-center justify-center hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
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