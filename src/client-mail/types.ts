export interface MailAccount {
  id: number;
  tenantId: string;
  ownerUserId: number;
  email: string;
  displayName: string;
  provider: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  username: string;
  signatureHtml: string;
  signatureDefaultNew: boolean;
  signatureDefaultReply: boolean;
  color: string;
  status: string;
  lastSyncAt: string | null;
  lastError: string;
  sharedUserIds: number[];
  unreadCount?: number;
}

export interface MailFolder {
  id: number;
  account_id: number;
  name: string;
  path: string;
  role: string;
  unread_count: number;
  total_count: number;
  account_email?: string;
  account_color?: string;
}

export interface MailAddressItem {
  name: string;
  address: string;
}

export interface MailMessageSummary {
  id: number;
  account_id: number;
  folder_id: number;
  uid: number;
  message_id: string;
  thread_id: string;
  from_name: string;
  from_email: string;
  to_list: MailAddressItem[];
  subject: string;
  snippet: string;
  date: string;
  is_read: boolean;
  is_starred: boolean;
  is_draft: boolean;
  has_attachments: boolean;
  folder_role: string;
  folder_name: string;
  account_email: string;
  account_name: string;
  account_color: string;
}

export interface MailAttachmentMeta {
  id: number;
  filename: string;
  mime_type: string;
  size_bytes: number;
  content_id: string;
  is_inline: boolean;
}

export interface MailMessageFull extends MailMessageSummary {
  cc_list: MailAddressItem[];
  bcc_list: MailAddressItem[];
  reply_to: string;
  body_html_sanitized: string;
  body_text: string;
  has_remote_images: boolean;
  folder_path: string;
}
