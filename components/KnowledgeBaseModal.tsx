import React, { useState, useCallback, useContext } from 'react';
import { KnowledgeFile, ProcessedFileResult, KnowledgeBaseContextType } from '../types';
import CloseIcon from './icons/CloseIcon';
import UploadIcon from './icons/UploadIcon';
import FileIcon from './icons/FileIcon';
import DeleteIcon from './icons/DeleteIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import { KnowledgeBaseContext } from '../AppShell';
import { extractTextFromFile } from '../services/geminiService';

interface KnowledgeBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFilesProcess: (results: ProcessedFileResult[]) => void;
}

const KnowledgeBaseModal: React.FC<KnowledgeBaseModalProps> = ({ isOpen, onClose, onFilesProcess }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [deletingFileName, setDeletingFileName] = useState<string | null>(null);

  const { knowledgeFiles, deleteKnowledgeFile, isLoading: isKbLoading } = useContext(KnowledgeBaseContext) as KnowledgeBaseContextType;


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFiles(Array.from(event.target.files));
    }
  };

  const processFiles = useCallback(async () => {
    if (files.length === 0) return;
    
    setIsProcessing(true);
    const results: ProcessedFileResult[] = [];

    const filePromises = files.map(file => {
      return new Promise<void>((resolve) => {
        const fileType = file.type;
        const fileName = file.name;

        if (fileType === 'text/csv' || fileType === 'text/plain') {
          const reader = new FileReader();
          
          reader.onload = () => {
            results.push({
              fileInfo: { name: fileName, type: fileType, status: 'processed' },
              content: reader.result as string,
            });
            resolve();
          };

          reader.onerror = () => {
            results.push({
              fileInfo: { name: fileName, type: fileType, status: 'error' },
              content: null,
            });
            resolve();
          };
          
          reader.readAsText(file);
        } else if (fileType === 'application/pdf') { 
          const reader = new FileReader();

          reader.onload = async (e) => {
            if (e.target?.result) {
              try {
                const extractedText = await extractTextFromFile(e.target.result as string, fileType);
                
                if (extractedText && extractedText.trim().length > 0) {
                  results.push({
                    fileInfo: { name: fileName, type: fileType, status: 'processed' },
                    content: extractedText,
                  });
                } else {
                  console.warn(`Gemini returned no text for ${fileName}. Marking as error.`);
                  results.push({
                    fileInfo: { name: fileName, type: fileType, status: 'error' },
                    content: 'Failed to extract text from PDF.',
                  });
                }
              } catch (error) {
                console.error(`Error processing PDF ${fileName} with Gemini:`, error);
                results.push({
                  fileInfo: { name: fileName, type: fileType, status: 'error' },
                  content: 'An error occurred during PDF processing.',
                });
              }
            } else {
              results.push({
                  fileInfo: { name: fileName, type: fileType, status: 'error' },
                  content: 'Failed to read PDF file.',
              });
            }
            resolve();
          };

          reader.onerror = () => {
              results.push({
                fileInfo: { name: fileName, type: fileType, status: 'error' },
                content: null,
              });
              resolve();
          };

          reader.readAsDataURL(file);
        } else {
          results.push({
            fileInfo: { name: fileName, type: fileType, status: 'unsupported' },
            content: null,
          });
          resolve();
        }
      });
    });

    await Promise.all(filePromises);
    
    onFilesProcess(results);
    setIsProcessing(false);
    setFiles([]); 
  }, [files, onFilesProcess]);
  
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
        setIsDragging(true);
    } else if (e.type === 'dragleave') {
        setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        setFiles(Array.from(e.dataTransfer.files));
        e.dataTransfer.clearData();
    }
  }, []);

  const handleConfirmDelete = async () => {
      if (fileToDelete) {
          setDeletingFileName(fileToDelete);
          try {
              await deleteKnowledgeFile(fileToDelete);
              setFileToDelete(null); // Close confirmation on success
          } catch (error) {
              console.error("Deletion failed in modal:", error);
              // Optionally show an error message to the user here
          } finally {
              setDeletingFileName(null);
          }
      }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="kb-modal-title"
    >
      <div 
        className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl text-white transform transition-all animate-fade-in-up flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <header className="p-5 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
          <h2 id="kb-modal-title" className="text-xl font-bold">Manage Knowledge Base</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close modal">
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>
        
        <main className="p-6 relative flex-1 overflow-y-auto">
          {fileToDelete && (
              <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-b-xl -m-6">
                  <div className="bg-gray-700 p-6 rounded-lg shadow-xl text-center animate-fade-in-up w-full max-w-sm">
                      <h3 className="text-lg font-semibold mb-2 text-white">Confirm Deletion</h3>
                      <p className="text-gray-300 mb-6">Are you sure you want to permanently delete <br/><strong className="font-mono text-indigo-300 break-all">{fileToDelete}</strong>?</p>
                      <div className="flex justify-center gap-4">
                          <button 
                            onClick={() => setFileToDelete(null)} 
                            className="px-4 py-2 bg-gray-600 rounded-md hover:bg-gray-500 font-semibold transition-colors w-28"
                            disabled={!!deletingFileName}
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={handleConfirmDelete} 
                            className="px-4 py-2 bg-red-600 rounded-md hover:bg-red-500 font-semibold transition-colors w-28 flex items-center justify-center disabled:bg-red-800"
                            disabled={!!deletingFileName}
                          >
                              {deletingFileName ? <SpinnerIcon className="w-5 h-5" /> : 'Delete'}
                          </button>
                      </div>
                  </div>
              </div>
          )}
          <div 
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 ${isDragging ? 'border-indigo-500 bg-gray-700/50' : 'border-gray-600 hover:border-indigo-600'}`}
          >
            <UploadIcon className="w-12 h-12 mx-auto text-gray-400" />
            <p className="mt-4 text-gray-300">Drag & drop files here</p>
            <p className="text-sm text-gray-500">or</p>
            <label htmlFor="file-upload" className="mt-2 inline-block cursor-pointer bg-gray-700 px-4 py-2 rounded-md font-semibold text-sm hover:bg-gray-600">
                Select Files
            </label>
            <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple onChange={handleFileChange} accept=".csv,.pdf,.txt" />
             <p className="text-xs text-gray-500 mt-3">Supported: .csv, .txt, .pdf</p>
          </div>

          {files.length > 0 && (
            <div className="space-y-3 max-h-40 overflow-y-auto pr-2 mt-4">
              <h3 className="font-semibold text-gray-300">Selected Files:</h3>
              {files.map((file, index) => (
                <div key={index} className="flex items-center bg-gray-700 p-2 rounded-md">
                  <FileIcon className="w-5 h-5 mr-3 flex-shrink-0 text-gray-400" />
                  <span className="truncate text-sm flex-1">{file.name}</span>
                  <span className="text-xs text-gray-500">{Math.round(file.size / 1024)} KB</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-gray-700">
              <h3 className="font-semibold text-gray-300 mb-3">Current Files in Knowledge Base</h3>
              {isKbLoading && knowledgeFiles.length === 0 ? (
                  <div className="flex justify-center items-center py-4">
                      <SpinnerIcon className="w-6 h-6 text-gray-400" />
                  </div>
              ) : knowledgeFiles.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                      {knowledgeFiles.map((file) => (
                          <div key={file.name} className="flex items-center bg-gray-700 p-2 rounded-md hover:bg-gray-600/50 transition-colors duration-200">
                              <FileIcon className="w-5 h-5 mr-3 flex-shrink-0 text-gray-400" />
                              <span className="truncate text-sm flex-1" title={file.name}>{file.name}</span>
                              <button
                                  onClick={() => setFileToDelete(file.name)}
                                  disabled={isKbLoading || !!deletingFileName}
                                  className="ml-2 flex-shrink-0 text-gray-400 hover:text-red-400 p-1 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  aria-label={`Delete ${file.name}`}
                              >
                                  {deletingFileName === file.name ? <SpinnerIcon className="w-5 h-5" /> : <DeleteIcon className="w-5 h-5" />}
                              </button>
                          </div>
                      ))}
                  </div>
              ) : (
                  <p className="text-sm text-gray-500 text-center py-4">The knowledge base is empty.</p>
              )}
          </div>
        </main>
        
        <footer className="p-5 border-t border-gray-700 flex justify-end flex-shrink-0">
          <button 
            onClick={processFiles}
            disabled={files.length === 0 || isProcessing || isKbLoading}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-500 transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed font-semibold"
          >
            {isProcessing ? 'Processing...' : 'Upload and Process'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default KnowledgeBaseModal;