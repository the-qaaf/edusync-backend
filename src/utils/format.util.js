
/**
 * Strip HTML tags and convert to WhatsApp Markdown.
 * @param {string} html
 * @returns {string}
 */
export const formatHtmlToWhatsApp = (html) => {
  if (!html) return "";

  let text = html;

  // Replace <br> and <p> with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<p>/gi, '');

  // Bold
  text = text.replace(/<b>(.*?)<\/b>/gi, '*$1*');
  text = text.replace(/<strong>(.*?)<\/strong>/gi, '*$1*');

  // Italics
  text = text.replace(/<i>(.*?)<\/i>/gi, '_$1_');
  text = text.replace(/<em>(.*?)<\/em>/gi, '_$1_');

  // Strikethrough
  text = text.replace(/<s>(.*?)<\/s>/gi, '~$1~');
  text = text.replace(/<strike>(.*?)<\/strike>/gi, '~$1~');

  // Lists (Bullet points)
  text = text.replace(/<ul>/gi, '\n');
  text = text.replace(/<\/ul>/gi, '');
  text = text.replace(/<li>/gi, '• ');
  text = text.replace(/<\/li>/gi, '\n');

  // Clean up remaining tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&rsquo;/g, "'");
  text = text.replace(/&lsquo;/g, "'");
  text = text.replace(/&ldquo;/g, '"');
  text = text.replace(/&rdquo;/g, '"');
  text = text.replace(/&ndash;/g, '-');
  text = text.replace(/&mdash;/g, '--');
  text = text.replace(/&apos;/g, "'");

  // Trim extraneous whitespace
  return text.trim();
};
