# Ascendia Project Overview

## Project Mission and Vision

### Core Mission
Ascendia is a **Personalized Voice Agent (PVA)** that revolutionizes AI-assisted writing by learning and adapting to each user's natural, unpolished writing style. The primary objective is to provide content that is grammatically correct and professionally polished while preserving the authentic human voice and personality of the writer.

### Vision Statement
To create the most intuitive and adaptive writing assistant that feels like a natural extension of the user's own thought process, eliminating the generic, robotic tone typical of traditional AI writing tools.

### Core Objective
**Maximize the user's approval rate on the Adaptive Polish Draft**, indicating successful Content Polish Level (CPL) alignment and preservation of personal writing voice.

## Product Requirements

### Two-Draft Generation System

#### Draft 1: Grammar Fix Only
- **Purpose**: Minimal intervention to correct only grammatical errors
- **Approach**:
  - Fix spelling mistakes and syntax errors
  - Preserve original sentence structure and vocabulary
  - Maintain punctuation style preferences
  - No stylistic changes or voice alterations

#### Draft 2: Adaptive Polish (CPL-Tuned)
- **Purpose**: Intelligent content enhancement based on user's CPL profile
- **Approach**:
  - Apply personalized polish level constraints
  - Enhance clarity while preserving voice
  - Adapt complexity to user's preferred style
  - Balance professionalism with authenticity

### Content Polish Level (CPL) Scoring System

#### CPL Components
1. **Lexical Diversity (TTR - Type-Token Ratio)**
   - Measures vocabulary richness
   - Range: 0.0 (repetitive) to 1.0 (highly diverse)

2. **Sentence Complexity**
   - Average sentence length and structure variety
   - Simple vs. complex sentence preferences

3. **Formality Level**
   - Professional vs. casual tone preferences
   - Technical terminology usage patterns

4. **Coherence and Flow**
   - Transition usage and logical progression
   - Paragraph structure preferences

#### CPL Score Calculation
```
CPL Score = (Lexical Diversity × 0.3) +
            (Sentence Complexity × 0.25) +
            (Formality Level × 0.25) +
            (Coherence × 0.2)

Final Score: 0-100 scale
```

### Real-Time Streaming Responses
- **Server-Sent Events (SSE)** for token-by-token streaming
- **Progressive UI updates** during AI processing
- **Graceful error handling** with fallback mechanisms
- **Cost optimization** through semantic caching

### User Authentication and Security
- **Google OAuth** for quick onboarding
- **Email/Password** authentication with verification
- **Row-Level Security (RLS)** on all database tables
- **API key protection** through Server Actions only

## User Experience Flow

### 1. User Onboarding
```
Registration → Email Verification → Welcome Tutorial →
Initial CPL Calibration → First Conversation
```

#### Initial CPL Calibration
- User provides 2-3 writing samples
- System calculates baseline CPL score
- Establishes initial preference profile

### 2. Core User Journey
```
Login → Dashboard → Create/Select Conversation →
Input Text → Category Selection → Generate Drafts →
Review Drafts → Accept/Modify → System Learning
```

#### Conversation Management
- **Create New**: Start fresh conversation with context
- **Continue Existing**: Resume previous conversation thread
- **Archive/Delete**: Manage conversation history
- **Category Assignment**: Email, Letter, Proposal, Memo

### 3. Draft Generation Process
```
Raw Input → Pre-Processing → AI Generation →
Post-Processing → Sanitation → Two-Draft Output
```

#### Input Processing
1. **Validation**: Length, content type, safety checks
2. **Context Integration**: Conversation history and user preferences
3. **Category Constraints**: Apply category-specific guidelines

#### Output Generation
1. **Parallel Processing**: Generate both drafts simultaneously
2. **CPL Application**: Apply user's adaptive constraints
3. **Quality Assurance**: Final sanitation and validation

### 4. Learning Loop Implementation
```
User Acceptance → CPL Recalculation →
Preference Update → Model Fine-tuning
```

#### Feedback Mechanisms
- **Draft Acceptance**: Binary feedback (accept/reject)
- **Manual Edits**: Track user modifications to drafts
- **Preference Signals**: Implicit learning from usage patterns
- **Explicit Feedback**: Optional rating system

## Business Logic

### CPL Calculation Methodology

