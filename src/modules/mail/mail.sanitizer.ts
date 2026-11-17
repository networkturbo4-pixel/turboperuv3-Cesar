import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "a", "abbr", "b", "blockquote", "br", "caption", "code", "col", "colgroup",
  "dd", "del", "div", "dl", "dt", "em", "figcaption", "figure", "font",
  "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "ins", "kbd",
  "li", "mark", "ol", "p", "pre", "q", "s", "small", "span", "strong",
  "sub", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul",
];

const ALLOWED_ATTRS: Record<string, string[]> = {
  "*": ["style", "class", "dir", "align", "valign", "bgcolor"],
  a: ["href", "title", "target", "rel"],
  img: ["src", "alt", "title", "width", "height", "data-cid", "data-blocked-src"],
  font: ["color", "face", "size"],
  table: ["border", "cellpadding", "cellspacing", "width"],
  td: ["colspan", "rowspan", "width", "height"],
  th: ["colspan", "rowspan", "width", "height"],
};

export function sanitizeMailHtml(rawHtml: string): string {
  if (!rawHtml) return "";
  return sanitizeHtml(rawHtml, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRS,
    allowedSchemes: ["http", "https", "mailto", "cid", "data"],
    allowedSchemesByTag: {
      img: ["http", "https", "cid", "data"],
      a: ["http", "https", "mailto", "tel"],
    },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          target: "_blank",
          rel: "noopener noreferrer nofollow",
        },
      }),
    },
  });
}

export function blockRemoteImagesInHtml(sanitizedHtml: string): { html: string; hasBlockedImages: boolean } {
  if (!sanitizedHtml) return { html: "", hasBlockedImages: false };
  let blocked = false;
  const html = sanitizedHtml.replace(
    /(<img\b[^>]*?)\ssrc=(["'])(https?:\/\/[^"']+)\2/gi,
    (_m, prefix, quote, url) => {
      blocked = true;
      return `${prefix} data-blocked-src=${quote}${url}${quote} src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"`;
    }
  );
  return { html, hasBlockedImages: blocked };
}

export function extractMailSnippet(bodyText?: string | null, bodyHtml?: string | null, maxLen = 180): string {
  let source = (bodyText || "").trim();
  if (!source && bodyHtml) {
    source = sanitizeHtml(bodyHtml, { allowedTags: [], allowedAttributes: {} });
  }
  const collapsed = source.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLen) return collapsed;
  return collapsed.slice(0, maxLen - 1).trimEnd() + "…";
}

export function normalizeSubjectForThread(subject?: string | null): string {
  if (!subject) return "(sin asunto)";
  return subject
    .replace(/^(\s*(re|fwd|fw|rv|reenv)\s*:\s*)+/i, "")
    .trim()
    .toLowerCase() || "(sin asunto)";
}
