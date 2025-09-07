import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  ChatBubbleBottomCenterTextIcon,
  DocumentTextIcon,
  UserIcon,
  SparklesIcon,
  PaperAirplaneIcon,
  EyeIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { Document, ChatMessage } from '../types';
import { formatDate } from '../utils/helpers';
import ScrollIndicator from '../components/ScrollIndicator';
import { documentService, chatService, type DocumentData, type ChatMessageData } from '../services/dataService';

// Mock document data - replace with actual API call
const mockDocument: Document = {
  id: '1',
  title: 'Employment Contract - Tech Company',
  originalContent: `EMPLOYMENT AGREEMENT

This Employment Agreement ("Agreement") is entered into as of [DATE], between [COMPANY NAME], a Delaware corporation ("Company"), and [EMPLOYEE NAME], an individual ("Employee").

WHEREAS, Company desires to employ Employee on the terms and conditions set forth herein; and
WHEREAS, Employee desires to be employed by Company on such terms and conditions;

NOW, THEREFORE, in consideration of the mutual covenants and agreements contained herein, and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the parties agree as follows:

1. EMPLOYMENT AND DUTIES
Employee shall serve as [POSITION TITLE] and shall have such powers, duties, and responsibilities as may be prescribed by Company's Board of Directors or Chief Executive Officer. Employee agrees to devote Employee's full business time and attention to the performance of Employee's duties hereunder.

2. TERM
This Agreement shall commence on [START DATE] and shall continue until terminated in accordance with the provisions hereof.

3. COMPENSATION
As compensation for Employee's services hereunder, Company shall pay Employee a base salary of $[AMOUNT] per annum, payable in accordance with Company's regular payroll practices.

4. CONFIDENTIALITY
Employee acknowledges that Employee may have access to certain confidential and proprietary information of Company. Employee agrees to maintain the confidentiality of such information and not to disclose it to any third party.

5. TERMINATION
This Agreement may be terminated by either party upon thirty (30) days written notice to the other party. Upon termination, Employee shall return all Company property and cease all activities on behalf of the Company.`,
  
  simplifiedContent: `EMPLOYMENT AGREEMENT - SIMPLIFIED VERSION

This is an employment contract between you and the company.

KEY POINTS:

What this contract is about:
• The company wants to hire you for a specific job
• You want to work for the company
• This contract explains the rules for your employment

Your Job (Section 1):
• You will work as [POSITION TITLE]
• Your boss and the company's leaders will tell you what to do
• You need to focus all your work time on this job

How Long This Lasts (Section 2):
• Your job starts on [START DATE]
• It continues until either you quit or the company lets you go (following the rules in this contract)

Your Pay (Section 3):
• The company will pay you $[AMOUNT] per year
• You'll get paid according to the company's normal schedule (like every two weeks)

Keeping Secrets (Section 4):
• You might learn company secrets while working
• You cannot tell these secrets to anyone outside the company
• This protects the company's private information

Leaving Your Job (Section 5):
• Either you or the company can end your job
• You both need to give 30 days notice before ending it
• When you leave, you must return anything that belongs to the company
• You must stop doing work for the company

IMPORTANT: This is a simplified explanation. The original legal document contains more details and specific legal terms that may be important for your situation.`,
  
  uploadDate: new Date('2024-01-15'),
  status: 'completed',
  fileType: 'application/pdf',
  fileSize: 2048000,
  summary: 'Employment agreement with standard terms and benefits',
  complexity: 'medium',
};

const mockMessages: ChatMessage[] = [
  {
    id: '1',
    content: `Hi! I can help you understand this employment contract. I've analyzed the document and can explain any section in simple terms. What would you like to know?`,
    sender: 'ai',
    timestamp: new Date(),
  },
];

