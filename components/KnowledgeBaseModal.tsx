import React, { useState, useCallback } from 'react';
import { KnowledgeFile, ProcessedFileResult } from '../types';
import CloseIcon from './icons/CloseIcon';
import UploadIcon from './icons/UploadIcon';
import FileIcon from './icons/FileIcon';

interface KnowledgeBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFilesProcess: (results: ProcessedFileResult[]) => void;
}

const KnowledgeBaseModal: React.FC<KnowledgeBaseModalProps> = ({ isOpen, onClose, onFilesProcess }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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
        if (file.type === 'text/csv' || file.type === 'text/plain') {
          const reader = new FileReader();
          
          reader.onload = () => {
            results.push({
              fileInfo: { name: file.name, type: file.type, status: 'processed' },
              content: reader.result as string,
            });
            resolve();
          };

          reader.onerror = () => {
            results.push({
              fileInfo: { name: file.name, type: file.type, status: 'error' },
              content: null,
            });
            resolve();
          };
          
          reader.readAsText(file);
        } else {
          results.push({
            fileInfo: { name: file.name, type: file.type, status: 'unsupported' },
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
        className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl text-white transform transition-all animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        <header className="p-5 border-b border-gray-700 flex justify-between items-center">
          <h2 id="kb-modal-title" className="text-xl font-bold">Manage Knowledge Base</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close modal">
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>
        
        <main className="p-6 space-y-6">
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
             <p className="text-xs text-gray-500 mt-3">Supported: .csv, .txt | Unsupported: .pdf</p>
          </div>

          {files.length > 0 && (
            <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
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
        </main>
        
        <footer className="p-5 border-t border-gray-700 flex justify-end">
          <button 
            onClick={processFiles}
            disabled={files.length === 0 || isProcessing}
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