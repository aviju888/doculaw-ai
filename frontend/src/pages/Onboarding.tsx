import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  AcademicCapIcon,
  BookOpenIcon,
  DocumentTextIcon,
  ChatBubbleBottomCenterTextIcon,
  GlobeAltIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { saveUserProfile } from '../utils/helpers';

interface OnboardingData {
  name: string;
  primaryLanguage: string;
  englishProficiency: 'beginner' | 'intermediate' | 'advanced' | '';
  legalExperience: 'none' | 'some' | 'experienced' | '';
  primaryNeeds: string[];
  readingPreference: 'simple' | 'standard' | 'detailed' | '';
  communicationStyle: 'visual' | 'text' | 'audio' | '';
}

const steps = [
  { id: 1, name: 'Welcome', icon: UserIcon },
  { id: 2, name: 'Language Assessment', icon: GlobeAltIcon },
  { id: 3, name: 'Legal Experience', icon: AcademicCapIcon },
  { id: 4, name: 'Your Needs', icon: DocumentTextIcon },
  { id: 5, name: 'Preferences', icon: ChatBubbleBottomCenterTextIcon },
  { id: 6, name: 'Complete', icon: CheckCircleIcon },
];

const proficiencyLevels = [
  {
    level: 'beginner',
    title: 'Basic English',
    description: 'I understand simple words and short sentences',
    example: 'I can read "The dog is big" but struggle with longer text.',
    color: 'from-green-500 to-green-600',
  },
  {
    level: 'intermediate',
    title: 'Conversational English',
    description: 'I can understand everyday conversations and most text',
    example: 'I read news articles but sometimes need help with complex topics.',
    color: 'from-blue-500 to-blue-600',
  },
  {
    level: 'advanced',
    title: 'Fluent English',
    description: 'I understand complex text and formal language well',
    example: 'I can read contracts but legal terms are still confusing.',
    color: 'from-purple-500 to-purple-600',
  },
];

const legalExperienceLevels = [
  {
    level: 'none',
    title: 'New to Legal Documents',
    description: 'I have never read legal documents before',
    icon: '📚',
  },
  {
    level: 'some',
    title: 'Some Experience',
    description: 'I have read a few legal documents but find them confusing',
    icon: '📖',
  },
  {
    level: 'experienced',
    title: 'Experienced',
    description: 'I regularly deal with legal documents but want simpler explanations',
    icon: '⚖️',
  },
];

const commonNeeds = [
  { id: 'rental', label: 'Rental Agreements', icon: '🏠' },
  { id: 'employment', label: 'Employment Contracts', icon: '💼' },
  { id: 'insurance', label: 'Insurance Policies', icon: '🛡️' },
  { id: 'healthcare', label: 'Medical Documents', icon: '🏥' },
  { id: 'government', label: 'Government Forms', icon: '🏛️' },
  { id: 'business', label: 'Business Documents', icon: '📊' },
  { id: 'family', label: 'Family Legal Matters', icon: '👨‍👩‍👧‍👦' },
  { id: 'other', label: 'Other Legal Documents', icon: '📄' },
];

