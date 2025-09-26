import React, { useState, useCallback, useContext } from 'react';
import { KnowledgeBaseContextType, Timetable } from '../types';
import CloseIcon from './icons/CloseIcon';
import UploadIcon from './icons/UploadIcon';
import FileIcon from './icons/FileIcon';
import DeleteIcon from './icons/DeleteIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import { KnowledgeBaseContext } from '../AppShell';
import CalendarIcon from './icons/CalendarIcon';

interface TimetableModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TimetableModal: React.FC<TimetableModalProps> = ({ isOpen, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');

  const [timetableToDelete, setTimetableToDelete] = useState<Timetable | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { timetables, addTimetable, deleteTimetable, isTimetablesLoading } = useContext(KnowledgeBaseContext) as KnowledgeBaseContextType;

  const resetForm = () => {
    setFile(null);
    setDepartment('');
    setYear('');
    setError('');
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setFile(event.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!file || !department.trim() || !year.trim()) {
      setError('All fields are required.');
      return;
    }
    setError('');
    setIsProcessing(true);
    try {
      await addTimetable(file, department, year);
      resetForm();
    } catch (err) {
      console.error("Upload failed:", err);
      setError((err as Error).message || 'An unexpected error occurred.');
    } finally {
      setIsProcessing(false);
    }
  };

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
      setFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  }, []);

  const handleConfirmDelete = async () => {
    if (timetableToDelete) {
      setDeletingId(timetableToDelete.id);
      try {
        await deleteTimetable(timetableToDelete.id, timetableToDelete.storage_path);
        setTimetableToDelete(null);
      } catch (error) {
        console.error("Deletion failed in modal:", error);
      } finally {
        setDeletingId(null);
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
      aria-labelledby="timetable-modal-title"
    >
      <div
        className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl text-white transform transition-all animate-fade-in-up flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <header className="p-5 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
          <h2 id="timetable-modal-title" className="text-xl font-bold flex items-center gap-3">
            <CalendarIcon className="w-6 h-6" /> Manage Timetables
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close modal">
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>
        
        <main className="p-6 relative flex-1 overflow-y-auto">
          {timetableToDelete && (
            <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-b-xl -m-6">
              <div className="bg-gray-700 p-6 rounded-lg shadow-xl text-center animate-fade-in-up w-full max-w-sm">
                <h3 className="text-lg font-semibold mb-2 text-white">Confirm Deletion</h3>
                <p className="text-gray-300 mb-6">Are you sure you want to permanently delete <br/><strong className="font-mono text-indigo-300 break-all">{timetableToDelete.file_name}</strong>?</p>
                <div className="flex justify-center gap-4">
                  <button onClick={() => setTimetableToDelete(null)} className="px-4 py-2 bg-gray-600 rounded-md hover:bg-gray-500 font-semibold transition-colors w-28" disabled={!!deletingId}>
                    Cancel
                  </button>
                  <button onClick={handleConfirmDelete} className="px-4 py-2 bg-red-600 rounded-md hover:bg-red-500 font-semibold transition-colors w-28 flex items-center justify-center disabled:bg-red-800" disabled={!!deletingId}>
                    {deletingId ? <SpinnerIcon className="w-5 h-5" /> : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-300 mb-3">Upload New Timetable</h3>
              <div className="space-y-4">
                <input type="text" placeholder="Department (e.g., CSE)" value={department} onChange={e => setDepartment(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2.5 focus:ring-indigo-500 focus:border-indigo-500" />
                <input type="text" placeholder="Year (e.g., 2nd)" value={year} onChange={e => setYear(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2.5 focus:ring-indigo-500 focus:border-indigo-500" />
                <div 
                  onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors duration-200 ${isDragging ? 'border-indigo-500 bg-gray-700/50' : 'border-gray-600 hover:border-indigo-600'}`}
                >
                  <UploadIcon className="w-10 h-10 mx-auto text-gray-400" />
                  <p className="mt-2 text-gray-400 text-sm">{file ? 'File selected:' : 'Drag & drop a file'}</p>
                  {file ? (
                    <div className="font-mono text-xs text-indigo-300 mt-1 truncate">{file.name}</div>
                  ) : (
                    <p className="text-xs text-gray-500">or click to select</p>
                  )}
                  <input id="timetable-upload" type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileChange} accept=".csv,.pdf,.txt" />
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
              </div>
            </div>
            
            <div className="flex flex-col">
              <h3 className="font-semibold text-gray-300 mb-3">Current Timetables</h3>
              <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                {isTimetablesLoading && timetables.length === 0 ? (
                  <div className="flex justify-center items-center h-full">
                    <SpinnerIcon className="w-6 h-6 text-gray-400" />
                  </div>
                ) : timetables.length > 0 ? (
                  <div className="space-y-2">
                    {timetables.map((tt) => (
                      <div key={tt.id} className="flex items-center bg-gray-700 p-2.5 rounded-md hover:bg-gray-600/50 transition-colors duration-200">
                        <FileIcon className="w-5 h-5 mr-3 flex-shrink-0 text-gray-400" />
                        <div className="flex-1 truncate">
                            <span className="text-sm" title={tt.file_name}>{tt.file_name}</span>
                            <div className="text-xs text-gray-400">{tt.department} - {tt.year} Year</div>
                        </div>
                        <button
                          onClick={() => setTimetableToDelete(tt)}
                          disabled={isTimetablesLoading || !!deletingId}
                          className="ml-2 flex-shrink-0 text-gray-400 hover:text-red-400 p-1 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          aria-label={`Delete ${tt.file_name}`}
                        >
                          {deletingId === tt.id ? <SpinnerIcon className="w-5 h-5" /> : <DeleteIcon className="w-5 h-5" />}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex justify-center items-center h-full text-center">
                    <p className="text-sm text-gray-500">No timetables have been uploaded yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
        
        <footer className="p-5 border-t border-gray-700 flex justify-end flex-shrink-0">
          <button
            onClick={handleSubmit}
            disabled={!file || !department || !year || isProcessing || isTimetablesLoading}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-500 transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed font-semibold w-48 flex items-center justify-center"
          >
            {isProcessing ? <SpinnerIcon className="w-5 h-5" /> : 'Upload Timetable'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default TimetableModal;
