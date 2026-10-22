import apiService from '../services/api';
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  PaperAirplaneIcon,
  DocumentTextIcon,
  UserIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { ChatMessage, ChatSession } from '../types';
import { formatDate } from '../utils/helpers';

const Chat: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get('document');
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState('');
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState<ChatSession | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setMessages([]);setSession(null);
    if(sessionId) apiService.getChatSession(sessionId).then(s=>{setSession(s);setMessages(s.messages)}).catch(()=>setError('Could not load this chat.'));
  },[sessionId]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: 'user',
      timestamp: new Date(),
      documentId: documentId || undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    setError('');
    try {
      const current=session || await apiService.createChatSession();
      setSession(current);
      const reply=await apiService.sendMessage(current.id,userMessage.content,documentId || undefined);
      setMessages(prev=>[...prev,reply]);
    }catch {setError('The assistant could not answer. Check the backend provider configuration or use the new workspace for rule-based reading.');}
    finally{setIsLoading(false);}
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="h-full flex flex-col overflow-x-hidden">
      {error && <p role="alert" className="px-4 text-red-700">{error}</p>}
      <div className="mb-4 sm:mb-6 px-4 sm:px-6 lg:px-8">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Legal AI Assistant</h1>
        <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
          Ask questions about legal documents and get clear, helpful explanations
        </p>
      </div>

      {/* Chat Container */}
      <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col mx-4 sm:mx-6 lg:mx-8" style={{ minHeight: '60vh' }}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex items-start space-x-2 sm:space-x-3 max-w-[85%] sm:max-w-3xl ${message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                <div className={`flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
                  message.sender === 'user' 
                    ? 'bg-legal-100' 
                    : 'bg-blue-100'
                }`}>
                  {message.sender === 'user' ? (
                    <UserIcon className="h-3 w-3 sm:h-5 sm:w-5 text-legal-600" />
                  ) : (
                    <SparklesIcon className="h-3 w-3 sm:h-5 sm:w-5 text-blue-600" />
                  )}
                </div>
                
                <div className={`flex-1 ${message.sender === 'user' ? 'text-right' : ''}`}>
                  <div className={`inline-block p-2 sm:p-3 rounded-lg ${
                    message.sender === 'user'
                      ? 'bg-legal-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}>
                    <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                      {message.content}
                    </div>
                  </div>
                  
                  {/* References */}
                  {message.references && (
                    <div className="mt-2 space-y-2">
                      {message.references.map((ref, index) => (
                        <div key={index} className="bg-legal-50 rounded-lg p-2 sm:p-3 border border-legal-200">
                          <div className="flex items-center">
                            <DocumentTextIcon className="h-3 w-3 sm:h-4 sm:w-4 text-legal-600 mr-1 sm:mr-2 flex-shrink-0" />
                            <span className="text-xs sm:text-sm font-medium text-legal-900 truncate">{ref.title}</span>
                          </div>
                          <p className="text-xs text-legal-700 mt-1">{ref.relevantSection}</p>
                          <div className="text-xs text-legal-600 mt-1">
                            {Math.round(ref.confidence * 100)}% relevance
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Timestamp */}
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
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-start space-x-2 sm:space-x-3 max-w-[85%] sm:max-w-3xl">
                <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-blue-100">
                  <SparklesIcon className="h-3 w-3 sm:h-5 sm:w-5 text-blue-600" />
                </div>
                <div className="bg-gray-100 rounded-lg p-2 sm:p-3">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 p-3 sm:p-4">
          <div className="flex space-x-2 sm:space-x-3">
            <div className="flex-1">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask a question about legal terms, document clauses, or legal concepts..."
                className="w-full resize-none border border-gray-300 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-legal-500 focus:border-legal-500"
                rows={2}
                disabled={isLoading}
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-legal-600 text-white hover:bg-legal-700 focus:outline-none focus:ring-2 focus:ring-legal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PaperAirplaneIcon className="h-3 w-3 sm:h-5 sm:w-5" />
            </button>
          </div>
          
          {/* Suggestions */}
          <div className="mt-2 sm:mt-3">
            <p className="text-xs text-gray-500 mb-1 sm:mb-2">Suggested questions:</p>
            <div className="flex flex-wrap gap-1 sm:gap-2">
              {[
                "What does this confidentiality clause mean?",
                "Can I be fired without notice?",
                "What are my rights as an employee?",
                "Explain the termination section",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInputMessage(suggestion)}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 sm:px-3 py-1 rounded-full transition-colors truncate max-w-full"
                  disabled={isLoading}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat; 