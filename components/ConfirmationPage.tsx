import React from 'react';
import BotIcon from './icons/BotIcon';

interface ConfirmationPageProps {
    onSwitchToLogin: () => void;
}

const ConfirmationPage: React.FC<ConfirmationPageProps> = ({ onSwitchToLogin }) => {
    return (
        <div className="flex items-center justify-center h-full bg-gray-900 p-4">
            <div className="w-full max-w-md p-8 space-y-8 bg-gray-800 rounded-2xl shadow-lg text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
                    <svg className="h-10 w-10 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                </div>
                <h2 className="mt-6 text-3xl font-extrabold text-white">
                    Email Verified!
                </h2>
                <p className="mt-4 text-lg text-gray-300">
                    Your email has been successfully verified. You can now go to the chat and log in.
                </p>
                <div className="pt-4">
                    <button
                        onClick={onSwitchToLogin}
                        className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
                    >
                        Proceed to Login
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationPage;