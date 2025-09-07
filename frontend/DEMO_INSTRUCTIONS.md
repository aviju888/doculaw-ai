# DocuLaw AI - Demo Instructions

This is a **DEMO VERSION** of DocuLaw AI with mock authentication and data. No real backend is required.

## Quick Start

1. **Install dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm start
   ```

3. **Access the application:**
   Open [http://localhost:3000](http://localhost:3000) in your browser

## Demo Login Credentials

### Quick Login Options:

1. **🎭 Quick Demo Login Button** - Click the blue "Quick Demo Login" button on the sign-in page for instant access
2. **🚀 Demo Onboarding Walkthrough** - Click the green "Demo Onboarding Walkthrough" button to experience the new user setup process
3. **Manual Login** - Use these credentials:
   - **Email:** `demo@doculaw.ai`
   - **Password:** `demo123`

### Alternative Demo Accounts:
- **Legal Expert:** `lawyer@doculaw.ai` / `lawyer123`
- **Law Student:** `student@doculaw.ai` / `student123`

> **Note:** The demo authentication is very permissive - any email with a password of 3+ characters will work, defaulting to the demo user account.

## Demo Features

### 🔐 Authentication
- Mock sign-in/sign-up system
- Persistent sessions using localStorage
- Protected routes and navigation

### 📄 Document Management
- **Pre-loaded sample documents:**
  - Employment Contract Analysis
  - Rental Agreement Simplified
  - Privacy Policy Breakdown
- Upload simulation (files are processed with mock AI)
- Document viewer with original/simplified comparison
- Document workspace for detailed analysis

### 💬 AI Chat Assistant
- **Pre-loaded conversations** for sample documents
- Mock AI responses to new questions
- Document-specific chat sessions
- Legal concept explanations

### 🔍 Search & Discovery
- Document search functionality
- Legal concept identification
- Related document suggestions

### 📊 Dashboard & Analytics
- User activity overview
- Document processing statistics
- Learning progress tracking

## Demo Flow Walkthrough

### Option A: Quick Demo (Experienced Users)
1. **Landing Page** - Start at the homepage
2. **Quick Demo Login** - Click "🎭 Quick Demo Login" button
3. **Dashboard** - View your legal document overview
4. **Documents** - Browse pre-loaded sample documents
5. **Document Viewer** - Compare original vs simplified versions
6. **Chat** - Ask questions about documents to the AI assistant
7. **Upload** - Try uploading a document (mock processing)
8. **Search** - Search through your document library

### Option B: Full Onboarding Experience (New Users)
1. **Landing Page** - Start at the homepage  
2. **Demo Onboarding** - Click "🚀 Demo Onboarding Walkthrough" button
3. **User Setup** - Experience the 6-step onboarding process:
   - Welcome & basic info (pre-filled with "Alex Demo")
   - English proficiency assessment (pre-selected: Intermediate)
   - Legal experience level (pre-selected: Some experience)
   - Document needs selection (pre-selected: Rental, Employment, Insurance)
   - Reading & communication preferences (pre-selected: Standard & Visual)
   - Profile completion summary
4. **Dashboard** - Redirected to personalized dashboard
5. **Continue exploring** - All features available with personalized settings

## Technical Notes

### Mock Data
- All data is stored in memory and localStorage
- No real API calls are made
- Document processing is simulated
- AI responses are pre-scripted or templated

### Demo Mode Detection
The app automatically detects demo mode when:
- No `REACT_APP_API_BASE_URL` environment variable is set
- `REACT_APP_DEMO_MODE=true` is explicitly set

### File Structure
- `src/services/dataService.ts` - Mock authentication and data services
- `src/services/api.ts` - API service with demo mode fallbacks
- `src/contexts/AuthContext.tsx` - Authentication context with mock support

## Limitations

This is a **frontend-only demo**:
- No real document processing or AI analysis
- No persistent data storage
- No real user management
- No actual legal research capabilities
- Chat responses are mock/templated

## For Production

To transition to production:
1. Set up the real backend API
2. Configure `REACT_APP_API_BASE_URL`
3. Set `REACT_APP_DEMO_MODE=false`
4. Replace mock services with real API integrations
5. Implement proper authentication (Supabase/Auth0)

---

**Enjoy exploring DocuLaw AI!** 🎭✨
