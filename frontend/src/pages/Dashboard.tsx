import apiService from '../services/api';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  DocumentTextIcon,
  ChatBubbleBottomCenterTextIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import { Document, ChatSession } from '../types';
import { formatRelativeTime } from '../utils/helpers';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({totalDocuments:0,documentsThisMonth:0,totalChatSessions:0,chatSessionsThisWeek:0,averageComplexityReduction:0,timesSaved:0});
  const [recentDocuments, setRecentDocuments] = useState<Document[]>([]);
  const [recentChats, setRecentChats] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,setError]=useState('');

  useEffect(() => {
    Promise.all([apiService.getDocuments(),apiService.getChatSessions()]).then(([documents,chats])=>{
      setRecentDocuments(documents.slice(-5).reverse());setRecentChats(chats.slice(-5).reverse());
      const month=new Date().getMonth();const week=Date.now()-7*86400000;
      setStats({totalDocuments:documents.length,documentsThisMonth:documents.filter(d=>new Date(d.uploadDate).getMonth()===month).length,totalChatSessions:chats.length,chatSessionsThisWeek:chats.filter(c=>new Date(c.createdAt).getTime()>week).length,averageComplexityReduction:0,timesSaved:0});
    }).catch(()=>setError('Could not load activity. Check the backend connection.')).finally(()=>setLoading(false));
  }, []);

  const getStatusColor = (status: Document['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'processing':
        return 'text-yellow-600 bg-yellow-100';
      case 'error':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getComplexityColor = (complexity?: Document['complexity']) => {
    switch (complexity) {
      case 'low':
        return 'text-green-600 bg-green-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'high':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-legal-600"></div>
          <span className="ml-2 text-gray-600">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <p className="mt-2 text-gray-600">
          Overview of your legal document analysis and AI interactions
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <DocumentTextIcon className="h-8 w-8 text-legal-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Documents</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalDocuments}</p>
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-green-600">+{stats.documentsThisMonth} this month</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <ChatBubbleBottomCenterTextIcon className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Chat Sessions</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalChatSessions}</p>
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-green-600">+{stats.chatSessionsThisWeek} this week</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <ArrowTrendingUpIcon className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Complexity Reduced</p>
              <p className="text-2xl font-bold text-gray-900">—</p>
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-gray-500">Average reduction</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <ClockIcon className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Hours Saved</p>
              <p className="text-2xl font-bold text-gray-900">—</p>
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-gray-500">Estimated time saved</span>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Documents */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Recent Documents</h3>
              <Link to="/documents" className="text-sm text-legal-600 hover:text-legal-800">
                View all
              </Link>
            </div>
          </div>
          <div className="p-6">
            {recentDocuments.length === 0 ? (
              <div className="text-center py-6">
                <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">No documents yet</p>
                <Link to="/upload" className="mt-2 text-sm text-legal-600 hover:text-legal-800">
                  Upload your first document
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {recentDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center flex-1 min-w-0">
                      <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-3" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {doc.title}
                        </p>
                        <div className="flex items-center mt-1 space-x-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}>
                            {doc.status}
                          </span>
                          {doc.complexity && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getComplexityColor(doc.complexity)}`}>
                              {doc.complexity}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 ml-4">
                      {formatRelativeTime(doc.uploadDate)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Chats */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Recent Chats</h3>
              <Link to="/chat" className="text-sm text-legal-600 hover:text-legal-800">
                View all
              </Link>
            </div>
          </div>
          <div className="p-6">
            {recentChats.length === 0 ? (
              <div className="text-center py-6">
                <ChatBubbleBottomCenterTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">No chat sessions yet</p>
                <Link to="/chat" className="mt-2 text-sm text-legal-600 hover:text-legal-800">
                  Start your first chat
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {recentChats.map((chat) => (
                  <div key={chat.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center flex-1 min-w-0">
                      <ChatBubbleBottomCenterTextIcon className="h-5 w-5 text-blue-400 mr-3" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {chat.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Updated {formatRelativeTime(chat.updatedAt)}
                        </p>
                      </div>
                    </div>
                    <Link
                      to={`/chat/${chat.id}`}
                      className="text-xs text-legal-600 hover:text-legal-800 ml-4"
                    >
                      Continue
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-legal-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-legal-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/upload"
            className="flex items-center p-4 bg-white rounded-lg shadow-sm border border-legal-200 hover:border-legal-300 transition-colors"
          >
            <DocumentTextIcon className="h-6 w-6 text-legal-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-legal-900">Upload Document</p>
              <p className="text-xs text-legal-600">Add a new legal document</p>
            </div>
          </Link>
          
          <Link
            to="/chat"
            className="flex items-center p-4 bg-white rounded-lg shadow-sm border border-legal-200 hover:border-legal-300 transition-colors"
          >
            <ChatBubbleBottomCenterTextIcon className="h-6 w-6 text-legal-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-legal-900">Start Chat</p>
              <p className="text-xs text-legal-600">Ask legal questions</p>
            </div>
          </Link>
          
          <Link
            to="/search"
            className="flex items-center p-4 bg-white rounded-lg shadow-sm border border-legal-200 hover:border-legal-300 transition-colors"
          >
            <MagnifyingGlassIcon className="h-6 w-6 text-legal-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-legal-900">Search Documents</p>
              <p className="text-xs text-legal-600">Find relevant legal content</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 