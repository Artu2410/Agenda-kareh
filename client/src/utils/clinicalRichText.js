const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*>/i;
const ALLOWED_TAGS = new Set(['B', 'STRONG', 'U', 'MARK', 'BR', 'DIV', 'P', 'SPAN', 'FONT']);
const ALLOWED_BACKGROUND_COLORS = new Map([
  ['#fde68a', '#fde68a'],
  ['rgb(253,230,138)', '#fde68a'],
  ['#bfdbfe', '#bfdbfe'],
  ['rgb(191,219,254)', '#bfdbfe'],
  ['#fecdd3', '#fecdd3'],
  ['rgb(254,205,211)', '#fecdd3'],
]);

const normalizeColorToken = (value) => String(value || '')
  .toLowerCase()
  .replace(/\s+/g, '');

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const toPlainRichTextHtml = (value) => escapeHtml(value).replace(/\n/g, '<br>');

const buildSafeStyle = (element) => {
  const styleParts = [];
  const backgroundColor = ALLOWED_BACKGROUND_COLORS.get(normalizeColorToken(element.style?.backgroundColor));

  if (backgroundColor) {
    styleParts.push(`background-color: ${backgroundColor}`);
  }

  const fontWeight = String(element.style?.fontWeight || '').toLowerCase();
  if (fontWeight === 'bold' || Number(fontWeight) >= 600) {
    styleParts.push('font-weight: 700');
  }

  const textDecoration = String(element.style?.textDecoration || '').toLowerCase();
  if (textDecoration.includes('underline')) {
    styleParts.push('text-decoration: underline');
  }

  return styleParts.join('; ');
};

export const sanitizeClinicalRichTextHtml = (value = '') => {
  if (typeof DOMParser === 'undefined') {
    return toPlainRichTextHtml(value);
  }

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(`<div>${String(value || '')}</div>`, 'text/html');
  const root = documentNode.body.firstElementChild;

  if (!root) return '';

  const walk = (node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.COMMENT_NODE) {
        child.remove();
        return;
      }

      if (child.nodeType !== Node.ELEMENT_NODE) {
        return;
      }

      const tag = child.tagName.toUpperCase();
      if (tag === 'SCRIPT' || tag === 'STYLE') {
        child.remove();
        return;
      }

      if (!ALLOWED_TAGS.has(tag)) {
        const fragment = documentNode.createDocumentFragment();
        while (child.firstChild) {
          fragment.appendChild(child.firstChild);
        }
        child.replaceWith(fragment);
        walk(node);
        return;
      }

      const safeStyle = buildSafeStyle(child);
      Array.from(child.attributes).forEach((attribute) => child.removeAttribute(attribute.name));
      if (safeStyle) {
        child.setAttribute('style', safeStyle);
      }

      walk(child);
    });
  };

  walk(root);

  return root.innerHTML
    .replace(/<div><br><\/div>/gi, '<br>')
    .replace(/<\/div>\s*<div>/gi, '<br>')
    .replace(/<div>/gi, '')
    .replace(/<\/div>/gi, '<br>')
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '<br>')
    .replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>')
    .trim();
};

export const normalizeClinicalRichTextHtml = (value = '') => {
  const rawValue = String(value || '');
  const source = HTML_TAG_PATTERN.test(rawValue) ? rawValue : toPlainRichTextHtml(rawValue);
  return sanitizeClinicalRichTextHtml(source);
};

export const stripClinicalRichText = (value = '') => {
  if (typeof DOMParser === 'undefined') {
    return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(`<div>${normalizeClinicalRichTextHtml(value)}</div>`, 'text/html');
  return String(documentNode.body.textContent || '').replace(/\s+/g, ' ').trim();
};

export const isClinicalRichTextEmpty = (value = '') => stripClinicalRichText(value).length === 0;
