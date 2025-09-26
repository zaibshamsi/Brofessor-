import React, { useState } from 'react';
import CloseIcon from './icons/CloseIcon';
import SpinnerIcon from './icons/SpinnerIcon';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (message: string) => Promise<void>;
}

const NotificationModal: React.FC<NotificationModalProps> = ({ isOpen, onClose, onSend }) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!message.trim()) {
      setError('Notification message cannot be empty.');
      return;
    }
    
    setError('');
    setIsSending(true);
    try {
      await onSend(message);
      setMessage('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to send notification.');
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    if (isSending) return;
    setMessage('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-modal-title"
    >
      <div
        className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg text-white transform transition-all animate-fade-in-up flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <header className="p-5 border-b border-gray-700 flex justify-between items-center">
          <h2 id="notification-modal-title" className="text-xl font-bold">Send a New Notification</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-white" aria-label="Close modal" disabled={isSending}>
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>

        <main className="p-6">
          <p className="text-sm text-gray-400 mb-4">
            This message will be sent to all registered users and they will receive an email notification.
          </p>
          {error && <p className="text-sm text-red-400 bg-red-900/50 p-3 rounded-md mb-4">{error}</p>}
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Enter your notification message..."
            className="w-full h-40 bg-gray-700 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow duration-200 disabled:opacity-50"
            disabled={isSending}
            aria-label="Notification message"
          />
        </main>

        <footer className="p-5 border-t border-gray-700 flex justify-end gap-4">
          <button
            onClick={handleClose}
            disabled={isSending}
            className="bg-gray-600 text-white px-5 py-2 rounded-lg hover:bg-gray-500 transition-colors duration-200 disabled:opacity-50 font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={isSending || !message.trim()}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-500 transition-colors duration-200 disabled:bg-indigo-800 disabled:cursor-not-allowed font-semibold w-28 flex items-center justify-center"
          >
            {isSending ? <SpinnerIcon className="w-5 h-5" /> : 'Send'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default NotificationModal;