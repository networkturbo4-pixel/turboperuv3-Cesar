export interface MailProviderPreset {
  provider: "gmail" | "outlook" | "yahoo" | "zoho" | "icloud" | "custom";
  label: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  hint?: string;
}

export function autodetectMailProvider(email: string): MailProviderPreset {
  const clean = (email || "").trim().toLowerCase();
  const domain = clean.includes("@") ? clean.split("@")[1] : "";

  if (domain === "gmail.com" || domain === "googlemail.com") {
    return {
      provider: "gmail",
      label: "Gmail / Google Workspace",
      imapHost: "imap.gmail.com",
      imapPort: 993,
      imapSecure: true,
      smtpHost: "smtp.gmail.com",
      smtpPort: 465,
      smtpSecure: true,
      hint: "Usa una Contraseña de Aplicación de Google (requiere verificación en 2 pasos).",
    };
  }

  if (["outlook.com", "hotmail.com", "live.com", "msn.com", "outlook.es"].includes(domain)) {
    return {
      provider: "outlook",
      label: "Outlook / Hotmail",
      imapHost: "outlook.office365.com",
      imapPort: 993,
      imapSecure: true,
      smtpHost: "smtp.office365.com",
      smtpPort: 587,
      smtpSecure: false,
      hint: "En Outlook/Microsoft, genera una contraseña de aplicación si tienes 2FA activo. Algunas cuentas corporativas M365 bloquean IMAP básico.",
    };
  }

  if (domain === "yahoo.com" || domain === "yahoo.es" || domain === "ymail.com") {
    return {
      provider: "yahoo",
      label: "Yahoo Mail",
      imapHost: "imap.mail.yahoo.com",
      imapPort: 993,
      imapSecure: true,
      smtpHost: "smtp.mail.yahoo.com",
      smtpPort: 465,
      smtpSecure: true,
      hint: "Requiere contraseña de aplicación generada desde Seguridad de la cuenta Yahoo.",
    };
  }

  if (domain === "zoho.com" || domain === "zohomail.com" || domain === "zoho.eu") {
    return {
      provider: "zoho",
      label: "Zoho Mail",
      imapHost: "imap.zoho.com",
      imapPort: 993,
      imapSecure: true,
      smtpHost: "smtp.zoho.com",
      smtpPort: 465,
      smtpSecure: true,
      hint: "Habilita acceso IMAP en la configuración de Zoho Mail.",
    };
  }

  if (domain === "icloud.com" || domain === "me.com" || domain === "mac.com") {
    return {
      provider: "icloud",
      label: "iCloud Mail",
      imapHost: "imap.mail.me.com",
      imapPort: 993,
      imapSecure: true,
      smtpHost: "smtp.mail.me.com",
      smtpPort: 587,
      smtpSecure: false,
      hint: "Usa una contraseña específica para la app desde appleid.apple.com.",
    };
  }

  const hostGuess = domain ? `mail.${domain}` : "";
  return {
    provider: "custom",
    label: "IMAP / SMTP (cPanel / Dominio propio)",
    imapHost: hostGuess,
    imapPort: 993,
    imapSecure: true,
    smtpHost: hostGuess,
    smtpPort: 465,
    smtpSecure: true,
    hint: "Verifica el servidor de correo entrante/saliente y puertos (993/465 SSL o 143/587 STARTTLS) con tu proveedor.",
  };
}