#### Real-Time Adaptation Algorithm
```typescript
function adaptCPL(userHistory: Draft[], newFeedback: Feedback): number {
  const recentDrafts = userHistory.slice(-10) // Last 10 drafts
  const acceptanceRate = calculateAcceptanceRate(recentDrafts)
  const editPatterns = analyzeEditPatterns(recentDrafts)

  let adjustment = 0

  // Increase complexity if consistently accepted
  if (acceptanceRate > 0.8) adjustment += 5

  // Decrease complexity if frequently rejected
  if (acceptanceRate < 0.4) adjustment -= 5

  // Fine-tune based on edit patterns
  adjustment += analyzeEditComplexity(editPatterns)

  return Math.max(0, Math.min(100, currentCPL + adjustment))
}
```

#### User Preference Learning
- **Implicit Learning**: Track acceptance patterns, edit frequency, time spent reviewing
- **Explicit Learning**: Direct feedback on draft quality and style preferences
- **Contextual Learning**: Different CPL scores for different content categories

### Content Categorization System

#### Category Types
1. **Email** - Professional correspondence, varying formality levels
2. **Letter** - Personal or formal letters, tone adaptation
3. **Proposal** - Business proposals, technical documentation
4. **Memo** - Internal communications, brevity and clarity focus

#### Category-Specific Rules
```typescript
const categoryConstraints = {
  email: {
    maxLength: 500,
    formalityRange: [0.4, 0.9],
    structureRequirements: ['greeting', 'body', 'closing']
  },
  proposal: {
    maxLength: 2000,
    formalityRange: [0.7, 1.0],
    structureRequirements: ['executive_summary', 'details', 'conclusion']
  }
}
```

## Success Metrics

### Primary Success Indicators

#### User Approval Rate (Primary KPI)
- **Target**: >85% approval rate on Adaptive Polish drafts
- **Measurement**: Draft acceptance vs. rejection ratio
- **Timeframe**: Rolling 30-day average

#### CPL Accuracy Score
- **Target**: <10% deviation between predicted and actual user preference
- **Measurement**: Difference between system CPL prediction and user edits
- **Timeframe**: Continuous measurement with weekly reporting

### User Engagement Metrics

#### Daily Active Users (DAU)
- **Target**: Steady month-over-month growth
- **Benchmark**: Industry standard for productivity tools

#### Session Metrics
- **Average Session Duration**: Target >8 minutes
- **Drafts per Session**: Target >3 drafts
- **Return User Rate**: Target >70% weekly return rate

#### Retention Metrics
- **7-Day Retention**: Target >60%
- **30-Day Retention**: Target >40%
- **90-Day Retention**: Target >25%

### Performance Benchmarks

#### Response Time Metrics
- **First Token Time**: <800ms (target <500ms)
- **Full Response Time**: <5 seconds for 200-word input
- **System Availability**: 99.9% uptime

#### Quality Metrics
- **Grammar Accuracy**: >99% for Draft 1 (Grammar Fix)
- **Style Preservation**: Measured through user satisfaction surveys
- **Content Coherence**: Automated scoring + user feedback

### Business Impact Indicators

#### Cost Efficiency
- **API Cost per User**: Target reduction through caching and optimization
- **Support Ticket Volume**: Target <5% of active users per month
- **User Acquisition Cost**: Track through referral and organic growth

#### User Satisfaction
- **Net Promoter Score (NPS)**: Target >50
- **User Satisfaction Score**: Target >4.5/5.0
- **Feature Adoption Rate**: Track usage of advanced features

## Key Performance Indicators (KPIs)

### Technical KPIs
- **API Response Time**: P95 <2 seconds
- **Error Rate**: <1% of all requests
- **Cache Hit Rate**: >60% for repeat queries
- **Database Query Performance**: P95 <100ms

### Product KPIs
- **Feature Utilization**: Track usage of each core feature
- **Conversion Rate**: Free to premium upgrade rate
- **Churn Rate**: Target <5% monthly churn

### User Experience KPIs
- **Time to First Value**: <2 minutes from registration
- **Learning Curve**: Users should see improved results within 5 sessions
- **Support Resolution**: <24 hours for critical issues

## Risk Assessment and Mitigation

### High-Priority Risks
1. **CPL Accuracy**: Risk of poor personalization leading to user abandonment
   - **Mitigation**: Extensive testing and gradual rollout

2. **API Cost Escalation**: Claude API costs could exceed projections
   - **Mitigation**: Aggressive caching, batch processing, usage limits

3. **User Privacy Concerns**: Storing and learning from user writing patterns
   - **Mitigation**: Transparent privacy policy, data encryption, user control

### Medium-Priority Risks
1. **Scalability Challenges**: System performance under high load
   - **Mitigation**: Load testing, horizontal scaling, performance monitoring

2. **Competition**: Established players entering the market
   - **Mitigation**: Focus on unique personalization features, strong user experience

This project overview serves as the foundational document for understanding Ascendia's mission, requirements, and success criteria. All development decisions should align with these core principles and objectives.