import React, { useState, useEffect } from 'react';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface DemoPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const DemoPopup: React.FC<DemoPopupProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative max-w-md w-full bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-gray-100/80 hover:bg-gray-200/80 transition-colors group"
          aria-label="Close popup"
        >
          <XMarkIcon className="h-5 w-5 text-gray-600 group-hover:text-gray-800" />
        </button>

        <div className="p-6 pt-8">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-500">
              <ExclamationTriangleIcon className="h-8 w-8 text-white" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-gray-900 text-center mb-3">
            Demo Prototype Notice
          </h2>

          {/* Content */}
          <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
            
            <p>
              DocuLaw AI helps people understand legal documents by translating complex legal language into natural language.
            </p>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
              <p className="text-amber-800 text-xs font-medium">
                ⚠️ <strong>This is just a visual concept prototype.</strong>
              </p>
            </div>
          </div>

          {/* Button */}
          <button
            onClick={onClose}
            className="w-full mt-6 px-4 py-3 bg-gradient-to-r from-legal-600 to-purple-600 text-white font-semibold rounded-xl hover:from-legal-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            I Understand - Continue to Demo
          </button>
        </div>
      </div>
    </div>
  );
};

export default DemoPopup;
