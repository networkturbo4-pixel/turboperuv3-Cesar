export interface SystemSettings {
  id: number;
  commercial_name: string;
  legal_name: string;
  ruc: string;
  phone: string;
  email: string;
  currency: string;

  btn_bg_light: string;
  btn_text_light: string;
  widget_bg_light: string;
  widget_border_light: string;
  widget_accent_light: string;
  page_bg_light: string;

  btn_bg_dark: string;
  btn_text_dark: string;
  widget_bg_dark: string;
  widget_border_dark: string;
  widget_accent_dark: string;
  page_bg_dark: string;

  toast_style: 'glass' | 'minimal' | 'filled' | 'bordered-accent' | 'pill';
  toast_position: 'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center';
  toast_position_mobile?: 'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center';
  toast_position_tablet?: 'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center';

  modal_style: 'modern-clean' | 'glassmorphism' | 'corporate-bordered' | 'elevated-bold';
  modal_position: 'center' | 'top-center' | 'bottom-sheet' | 'top-right' | 'bottom-right';

  font_family: 'space-grotesk-inter' | 'space-grotesk' | 'inter' | 'plus-jakarta';
  font_scale: 'compact' | 'normal' | 'comfortable' | 'large';

  table_model: 'modern-minimal' | 'striped-corporate' | 'bordered-grid' | 'floating-rows';
  table_responsive_cards: boolean;
  table_card_collapse_threshold: number;

  favicon_url: string;
  pwa_logo_url: string;
  updated_at?: string;
}

export interface ChannelConnections {
  id: number;
  wa_active_mode: 'qr' | 'api';
  wa_qr_status: 'disconnected' | 'awaiting_scan' | 'connected';
  wa_qr_phone: string;
  wa_qr_device: string;
  wa_qr_session_code: string;

  wa_api_status: 'disconnected' | 'connected';
  wa_phone_number_id: string;
  wa_business_account_id: string;
  wa_access_token: string;
  wa_verify_token: string;
  wa_mass_messaging_enabled: boolean;
  wa_chatbot_enabled: boolean;
  wa_chatbot_prompt: string;

  fb_connected: boolean;
  fb_page_name: string;
  fb_page_id: string;
  fb_access_token: string;
  fb_auto_sync: boolean;

  ig_connected: boolean;
  ig_username: string;
  ig_account_id: string;
  ig_access_token: string;
  ig_sync_stories: boolean;

  tt_connected: boolean;
  tt_account_handle: string;
  tt_client_key: string;
  tt_access_token: string;
  tt_sync_leads: boolean;
}

export interface OmnichannelConversation {
  id: number;
  channel: 'whatsapp' | 'facebook' | 'instagram' | 'tiktok';
  contact_name: string;
  contact_handle: string;
  avatar_color: string;
  unread_count: number;
  estimated_value: number;
  tag: string;
  tags_json?: string;
  assigned_user_id?: number | null;
  last_message_text: string;
  last_message_time: string;
}

export interface OmnichannelMessage {
  id: number;
  conversation_id: number;
  sender_type: 'contact' | 'agent' | 'chatbot' | 'broadcast';
  sender_name: string;
  body: string;
  delivery_via: 'wa-qr' | 'wa-api' | 'wa-chatbot' | 'wa-broadcast' | 'meta' | 'tiktok';
  time_label: string;
  media_type?: 'none' | 'image' | 'video' | 'audio' | 'document' | 'sticker';
  media_url?: string;
  media_filename?: string;
  media_mimetype?: string;
  delivery_status?: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  reactions_json?: Array<{ emoji: string; by: 'agent' | 'contact' }>;
  created_at?: string;
  reply_to_id?: number | null;
  reply_to_sender?: string;
  reply_to_body?: string;
  reply_to_media_url?: string;
  reply_to_media_type?: string;
  is_forwarded?: boolean;
  is_edited?: boolean;
  is_deleted?: boolean;
}

export interface QuickReplyItem {
  id: number;
  shortcut: string;
  title: string;
  body: string;
  media_type: 'none' | 'image' | 'video' | 'audio' | 'document' | 'sticker';
  media_url: string;
  media_filename: string;
  media_mimetype: string;
  created_at?: string;
}

export interface CrmTagItem {
  id: number;
  name: string;
  color: string;
  scope: 'chat' | 'user' | 'both';
  created_at?: string;
}

export interface ConversationNoteItem {
  id: number;
  conversation_id: number;
  author_name: string;
  content: string;
  color: string;
  created_at: string;
  updated_at?: string;
}

export interface ModulePermission {
  module_key: string;
  module_name: string;
  category: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface RoleItem {
  id: number;
  name: string;
  slug: string;
  description: string;
  badge_color: string;
  is_system: boolean;
  user_count?: number;
  permissions: ModulePermission[];
}

export interface UserItem {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  job_title: string;
  department: string;
  role_id: number;
  role_name?: string;
  role_color?: string;
  avatar_url: string;
  status: 'active' | 'inactive';
  monthly_quota: number;
  tags_json?: string;
  last_login?: string;
  created_at?: string;
  role?: RoleItem;
}

export interface ModuleCatalogItem {
  module_key: string;
  name: string;
  description: string;
  category: string;
  sort_order: number;
}

export interface GlobalTableColumn<T> {
  key: string;
  label: string;
  render: (row: T) => string;
  isActions?: boolean;
}