const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    name: '',
    primaryLanguage: '',
    englishProficiency: '',
    legalExperience: '',
    primaryNeeds: [],
    readingPreference: '',
    communicationStyle: '',
  });

  // Demo data for walkthrough
  const demoData: OnboardingData = {
    name: 'Alex Demo',
    primaryLanguage: 'Spanish',
    englishProficiency: 'intermediate',
    legalExperience: 'some',
    primaryNeeds: ['rental', 'employment', 'insurance'],
    readingPreference: 'standard',
    communicationStyle: 'visual',
  };

  // Check if this is a demo walkthrough
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isDemo = urlParams.get('demo') === 'true';
    if (isDemo) {
      setIsDemoMode(true);
      // Pre-fill with demo data but let user go through steps
      setData(demoData);
    }
  }, [demoData]);

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    try {
      // Validate and prepare data for saving
      const profileData = {
        name: data.name,
        primaryLanguage: data.primaryLanguage,
        englishProficiency: data.englishProficiency as 'beginner' | 'intermediate' | 'advanced',
        legalExperience: data.legalExperience as 'none' | 'some' | 'experienced',
        primaryNeeds: data.primaryNeeds,
        readingPreference: data.readingPreference as 'simple' | 'standard' | 'detailed',
        communicationStyle: data.communicationStyle as 'visual' | 'text' | 'audio',
        onboardingCompleted: true,
      };
      
      // Save user profile using our utility function
      const profile = await saveUserProfile(profileData);
      
      console.log('User onboarding completed successfully:', profile);
      
      // Navigate to dashboard
      navigate('/dashboard');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      // Fallback to original localStorage approach
      localStorage.setItem('doculaw_onboarding', JSON.stringify(data));
      localStorage.setItem('doculaw_user_profile', JSON.stringify({
        ...data,
        onboardingCompleted: true,
        dateCompleted: new Date().toISOString(),
      }));
      navigate('/dashboard');
    }
  };

  const updateData = (updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  const toggleNeed = (needId: string) => {
    setData(prev => ({
      ...prev,
      primaryNeeds: prev.primaryNeeds.includes(needId)
        ? prev.primaryNeeds.filter(id => id !== needId)
        : [...prev.primaryNeeds, needId]
    }));
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="text-center max-w-2xl mx-auto">
            <div className="w-16 h-16 bg-gradient-to-r from-legal-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <UserIcon className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Welcome to DocuLaw AI
            </h2>
            <p className="text-lg text-gray-600 mb-6 leading-relaxed">
              We're here to make legal documents easier to understand. Let's start by learning 
              about you so we can provide the best possible assistance.
            </p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="What's your first name?"
                value={data.name}
                onChange={(e) => updateData({ name: e.target.value })}
                className="input-field text-base p-3"
              />
              <input
                type="text"
                placeholder="What's your primary language? (e.g., Spanish, English, etc.)"
                value={data.primaryLanguage}
                onChange={(e) => updateData({ primaryLanguage: e.target.value })}
                className="input-field text-base p-3"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <GlobeAltIcon className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                How comfortable are you with English?
              </h2>
              <p className="text-base text-gray-600">
                This helps us adjust our explanations to match your reading level.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {proficiencyLevels.map((level) => (
                <div
                  key={level.level}
                  onClick={() => updateData({ englishProficiency: level.level as any })}
                  className={`card-elevated p-4 cursor-pointer transition-all duration-300 ${
                    data.englishProficiency === level.level
                      ? 'ring-4 ring-legal-500 scale-105'
                      : 'hover:scale-102'
                  }`}
                >
                  <div className={`w-10 h-10 bg-gradient-to-r ${level.color} rounded-lg flex items-center justify-center mb-3`}>
                    <BookOpenIcon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mb-2">{level.title}</h3>
                  <p className="text-sm text-gray-600 mb-3">{level.description}</p>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-xs text-gray-700 italic">"{level.example}"</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <AcademicCapIcon className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                How much experience do you have with legal documents?
              </h2>
              <p className="text-base text-gray-600">
                This helps us know how much background context to provide.
              </p>
            </div>
            
            <div className="space-y-4">
              {legalExperienceLevels.map((level) => (
                <div
                  key={level.level}
                  onClick={() => updateData({ legalExperience: level.level as any })}
                  className={`card-elevated p-4 cursor-pointer transition-all duration-300 flex items-center ${
                    data.legalExperience === level.level
                      ? 'ring-4 ring-legal-500 scale-102'
                      : 'hover:scale-101'
                  }`}
                >
                  <div className="text-3xl mr-4">{level.icon}</div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{level.title}</h3>
                    <p className="text-sm text-gray-600">{level.description}</p>
                  </div>
                  {data.legalExperience === level.level && (
                    <CheckCircleIcon className="h-6 w-6 text-legal-600" />
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <DocumentTextIcon className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                What types of documents do you need help with?
              </h2>
              <p className="text-base text-gray-600">
                Select all that apply. You can always change this later.
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {commonNeeds.map((need) => (
                <div
                  key={need.id}
                  onClick={() => toggleNeed(need.id)}
                  className={`card-elevated p-3 cursor-pointer transition-all duration-300 text-center ${
                    data.primaryNeeds.includes(need.id)
                      ? 'ring-4 ring-legal-500 bg-legal-50'
                      : 'hover:scale-105'
                  }`}
                >
                  <div className="text-2xl mb-1">{need.icon}</div>
                  <h3 className="text-xs font-medium text-gray-900">{need.label}</h3>
                  {data.primaryNeeds.includes(need.id) && (
                    <CheckCircleIcon className="h-4 w-4 text-legal-600 mx-auto mt-1" />
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <ChatBubbleBottomCenterTextIcon className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                How do you prefer to receive information?
              </h2>
              <p className="text-base text-gray-600 mb-6">
                We'll customize our interface to match your preferences.
              </p>
            </div>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-3">Reading Preference</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { id: 'simple', label: 'Simple & Short', desc: 'Brief explanations with key points' },
                    { id: 'standard', label: 'Standard Detail', desc: 'Balanced explanations with context' },
                    { id: 'detailed', label: 'Comprehensive', desc: 'Full explanations with examples' },
                  ].map((pref) => (
                    <div
                      key={pref.id}
                      onClick={() => updateData({ readingPreference: pref.id as any })}
                      className={`card p-3 cursor-pointer transition-all duration-300 ${
                        data.readingPreference === pref.id
                          ? 'ring-2 ring-legal-500 bg-legal-50'
                          : 'hover:shadow-lg'
                      }`}
                    >
                      <h4 className="font-medium text-gray-900 text-sm">{pref.label}</h4>
                      <p className="text-xs text-gray-600 mt-1">{pref.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-3">Communication Style</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { id: 'visual', label: 'Visual', desc: 'Charts, diagrams, and highlights', icon: '📊' },
                    { id: 'text', label: 'Text-Based', desc: 'Clear written explanations', icon: '📝' },
                    { id: 'audio', label: 'Audio Support', desc: 'Text-to-speech and audio guides', icon: '🔊' },
                  ].map((style) => (
                    <div
                      key={style.id}
                      onClick={() => updateData({ communicationStyle: style.id as any })}
                      className={`card p-3 cursor-pointer transition-all duration-300 ${
                        data.communicationStyle === style.id
                          ? 'ring-2 ring-legal-500 bg-legal-50'
                          : 'hover:shadow-lg'
                      }`}
                    >
                      <div className="text-xl mb-1">{style.icon}</div>
                      <h4 className="font-medium text-gray-900 text-sm">{style.label}</h4>
                      <p className="text-xs text-gray-600 mt-1">{style.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="text-center max-w-2xl mx-auto">
            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircleIcon className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Perfect! You're all set, {data.name}!
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              We've customized DocuLaw AI based on your preferences. You can always 
              update these settings later in your dashboard.
            </p>
            
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <h3 className="text-base font-semibold text-gray-900 mb-3">Your Profile</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
                <div>
                  <span className="text-xs text-gray-600">English Level:</span>
                  <div className="font-medium text-sm capitalize">{data.englishProficiency.replace('_', ' ')}</div>
                </div>
                <div>
                  <span className="text-xs text-gray-600">Legal Experience:</span>
                  <div className="font-medium text-sm capitalize">{data.legalExperience}</div>
                </div>
                <div>
                  <span className="text-xs text-gray-600">Reading Style:</span>
                  <div className="font-medium text-sm capitalize">{data.readingPreference}</div>
                </div>
                <div>
                  <span className="text-xs text-gray-600">Primary Needs:</span>
                  <div className="font-medium text-sm">{data.primaryNeeds.length} selected</div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return data.name.trim() !== '' && data.primaryLanguage.trim() !== '';
      case 2:
        return data.englishProficiency !== '';
      case 3:
        return data.legalExperience !== '';
      case 4:
        return data.primaryNeeds.length > 0;
      case 5:
        return data.readingPreference !== '' && data.communicationStyle !== '';
      case 6:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Progress Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <img src="/assets/logo-mark.svg" alt="DocuLaw AI" className="h-6 w-6" />
              <span className="text-lg font-bold gradient-text">DocuLaw AI</span>
              {isDemoMode && (
                <span className="bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs px-2 py-1 rounded-full">
                  🚀 Demo Walkthrough
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500">
              Step {currentStep} of {steps.length}
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      index + 1 <= currentStep
                        ? 'bg-legal-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {index + 1 <= currentStep ? (
                      <CheckCircleIcon className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-medium">{step.id}</span>
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-12 h-1 mx-2 ${
                        index + 1 < currentStep ? 'bg-legal-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              {steps.map((step) => (
                <span key={step.id} className="text-center">{step.name}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Demo Mode Banner */}
        {isDemoMode && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">🚀</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Demo Walkthrough Active</h3>
                <div className="mt-1 text-sm text-green-700">
                  This form is pre-filled with sample data. Feel free to modify any fields or click through to see the full onboarding experience!
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
          {renderStep()}
        </div>
      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 1}
              className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                currentStep === 1
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Previous
            </button>
            
            {isDemoMode && currentStep < steps.length && (
              <button
                onClick={() => setCurrentStep(steps.length)}
                className="text-sm text-green-600 hover:text-green-700 hover:bg-green-50 px-3 py-1 rounded transition-colors"
              >
                🚀 Skip to End
              </button>
            )}
          </div>
          
          {currentStep < steps.length ? (
            <button
              onClick={handleNext}
              disabled={!isStepValid()}
              className={`flex items-center px-6 py-3 rounded-lg transition-all ${
                isStepValid()
                  ? 'btn-primary'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Next
              <ArrowRightIcon className="h-5 w-5 ml-2" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              className="btn-primary px-8 py-3"
            >
              {isDemoMode ? '🎭 Complete Demo Setup' : 'Complete Setup'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding; 