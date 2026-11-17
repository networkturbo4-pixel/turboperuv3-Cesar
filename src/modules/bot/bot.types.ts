export type BotChannel = "whatsapp" | "facebook" | "instagram";

export type BotConversationMode = "bot" | "human" | "paused";

export interface BusinessHoursConfig {
  timezone: string;
  days: number[]; // 0=Domingo .. 6=Sábado
  start: string;  // "08:00"
  end: string;    // "20:00"
  holidays: string[]; // ["2026-12-25"]
}

export interface BotSettings {
  tenantId: string;
  enabled: boolean;
  channels: BotChannel[];
  botName: string;
  personaPrompt: string;
  businessHours: BusinessHoursConfig;
  outOfHoursMessage: string;
  handoffKeywords: string[];
  humanPauseMinutes: number;
  debounceMs: number;
  maxRepliesPerHour: number;
  dailyTokenBudget: number;
  aiEnabled: boolean;
  updatedAt?: string;
}

export interface BotConversationState {
  conversationId: number;
  tenantId: string;
  mode: BotConversationMode;
  pausedUntil: string | null;
  customerId: number | null;
  verified: boolean;
  pendingFlow: string;
  failedAttempts: number;
  lastInteractionId: string;
  updatedAt?: string;
}

export interface BotMessageRecord {
  id: number;
  senderType: string;
  senderName: string;
  body: string;
  mediaType: string;
  mediaUrl?: string;
  mediaMimetype?: string;
  createdAt: string;
}

export interface BotCustomerSummary {
  id: number;
  customerCode: string;
  fullName: string;
  identification: string;
  phone: string;
  address: string;
  status: string;
}

export interface BotContext {
  tenantId: string;
  conversation: {
    id: number;
    channel: BotChannel;
    contactName: string;
    contactHandle: string;
  };
  state: BotConversationState;
  customer: BotCustomerSummary | null;
  recentMessages: BotMessageRecord[];
  latestUserText: string;
  latestUserMessageId: number | null;
  latestUserMediaType?: string;
  latestUserMediaUrl?: string;
  latestUserMediaMimetype?: string;
}

export type BotRunPath = "rule" | "ai" | "handoff" | "skipped" | "out_of_hours";

export interface BotDecision {
  path: BotRunPath;
  text: string;
  intent: string;
  toolsUsed: string[];
  tokens: number;
  handoff?: boolean;
  reason?: string;
  setPendingFlow?: string;
  verifiedCustomerId?: number;
}

export interface KnowledgeArticle {
  id: number;
  tenantId: string;
  title: string;
  category: string;
  content: string;
  keywords: string[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface KnowledgeSearchHit {
  articleId: number;
  title: string;
  category: string;
  chunkText: string;
  score: number;
}

export interface BotToolContext {
  tenantId: string;
  conversationId: number;
  verifiedCustomer: BotCustomerSummary | null;
  setPendingFlow: (flow: string) => void;
  requestHandoff: (reason: string) => void;
}

export interface BotToolDefinition {
  name: string;
  description: string;
  requiresVerifiedCustomer?: boolean;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
  execute: (args: Record<string, any>, ctx: BotToolContext) => Promise<Record<string, any>>;
}
