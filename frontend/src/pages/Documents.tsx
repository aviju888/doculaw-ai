import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  DocumentTextIcon,
  EyeIcon,
  ChatBubbleBottomCenterTextIcon,
  TrashIcon,
  CalendarIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { Document } from '../types';
import { formatDate, formatFileSize, truncateText } from '../utils/helpers';
import { documentService, type DocumentData } from '../services/dataService';

// Mock data - replace with actual API calls
const mockDocuments: Document[] = [
  {
    id: '1',
    title: 'Employment Contract - Tech Company',
    originalTitle: 'Employment Agreement between TechCorp Inc. and John Doe',
    originalContent: 'This is a complex employment contract...',
    type: 'contract',
    status: 'completed',
    uploadDate: new Date('2024-01-10'),
    processedDate: new Date('2024-01-10'),
    complexity: 'high',
    simplificationLevel: 85,
    tags: ['employment', 'contract', 'confidentiality'],
    summary: 'Standard employment contract with confidentiality clauses and termination conditions.',
    fileType: 'application/pdf',
    fileSize: 2.5,
    pageCount: 12,
  },
  {
    id: '2',
    title: 'Rental Agreement Simplified',
    originalTitle: 'Residential Lease Agreement - 123 Main Street',
    originalContent: 'Whereas the lessor agrees to lease...',
    type: 'lease',
    status: 'completed',
    uploadDate: new Date('2024-01-08'),
    processedDate: new Date('2024-01-08'),
    complexity: 'medium',
    simplificationLevel: 92,
    tags: ['rental', 'lease', 'property'],
    summary: 'One-year rental lease with standard terms and conditions for residential property.',
    fileType: 'application/pdf',
    fileSize: 1.8,
    pageCount: 8,
  },
  {
    id: '3',
    title: 'Insurance Policy Terms',
    originalTitle: 'Comprehensive Auto Insurance Policy Document',
    originalContent: 'This insurance policy describes coverage...',
    type: 'insurance',
    status: 'processing',
    uploadDate: new Date('2024-01-12'),
    complexity: 'high',
    simplificationLevel: 0,
    tags: ['insurance', 'auto', 'coverage'],
    summary: 'Auto insurance policy with comprehensive coverage details.',
    fileType: 'application/pdf',
    fileSize: 4.2,
    pageCount: 24,
  },
];

const Documents: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'processing' | 'error'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<string>('date');

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const { documents, error } = await documentService.getUserDocuments();
        
        if (error) {
          console.error('Error loading documents:', error);
        } else {
          setDocuments(documents);
        }
      } catch (err) {
        console.error('Error loading documents:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDocuments();
  }, []);

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (doc.tags && doc.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())));
    const matchesFilter = filterStatus === 'all' || doc.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />;
      case 'processing':
        return <ClockIcon className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />;
      case 'error':
        return <ExclamationTriangleIcon className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />;
      default:
        return <DocumentTextIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />;
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'processing':
        return 'Processing';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  const getComplexityColor = (complexity?: string) => {
    switch (complexity) {
      case 'low':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'high':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const deleteDocument = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-legal-600"></div>
          <span className="ml-2 text-gray-600">Loading documents...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 overflow-x-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">My Documents</h1>
        <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
          Manage and view your simplified legal documents
        </p>
      </div>

      {/* Search and Filters */}
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 sm:space-x-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 sm:pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-legal-500 focus:border-legal-500"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-legal-500"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="processing">Processing</option>
                <option value="error">Error</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-legal-500"
              >
                <option value="date">Sort by Date</option>
                <option value="title">Sort by Title</option>
                <option value="complexity">Sort by Complexity</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Documents Grid */}
      <div className="px-4 sm:px-6 lg:px-8">
        {filteredDocuments.length === 0 ? (
          <div className="text-center py-12">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No documents found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm ? 'Try adjusting your search terms.' : 'Get started by uploading your first document.'}
            </p>
            <div className="mt-6">
              <Link to="/upload" className="btn-primary text-sm sm:text-base">
                Upload Document
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredDocuments.map((document) => (
              <div key={document.id} className="card-elevated p-4 sm:p-6 hover:shadow-lg transition-all duration-300">
                {/* Header */}
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(document.status)}
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getComplexityColor(document.complexity)}`}>
                      {document.complexity}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteDocument(document.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <TrashIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                </div>

                {/* Title */}
                <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2 line-clamp-2">
                  {document.title}
                </h3>

                {/* Original title */}
                <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4 line-clamp-1">
                  Original: {document.originalTitle}
                </p>

                {/* Summary */}
                <p className="text-xs sm:text-sm text-gray-700 mb-3 sm:mb-4 line-clamp-2">
                  {document.summary}
                </p>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4 text-xs sm:text-sm">
                  <div>
                    <span className="text-gray-500">Simplified:</span>
                    <span className="ml-1 font-medium text-green-600">
                      {document.simplificationLevel}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Pages:</span>
                    <span className="ml-1 font-medium">{document.pageCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Size:</span>
                    <span className="ml-1 font-medium">{document.fileSize}MB</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Type:</span>
                    <span className="ml-1 font-medium capitalize">{document.type}</span>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 sm:gap-2 mb-3 sm:mb-4">
                  {document.tags && document.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-legal-100 text-legal-700"
                    >
                      {tag}
                    </span>
                  ))}
                  {document.tags && document.tags.length > 3 && (
                    <span className="text-xs text-gray-500">+{document.tags.length - 3} more</span>
                  )}
                </div>

                {/* Date */}
                <div className="flex items-center text-xs sm:text-sm text-gray-500 mb-4">
                  <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  {document.createdAt ? formatDate(document.createdAt) : 'Unknown date'}
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                  <Link
                    to={`/workspace/${document.id}`}
                    className="flex-1 btn-primary text-center text-xs sm:text-sm py-2"
                  >
                    <EyeIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    View
                  </Link>
                  <Link
                    to={`/workspace/${document.id}`}
                    className="flex-1 btn-secondary text-center text-xs sm:text-sm py-2"
                  >
                    <ChatBubbleBottomCenterTextIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Ask AI
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload CTA */}
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-legal-600 to-purple-600 rounded-lg p-6 sm:p-8 text-center">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-2 sm:mb-4">
            Need to simplify another document?
          </h2>
          <p className="text-sm sm:text-base text-white/90 mb-4 sm:mb-6">
            Upload any legal document and get an instant, easy-to-understand translation.
          </p>
          <Link to="/upload" className="btn-primary bg-white text-legal-700 hover:bg-gray-100 text-sm sm:text-base">
            Upload New Document
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Documents; 