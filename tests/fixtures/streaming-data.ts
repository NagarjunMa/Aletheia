export const streamingFixtures = {
  // Mock input data
  sampleInputs: {
    casual: 'hey can u help me write an email to my boss about the project delay',
    formal: 'I would like to request assistance with composing a professional email regarding project delays',
    technical: 'The authentication middleware implementation requires optimization for better performance'
  },

  // Mock streaming chunks
  grammarFixChunks: [
    'Hello',
    ', could',
    ' you',
    ' help',
    ' me',
    ' write',
    ' an',
    ' email',
    ' to',
    ' my',
    ' boss',
    ' about',
    ' the',
    ' project',
    ' delay',
    '?'
  ],

  adaptivePolishChunks: [
    'Dear',
    ' [Boss Name]',
    ',\n\n',
    'I am',
    ' writing',
    ' to',
    ' inform',
    ' you',
    ' of',
    ' a',
    ' delay',
    ' in',
    ' the',
    ' project',
    ' timeline',
    '. I',
    ' would',
    ' appreciate',
    ' the',
    ' opportunity',
    ' to',
    ' discuss',
    ' this',
    ' matter',
    ' further',
    ' at',
    ' your',
    ' convenience',
    '.\n\n',
    'Best',
    ' regards'
  ],

  // Mock CPL analysis results
  cplAnalysis: {
    low: {
      overall_score: 25,
      grammar_score: 30,
      clarity_score: 20,
      style_score: 25,
      engagement_score: 20,
      vocabulary_score: 30,
      suggestions: [
        'Use more formal language',
        'Check spelling and grammar',
        'Add punctuation'
      ]
    },
    medium: {
      overall_score: 65,
      grammar_score: 70,
      clarity_score: 65,
      style_score: 60,
      engagement_score: 70,
      vocabulary_score: 60,
      suggestions: [
        'Consider more varied vocabulary',
        'Add transition sentences'
      ]
    },
    high: {
      overall_score: 90,
      grammar_score: 95,
      clarity_score: 90,
      style_score: 85,
      engagement_score: 90,
      vocabulary_score: 90,
      suggestions: [
        'Content is well-structured and professional'
      ]
    }
  },

  // Mock streaming sessions
  streamingSessions: {
    grammar: {
      id: 'session-grammar-1',
      inputId: 'input-1',
      draftType: 'grammar_fix' as const,
      status: 'completed' as const,
      progress: 100,
      stage: 'completed',
      content: 'Hello, could you help me write an email to my boss about the project delay?',
      fullContent: 'Hello, could you help me write an email to my boss about the project delay?'
    },
    polish: {
      id: 'session-polish-1',
      inputId: 'input-1',
      draftType: 'adaptive_polish' as const,
      status: 'completed' as const,
      progress: 100,
      stage: 'completed',
      content: 'Dear [Boss Name], I am writing to inform you of a delay in the project timeline. I would appreciate the opportunity to discuss this matter further at your convenience.\n\nBest regards',
      fullContent: 'Dear [Boss Name], I am writing to inform you of a delay in the project timeline. I would appreciate the opportunity to discuss this matter further at your convenience.\n\nBest regards'
    },
    streaming: {
      id: 'session-streaming-1',
      inputId: 'input-1',
      draftType: 'grammar_fix' as const,
      status: 'streaming' as const,
      progress: 45,
      stage: 'Processing text...',
      content: 'Hello, could you help me',
      fullContent: 'Hello, could you help me'
    }
  },

  // Mock error scenarios
  errors: {
    networkError: new Error('Network request failed'),
    timeoutError: new Error('Request timeout'),
    apiError: new Error('API rate limit exceeded'),
    invalidResponse: new Error('Invalid response format')
  },

  // Mock user inputs
  userInputs: {
    valid: {
      id: 'input-1',
      original_text: 'hey can u help me write an email to my boss about the project delay',
      conversation_id: 'conv-1',
      content_type: 'email' as const,
      target_cpl: 85,
      user_id: 'user-1',
      created_at: '2024-12-08T10:00:00Z',
      processing_status: 'pending' as const
    },
    processed: {
      id: 'input-2',
      original_text: 'I need help with this task',
      conversation_id: 'conv-1',
      content_type: 'message' as const,
      target_cpl: 70,
      user_id: 'user-1',
      created_at: '2024-12-08T11:00:00Z',
      processing_status: 'completed' as const
    }
  },

  // Mock conversations
  conversations: {
    active: {
      id: 'conv-1',
      title: 'Email Assistance',
      description: 'Help with writing professional emails',
      user_id: 'user-1',
      created_at: '2024-12-08T09:00:00Z',
      last_message_at: '2024-12-08T10:30:00Z',
      message_count: 5,
      status: 'active' as const
    },
    archived: {
      id: 'conv-2',
      title: 'Previous Project',
      description: 'Completed project discussion',
      user_id: 'user-1',
      created_at: '2024-12-07T14:00:00Z',
      last_message_at: '2024-12-07T16:00:00Z',
      message_count: 12,
      status: 'archived' as const
    }
  }
}