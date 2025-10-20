export type SiteLanguage = 'zh' | 'en';

type Translate = (key: string, params?: Record<string, string | number>) => string;

export interface LocalizablePhoto {
  title?: string;
  description?: string;
  category?: string;
  date?: string;
  location?: string;
  camera?: string;
  lens?: string;
  settings?: string;
}

const CATEGORY_KEYS: Record<string, string> = {
  portrait: 'cat_portrait',
  landscape: 'cat_landscape',
  street: 'cat_street',
  nature: 'cat_nature',
  creative: 'cat_creative',
  architecture: 'cat_architecture',
  fashion: 'cat_fashion',
  sports: 'cat_sports',
  wildlife: 'cat_wildlife',
  macro: 'cat_macro',
  abstract: 'cat_abstract',
  event: 'cat_event',
  wedding: 'cat_wedding',
  food: 'cat_food',
  travel: 'cat_travel',
  'black-and-white': 'cat_black_and_white',
  night: 'cat_night',
  underwater: 'cat_underwater',
  aerial: 'cat_aerial',
  documentary: 'cat_documentary',
  'fine-art': 'cat_fine_art',
  product: 'cat_product',
  concert: 'cat_concert',
  astrophotography: 'cat_astrophotography',
  urban: 'cat_urban',
};

const CATEGORY_ALIASES: Record<string, string> = {
  'black & white': 'black-and-white',
  'black and white': 'black-and-white',
  'fine art': 'fine-art',
};

const EDIT_PLACEHOLDERS = new Set([
  '待編輯',
  '待编辑',
  'pending edit',
  'to be edited',
  '未設定',
  '未设定',
  'not set',
]);

function clean(value?: string) {
  return value?.trim() ?? '';
}

function isEditPlaceholder(value?: string) {
  return EDIT_PLACEHOLDERS.has(clean(value).toLowerCase());
}

export function localizePhotoCategory(category: string | undefined, t: Translate) {
  const original = clean(category);
  if (!original) return '';

  const normalized = original
    .toLowerCase()
    .replace(/\s+photography$/i, '')
    .replace(/_/g, '-')
    .trim();
  const categoryId = CATEGORY_ALIASES[normalized] ?? normalized;
  const key = CATEGORY_KEYS[categoryId];
  return key ? t(key) : original;
}

export function localizePhotoDate(value: string | undefined, lang: SiteLanguage) {
  const date = clean(value);
  if (!date) return '';

  const chineseMonth = date.match(/^(\d{4})年\s*(\d{1,2})月$/);
  if (chineseMonth) {
    const year = Number(chineseMonth[1]);
    const month = Number(chineseMonth[2]);
    if (lang === 'zh') return `${year}年${month}月`;
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', timeZone: 'UTC' })
      .format(new Date(Date.UTC(year, month - 1, 1)));
  }

  const isoDate = date.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (isoDate) {
    const year = Number(isoDate[1]);
    const month = Number(isoDate[2]);
    const day = Number(isoDate[3] ?? 1);
    return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-TW' : 'en-US', {
      year: 'numeric',
      month: 'long',
      ...(isoDate[3] ? { day: 'numeric' } : {}),
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, day)));
  }

  return date;
}

function localizeGeneratedTitle(value: string | undefined, t: Translate) {
  const title = clean(value);
  if (!title) return t('photo_untitled');

  const newWork = title.match(/^(?:新作品|New Work)\s*[-–—]\s*(.+)$/i);
  if (newWork?.[1]) return `${t('admin_new_work')} — ${newWork[1]}`;
  if (/^(?:新作品|New Work)$/i.test(title)) return t('admin_new_work');

  const aiTitle = title.match(/^(?:AI\s*智慧分類|AI\s*Smart Classification)\s*[-–—]\s*(.+)$/i);
  if (aiTitle?.[1]) {
    return t('photo_ai_classification_title', {
      category: localizePhotoCategory(aiTitle[1], t),
    });
  }

  return title;
}

function localizeGeneratedDescription(value: string | undefined, t: Translate) {
  const description = clean(value);
  if (!description) return t('photo_default_description');

  const aiDescription = description.match(
    /^(?:這張照片由 AI 自動分類為|This photo was automatically classified as)\s*(.+?)(?:\s*by AI)?[。.]?$/i,
  );
  if (aiDescription?.[1]) {
    return t('admin_ai_classified_desc', {
      category: localizePhotoCategory(aiDescription[1].replace(/[。.]$/, ''), t),
    });
  }

  if (
    description === '新上傳的攝影作品，請編輯詳細資訊。'
    || description === 'Newly uploaded photography work, please edit details.'
  ) {
    return t('admin_new_upload_desc');
  }

  return description;
}

export function localizePhoto<T extends LocalizablePhoto>(photo: T, lang: SiteLanguage, t: Translate) {
  return {
    ...photo,
    title: localizeGeneratedTitle(photo.title, t),
    description: localizeGeneratedDescription(photo.description, t),
    category: localizePhotoCategory(photo.category, t),
    date: localizePhotoDate(photo.date, lang),
    location: isEditPlaceholder(photo.location) ? '' : clean(photo.location),
    camera: isEditPlaceholder(photo.camera) ? '' : clean(photo.camera),
    lens: isEditPlaceholder(photo.lens) ? '' : clean(photo.lens),
    settings: isEditPlaceholder(photo.settings) ? '' : clean(photo.settings),
  };
}
