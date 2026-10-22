import apiService from '../services/api';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  DocumentTextIcon,
  AdjustmentsHorizontalIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { SearchResult } from '../types';
import { formatDate, truncateText } from '../utils/helpers';

const Search: React.FC = () => {
  const [error,setError]=useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    documentType: '',
    dateRange: '',
    complexity: '',
  });

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    
    setError('');
    try {setResults(await apiService.searchDocuments({query}));}
    catch {setResults([]);setError('Search is unavailable. Check the backend search provider configuration.');}
    finally {setIsSearching(false);}
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Search Legal Documents</h1>
        <p className="mt-2 text-gray-600">
          Find relevant legal documents and precedents using intelligent semantic search
        </p>
      </div>

      {/* Search Input */}
      <div className="mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Search for legal terms, document types, or specific clauses..."
            className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-legal-500 focus:border-legal-500 text-lg"
          />
        </div>
        
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleSearch}
              disabled={!query.trim() || isSearching}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <AdjustmentsHorizontalIcon className="h-4 w-4 mr-1" />
              Filters
            </button>
          </div>
          
          {/* Quick Search Suggestions */}
          <div className="hidden sm:flex items-center space-x-2">
            <span className="text-sm text-gray-500">Try:</span>
            {[
              'confidentiality clause',
              'termination rights',
              'lease agreement',
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setQuery(suggestion)}
                className="text-sm text-legal-600 hover:text-legal-800 underline"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mb-6 bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Filter Results</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Document Type
              </label>
              <select
                value={filters.documentType}
                onChange={(e) => setFilters(prev => ({ ...prev, documentType: e.target.value }))}
                className="input-field"
              >
                <option value="">All Types</option>
                <option value="contract">Contracts</option>
                <option value="lease">Lease Agreements</option>
                <option value="nda">NDAs</option>
                <option value="policy">Policies</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date Range
              </label>
              <select
                value={filters.dateRange}
                onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                className="input-field"
              >
                <option value="">Any Time</option>
                <option value="week">Past Week</option>
                <option value="month">Past Month</option>
                <option value="year">Past Year</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Complexity
              </label>
              <select
                value={filters.complexity}
                onChange={(e) => setFilters(prev => ({ ...prev, complexity: e.target.value }))}
                className="input-field"
              >
                <option value="">Any Complexity</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      {isSearching ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-legal-600"></div>
          <span className="ml-2 text-gray-600">Searching documents...</span>
        </div>
      ) : results.length > 0 ? (
        <div>
          <div className="mb-4 text-sm text-gray-600">
            Found {results.length} results for "{query}"
          </div>
          
          <div className="space-y-4">
            {results.map((result) => (
              <div key={result.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-2" />
                      <Link
                        to={`/documents/${result.id}`}
                        className="text-lg font-medium text-legal-600 hover:text-legal-800"
                      >
                        {result.title}
                      </Link>
                    </div>
                    
                    <p className="text-gray-700 mb-3 leading-relaxed">
                      {truncateText(result.snippet, 200)}
                    </p>
                    
                    <div className="flex items-center text-sm text-gray-500 space-x-4">
                      <div className="flex items-center">
                        <ClockIcon className="h-4 w-4 mr-1" />
                        <span>Modified {formatDate(result.lastModified)}</span>
                      </div>
                      
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {result.documentType}
                      </span>
                      
                      <span className="text-legal-600">
                        {Math.round(result.relevanceScore * 100)}% match
                      </span>
                    </div>
                  </div>
                  
                  <div className="ml-4 flex-shrink-0">
                    <Link
                      to={`/documents/${result.id}`}
                      className="btn-secondary"
                    >
                      View Document
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Load More */}
          <div className="mt-8 text-center">
            <button className="btn-secondary">
              Load More Results
            </button>
          </div>
        </div>
      ) : query && !isSearching ? (
        <div className="text-center py-12">
          <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No results found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your search terms or filters
          </p>
        </div>
      ) : (
        <div className="text-center py-12">
          <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Start your search</h3>
          <p className="mt-1 text-sm text-gray-500">
            Search for legal documents, terms, or concepts
          </p>
          
          {/* Popular Searches */}
          <div className="mt-6">
            <p className="text-sm text-gray-600 mb-3">Popular searches:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                'employment contract',
                'non-disclosure agreement',
                'lease agreement',
                'privacy policy',
                'terms of service',
                'confidentiality clause',
              ].map((term) => (
                <button
                  key={term}
                  onClick={() => setQuery(term)}
                  className="text-sm bg-legal-100 hover:bg-legal-200 text-legal-800 px-3 py-1 rounded-full transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Search; 