const DocumentWorkspace: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullscreenView, setFullscreenView] = useState<'none' | 'original' | 'simplified'>('none');
  const [chatOpen, setChatOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>(mockMessages);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoadingResponse, setIsLoadingResponse] = useState(false);
  const [scrollPercentage, setScrollPercentage] = useState(0);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  
  // Refs for synchronized scrolling
  const originalContentRef = useRef<HTMLDivElement>(null);
  const simplifiedContentRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);

  // Load document data
  useEffect(() => {
    const loadDocument = async () => {
      if (!id) return;
      
      try {
        const { document, error } = await documentService.getDocument(id);
        
        if (error) {
          console.error('Error loading document:', error);
        } else if (document) {
          setDocument(document);
        }
      } catch (err) {
        console.error('Error loading document:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [id]);

  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Synchronized scrolling functionality
  const handleScroll = useCallback((source: 'original' | 'simplified') => {
    if (isScrolling.current || fullscreenView !== 'none') return;
    
    isScrolling.current = true;
    setShowScrollIndicator(true);
    
    const sourceRef = source === 'original' ? originalContentRef : simplifiedContentRef;
    const targetRef = source === 'original' ? simplifiedContentRef : originalContentRef;
    
    if (sourceRef.current && targetRef.current) {
      const currentScrollPercentage = sourceRef.current.scrollTop / 
        (sourceRef.current.scrollHeight - sourceRef.current.clientHeight);
      
      setScrollPercentage(currentScrollPercentage * 100);
      
      targetRef.current.scrollTop = currentScrollPercentage * 
        (targetRef.current.scrollHeight - targetRef.current.clientHeight);
    }
    
    // Hide scroll indicator after a delay
    setTimeout(() => {
      setShowScrollIndicator(false);
    }, 1000);
    
    setTimeout(() => {
      isScrolling.current = false;
    }, 100);
  }, [fullscreenView]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoadingResponse) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: 'user',
      timestamp: new Date(),
      documentId: document?.id,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoadingResponse(true);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: generateMockResponse(inputMessage),
        sender: 'ai',
        timestamp: new Date(),
        documentId: document?.id,
        references: [
          {
            id: document?.id || '',
            title: document?.title || '',
            relevantSection: 'Section 4: Confidentiality',
            confidence: 0.85,
          }
        ],
      };
      
      setMessages(prev => [...prev, aiResponse]);
      setIsLoadingResponse(false);
    }, 1500);
  };

  const generateMockResponse = (question: string): string => {
    const lowerQuestion = question.toLowerCase();
    
    if (lowerQuestion.includes('confidentiality') || lowerQuestion.includes('secret')) {
      return `Great question about confidentiality! In Section 4 of your contract, this means:

**Key Points:**
• You cannot share the company's private business information
• This includes trade secrets, client lists, financial data
• The obligation continues even after you leave
• Breaking confidentiality can result in legal action

**In Simple Terms:**
Think of it like keeping a friend's secret - but with legal consequences. The company trusts you with sensitive information to do your job.`;
    }
    
    if (lowerQuestion.includes('terminate') || lowerQuestion.includes('fired') || lowerQuestion.includes('leave')) {
      return `Looking at Section 5 (Termination) in your contract:

**How Employment Can End:**
• Either you or the company can end the relationship
• Both parties must give 30 days written notice
• When you leave, return all company property
• You must stop all work activities for the company

**What This Means:**
You have protection - they can't just fire you immediately without notice (unless for serious misconduct). You also can't just quit without giving notice.`;
    }
    
    return `I can help explain that part of your contract! Based on your question about "${question}", here's what you should know:

This relates to the standard employment terms that protect both you and the company. Each section has specific legal implications for your working relationship.

Would you like me to point you to the specific section that covers this, or explain any particular terms in more detail?`;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-legal-600"></div>
        <span className="ml-2 text-gray-600">Loading document...</span>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Document not found</h2>
          <p className="mt-2 text-gray-600">The document you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/documents')}
            className="mt-4 btn-primary"
          >
            Back to Documents
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/documents')}
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Back to Documents
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{document.title}</h1>
              <p className="text-sm text-gray-500">Uploaded {document.createdAt ? formatDate(document.createdAt) : 'Unknown date'}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Fullscreen controls */}
            {fullscreenView === 'none' && (
              <>
                <button
                  onClick={() => setFullscreenView('original')}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                  title="Fullscreen Original"
                >
                  <ArrowsPointingOutIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setFullscreenView('simplified')}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                  title="Fullscreen Simplified"
                >
                  <EyeIcon className="h-5 w-5" />
                </button>
              </>
            )}
            
            {fullscreenView !== 'none' && (
              <button
                onClick={() => setFullscreenView('none')}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                title="Exit Fullscreen"
              >
                <ArrowsPointingInIcon className="h-5 w-5" />
              </button>
            )}
            
            {/* Chat toggle */}
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className={`p-2 rounded-lg ${chatOpen ? 'bg-legal-100 text-legal-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
              title="Toggle Chat"
            >
              <ChatBubbleBottomCenterTextIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Document Viewing Area */}
        <div className={`flex-1 flex ${chatOpen ? 'mr-80' : ''} transition-all duration-300`}>
          {fullscreenView === 'none' && (
            <>
              {/* Original Document */}
              <div className="flex-1 flex flex-col border-r border-gray-200 relative">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700">Original Document</h3>
                </div>
                <div
                  ref={originalContentRef}
                  className="flex-1 overflow-y-auto p-6 relative"
                  onScroll={() => handleScroll('original')}
                >
                  <ScrollIndicator 
                    scrollPercentage={scrollPercentage} 
                    isVisible={showScrollIndicator && fullscreenView === 'none'} 
                  />
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <pre className="whitespace-pre-wrap text-sm text-gray-900 font-mono leading-relaxed">
                      {document.originalContent}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Simplified Document */}
              <div className="flex-1 flex flex-col relative">
                <div className="bg-legal-50 px-4 py-2 border-b border-gray-200">
                  <h3 className="text-sm font-medium text-legal-700">Simplified Version</h3>
                </div>
                <div
                  ref={simplifiedContentRef}
                  className="flex-1 overflow-y-auto p-6 relative"
                  onScroll={() => handleScroll('simplified')}
                >
                  <ScrollIndicator 
                    scrollPercentage={scrollPercentage} 
                    isVisible={showScrollIndicator && fullscreenView === 'none'} 
                  />
                  <div className="bg-white rounded-lg shadow-sm border border-legal-200 p-6">
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-sm text-gray-900 leading-relaxed">
                        {document.simplifiedContent}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Fullscreen Original */}
          {fullscreenView === 'original' && (
            <div className="flex-1 flex flex-col">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h3 className="text-sm font-medium text-gray-700">Original Document (Fullscreen)</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-4xl mx-auto">
                  <pre className="whitespace-pre-wrap text-base text-gray-900 font-mono leading-relaxed">
                    {document.originalContent}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Fullscreen Simplified */}
          {fullscreenView === 'simplified' && (
            <div className="flex-1 flex flex-col">
              <div className="bg-legal-50 px-4 py-2 border-b border-gray-200">
                <h3 className="text-sm font-medium text-legal-700">Simplified Version (Fullscreen)</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="bg-white rounded-lg shadow-sm border border-legal-200 p-6 max-w-4xl mx-auto">
                  <div className="prose max-w-none">
                    <pre className="whitespace-pre-wrap text-base text-gray-900 leading-relaxed">
                      {document.simplifiedContent}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chat Sidebar */}
        {chatOpen && (
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col fixed right-0 top-16 bottom-0 z-30">
            {/* Chat Header */}
            <div className="flex-shrink-0 bg-legal-50 px-4 py-3 border-b border-legal-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-legal-700">Document Chat</h3>
                <button
                  onClick={() => setChatOpen(false)}
                  className="p-1 text-legal-400 hover:text-legal-600"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-legal-600 mt-1">Ask questions about this document</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start space-x-2 max-w-[85%] ${message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                      message.sender === 'user' ? 'bg-legal-100' : 'bg-blue-100'
                    }`}>
                      {message.sender === 'user' ? (
                        <UserIcon className="h-4 w-4 text-legal-600" />
                      ) : (
                        <SparklesIcon className="h-4 w-4 text-blue-600" />
                      )}
                    </div>
                    
                    <div className={`flex-1 ${message.sender === 'user' ? 'text-right' : ''}`}>
                      <div className={`inline-block p-3 rounded-lg text-sm ${
                        message.sender === 'user'
                          ? 'bg-legal-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}>
                        <div className="whitespace-pre-wrap leading-relaxed">
                          {message.content}
                        </div>
                      </div>
                      
                      {/* References */}
                      {message.references && (
                        <div className="mt-2">
                          {message.references.map((ref, index) => (
                            <div key={index} className="bg-legal-50 rounded-lg p-2 border border-legal-200">
                              <div className="flex items-center">
                                <DocumentTextIcon className="h-3 w-3 text-legal-600 mr-1 flex-shrink-0" />
                                <span className="text-xs font-medium text-legal-900 truncate">{ref.relevantSection}</span>
                              </div>
                              <div className="text-xs text-legal-600 mt-1">
                                {Math.round(ref.confidence * 100)}% relevance
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className={`text-xs text-gray-500 mt-1 ${
                        message.sender === 'user' ? 'text-right' : 'text-left'
                      }`}>
                        {formatDate(message.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Loading indicator */}
              {isLoadingResponse && (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-2 max-w-[85%]">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-blue-100">
                      <SparklesIcon className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="bg-gray-100 rounded-lg p-3">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="flex-shrink-0 border-t border-gray-200 p-4">
              <div className="flex space-x-2">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about this document..."
                  className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-legal-500 focus:border-legal-500"
                  rows={2}
                  disabled={isLoadingResponse}
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || isLoadingResponse}
                  className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-legal-600 text-white hover:bg-legal-700 focus:outline-none focus:ring-2 focus:ring-legal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PaperAirplaneIcon className="h-4 w-4" />
                </button>
              </div>
              
              {/* Quick suggestions */}
              <div className="mt-2">
                <div className="flex flex-wrap gap-1">
                  {[
                    "Explain confidentiality",
                    "Termination terms",
                    "My rights"
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInputMessage(suggestion)}
                      className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-full transition-colors"
                      disabled={isLoadingResponse}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentWorkspace; 