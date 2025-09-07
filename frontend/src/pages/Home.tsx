import React from 'react';
import { Link } from 'react-router-dom';
import {
  DocumentTextIcon,
  ChatBubbleBottomCenterTextIcon,
  MagnifyingGlassIcon,
  CloudArrowUpIcon,
  ChartBarIcon,
  ArrowRightIcon,
  EllipsisVerticalIcon,
} from '@heroicons/react/24/outline';

const quickActions = [
  {
    name: 'Upload New Document',
    description: 'Get your legal document translated instantly',
    icon: CloudArrowUpIcon,
    href: '/upload',
    color: 'from-blue-500 to-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    name: 'Start New Chat',
    description: 'Ask legal questions and get instant help',
    icon: ChatBubbleBottomCenterTextIcon,
    href: '/chat',
    color: 'from-green-500 to-green-600',
    bgColor: 'bg-green-50',
  },
  {
    name: 'Search Documents',
    description: 'Find specific legal information quickly',
    icon: MagnifyingGlassIcon,
    href: '/search',
    color: 'from-purple-500 to-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    name: 'View Analytics',
    description: 'Track your legal document progress',
    icon: ChartBarIcon,
    href: '/dashboard',
    color: 'from-orange-500 to-orange-600',
    bgColor: 'bg-orange-50',
  },
];

const recentActivity = [
  {
    type: 'document',
    title: 'Rental Agreement Simplified',
    time: '2 hours ago',
    status: 'completed',
    complexity: 'reduced by 75%',
  },
  {
    type: 'chat',
    title: 'Employment Contract Questions',
    time: '1 day ago',
    status: 'active',
    messages: '12 messages',
  },
  {
    type: 'search',
    title: 'Insurance Policy Terms',
    time: '2 days ago',
    status: 'completed',
    results: '8 relevant results',
  },
];

const tips = [
  {
    title: 'Upload Multiple Formats',
    description: 'We support PDF, DOC, DOCX, and TXT files up to 10MB',
    icon: '📄',
  },
  {
    title: 'Ask Follow-up Questions',
    description: 'Our AI remembers context from your documents for better answers',
    icon: '💡',
  },
  {
    title: 'Save Important Sections',
    description: 'Bookmark key parts of simplified documents for quick reference',
    icon: '🔖',
  },
];

const Home: React.FC = () => {
  // Get user profile from localStorage (from onboarding)
  const userProfile = JSON.parse(localStorage.getItem('doculaw_user_profile') || '{}');
  const userName = userProfile.name || 'there';

  return (
    <div className="space-y-6 sm:space-y-8 overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative py-12 sm:py-16 md:py-20 lg:py-28 hero-gradient text-white overflow-hidden mx-4 sm:mx-6 lg:mx-8 rounded-xl">
        <div className="absolute inset-0 bg-black/10 rounded-xl"></div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6">
            Welcome back, {userName}
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-white/90 mb-6 sm:mb-8 max-w-2xl mx-auto">
            Your personalized legal assistant is ready to help you understand complex documents.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center">
            <Link to="/upload" className="btn-primary bg-white text-legal-700 hover:bg-gray-100 text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4">
              Upload Document
            </Link>
            <Link to="/chat" className="btn-ghost text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4">
              Ask Questions
            </Link>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="py-8 sm:py-12 md:py-16 lg:py-24 section-gradient-light mx-4 sm:mx-6 lg:mx-8 rounded-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-700 mb-8 sm:mb-12 text-center">Quick Actions</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {quickActions.map((action, index) => (
              <Link 
                key={action.name} 
                to={action.href}
                className="card-elevated p-4 sm:p-6 lg:p-8 text-center group hover:shadow-gradient-glow transition-all duration-300"
              >
                <div className="bg-blue-600 w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-xl flex items-center justify-center mx-auto mb-3 sm:mb-4 lg:mb-6">
                  <action.icon className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-white" />
                </div>
                <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 mb-2 sm:mb-3 lg:mb-4 group-hover:text-legal-600 transition-colors">
                  {action.name}
                </h3>
                <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4 lg:mb-6">{action.description}</p>
                <div className="flex items-center text-legal-600 font-medium text-sm justify-center">
                  Get Started
                  <ArrowRightIcon className="h-3 w-3 sm:h-4 sm:w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Activity */}
      <section className="py-8 sm:py-12 md:py-16 lg:py-24 section-gradient-subtle mx-4 sm:mx-6 lg:mx-8 rounded-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 sm:mb-12 space-y-2 sm:space-y-0">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-700">Recent Activity</h2>
            <Link to="/documents" className="text-sm sm:text-base text-legal-600 hover:text-legal-700 transition-colors">
              View All →
            </Link>
          </div>
          
          <div className="space-y-4 sm:space-y-6">
            {recentActivity.map((activity, index) => (
              <div key={index} className="card p-4 sm:p-6 lg:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                <div className="flex items-center space-x-3 sm:space-x-6">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ${
                    activity.type === 'document' ? 'bg-blue-600' :
                    activity.type === 'chat' ? 'bg-purple-600' : 'bg-cyan-600'
                  }`}>
                    {activity.type === 'document' ? <DocumentTextIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white" /> :
                     activity.type === 'chat' ? <ChatBubbleBottomCenterTextIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white" /> :
                     <MagnifyingGlassIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />}
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base lg:text-lg font-bold text-gray-900">{activity.title}</h3>
                    <div className="flex flex-col sm:flex-row sm:items-center text-xs sm:text-sm text-gray-600 sm:space-x-4 space-y-1 sm:space-y-0">
                      <span>{activity.time}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>{activity.complexity || activity.messages || activity.results}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between sm:justify-end space-x-3 sm:space-x-4">
                  <span className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                    activity.status === 'completed' ? 'bg-green-100 text-green-800' :
                    activity.status === 'active' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
                  </span>
                  <button className="text-gray-400 hover:text-gray-600">
                    <EllipsisVerticalIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tips & Insights */}
      <section className="py-8 sm:py-12 md:py-16 lg:py-24 section-gradient-light mx-4 sm:mx-6 lg:mx-8 rounded-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-700 mb-8 sm:mb-12 text-center">Tips & Insights</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {tips.map((tip, index) => (
              <div key={index} className="card p-4 sm:p-6 lg:p-8 text-center group hover:shadow-lg transition-all duration-300">
                <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">{tip.icon}</div>
                <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 mb-2 sm:mb-3 group-hover:text-legal-600 transition-colors">
                  {tip.title}
                </h3>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                  {tip.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Overview */}
      <section className="py-8 sm:py-12 md:py-16 lg:py-24 bg-white mx-4 sm:mx-6 lg:mx-8 rounded-xl shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-700 mb-8 sm:mb-12 text-center">Your Progress</h2>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            <div className="text-center">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-blue-700 mb-1 sm:mb-2">-</div>
              <div className="text-xs sm:text-sm text-gray-600">Documents Processed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-blue-700 mb-1 sm:mb-2">-</div>
              <div className="text-xs sm:text-sm text-gray-600">Questions Asked</div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-blue-700 mb-1 sm:mb-2">-</div>
              <div className="text-xs sm:text-sm text-gray-600">Complexity Reduced</div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-blue-700 mb-1 sm:mb-2">-</div>
              <div className="text-xs sm:text-sm text-gray-600">Days Active</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home; 