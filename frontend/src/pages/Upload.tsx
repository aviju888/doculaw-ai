import apiService from '../services/api';
import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  CloudArrowUpIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowUpTrayIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

interface FileWithPreview {
  name:string;size:number;type:string;source:File;
  preview?: string;
  status?: 'uploading' | 'completed' | 'error';
  progress?: number;
  id?: string;
}

const Upload: React.FC = () => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [error, setError] = useState('');

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],

      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    onDrop: (acceptedFiles) => {
      const filesWithPreview = acceptedFiles.map((file) => ({
        name:file.name,size:file.size,type:file.type,source:file,

        status: 'uploading' as const,
        progress: 0,
        id: Math.random().toString(36).substr(2, 9),
      }));

      setFiles(prev => [...prev, ...filesWithPreview]);

      // Upload using the existing document API
      filesWithPreview.forEach((file) => {
        uploadFile(file);
      });
    },
  });

  const uploadFile = async (file: FileWithPreview) => {
    try {
      await apiService.uploadDocument(file.source);
      setFiles(prev=>prev.map(f=>f.id===file.id?{...f,progress:100,status:'completed'}:f));
    } catch {
      setFiles(prev=>prev.map(f=>f.id===file.id?{...f,status:'error'}:f));
      setError('Upload failed. Check the file and backend connection, then try again.');
    }
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const getFileIcon = (file: FileWithPreview) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return '📄';
      case 'doc':
      case 'docx':
        return '📝';
      case 'txt':
        return '📃';
      default:
        return '📄';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6 sm:space-y-8 overflow-x-hidden">
      {error && <p role="alert" className="px-4 text-red-700">{error}</p>}
      {/* Header */}
      <div className="text-center py-6 sm:py-8 md:py-12 mx-4 sm:mx-6 lg:mx-8">
        <div className="w-16 h-16 sm:w-20 sm:h-20 gradient-primary rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 md:mb-8">
          <CloudArrowUpIcon className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold gradient-text mb-4 sm:mb-6 md:mb-8">
          Upload Your Legal Document
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
          Upload any legal document and get an instant, easy-to-understand translation
          tailored to your English proficiency level.
        </p>
      </div>

      {/* Upload Area */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          {...getRootProps()}
          className={`card-3d p-6 sm:p-8 md:p-12 text-center cursor-pointer transition-all duration-300 border-2 border-dashed ${
            isDragActive
              ? 'border-legal-500 bg-legal-50 scale-105 shadow-2xl'
              : 'border-gray-300 hover:border-legal-400 hover:bg-gray-50 hover:scale-102'
          }`}
        >
          <input {...getInputProps()} />

          {isDragActive ? (
            <div className="space-y-3 sm:space-y-4">
              <ArrowUpTrayIcon className="h-12 w-12 sm:h-16 sm:w-16 text-legal-500 mx-auto animate-bounce" />
              <p className="text-lg sm:text-xl font-medium text-legal-700">Drop your files here!</p>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full flex items-center justify-center mx-auto">
                <CloudArrowUpIcon className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
              </div>

              <div>
                <p className="text-lg sm:text-xl font-medium text-gray-900 mb-2">
                  Drag and drop your legal documents here
                </p>
                <p className="text-sm sm:text-base text-gray-600">or click to browse your files</p>
              </div>

              <button className="btn-primary text-base sm:text-lg px-6 sm:px-8 py-2 sm:py-3">
                Choose Files
              </button>
            </div>
          )}
        </div>

        {/* File Requirements */}
        <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <div className="card-elevated p-4 sm:p-6 text-center">
            <div className="text-2xl sm:text-3xl mb-2 sm:mb-3">📄</div>
            <h3 className="font-semibold text-gray-900 mb-1 sm:mb-2 text-sm sm:text-base">Supported Formats</h3>
            <p className="text-xs sm:text-sm text-gray-600">PDF, DOCX, TXT</p>
          </div>

          <div className="card-elevated p-4 sm:p-6 text-center">
            <div className="text-2xl sm:text-3xl mb-2 sm:mb-3">⚡</div>
            <h3 className="font-semibold text-gray-900 mb-1 sm:mb-2 text-sm sm:text-base">File Size Limit</h3>
            <p className="text-xs sm:text-sm text-gray-600">Maximum 10MB per file</p>
          </div>

          <div className="card-elevated p-4 sm:p-6 text-center">
            <div className="text-2xl sm:text-3xl mb-2 sm:mb-3">🔒</div>
            <h3 className="font-semibold text-gray-900 mb-1 sm:mb-2 text-sm sm:text-base">Secure & Private</h3>
            <p className="text-xs sm:text-sm text-gray-600">Files are stored by your DocuLaw backend</p>
          </div>
        </div>
      </div>

      {/* Uploaded Files */}
      {files.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
            Uploaded Files ({files.length})
          </h2>

          <div className="space-y-3 sm:space-y-4">
            {files.map((file) => (
              <div key={file.id} className="floating-card p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                  <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                    <div className="text-2xl sm:text-3xl flex-shrink-0">{getFileIcon(file)}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate text-sm sm:text-base">{file.name}</h3>
                      <p className="text-xs sm:text-sm text-gray-500">
                        {formatFileSize(file.size)} • {file.type.split('/')[1].toUpperCase()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end space-x-3 sm:space-x-4">
                    {file.status === 'uploading' && (
                      <div className="flex items-center space-x-2 flex-1 sm:flex-initial">
                        <div className="w-24 sm:w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-legal-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${file.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-xs sm:text-sm text-gray-600 flex-shrink-0">{Math.round(file.progress || 0)}%</span>
                      </div>
                    )}

                    {file.status === 'completed' && (
                      <div className="flex items-center space-x-2 text-green-600">
                        <CheckCircleIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="text-xs sm:text-sm font-medium">Completed</span>
                      </div>
                    )}

                    {file.status === 'error' && (
                      <div className="flex items-center space-x-2 text-red-600">
                        <XCircleIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="text-xs sm:text-sm font-medium">Error</span>
                      </div>
                    )}

                    <button
                      onClick={() => removeFile(file.id!)}
                      className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      <XCircleIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {files.some(f => f.status === 'completed') && (
            <div className="mt-6 sm:mt-8 text-center">
              <button onClick={()=>window.location.assign("/documents")} className="btn-primary text-base sm:text-lg px-6 sm:px-8 py-2 sm:py-3 flex items-center justify-center mx-auto">
                <DocumentTextIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                View Simplified Documents
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tips */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="card-elevated p-4 sm:p-6 md:p-8 bg-gradient-to-br from-blue-50 to-indigo-50">
          <div className="flex flex-col sm:flex-row sm:items-start space-y-3 sm:space-y-0 sm:space-x-4">
            <div className="flex-shrink-0">
              <InformationCircleIcon className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
                Tips for Best Results
              </h3>
              <ul className="list-disc list-inside space-y-1 sm:space-y-2 text-gray-700 text-sm sm:text-base">
                <li>Upload clear, readable documents for better translation accuracy</li>
                <li>Legal contracts, agreements, and official documents work best</li>
                <li>Our AI will adjust the complexity based on your English proficiency level</li>
                <li>You can ask follow-up questions about any document after uploading</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Upload;
