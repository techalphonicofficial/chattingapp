// Devanagari (Hindi) -> Roman "Hinglish", the way people type Hindi in chats.
//   "क्या कर रहे हो"  -> "kya kar rahe ho"
//   "मैं कल आऊंगा"   -> "main kal aaunga"
// Latin text (English words) passes through unchanged, so mixed sentences work too.
// Used for voice typing: the Android recognizer is fixed to hi-IN and returns Devanagari.

// Common words whose chat spelling differs from a letter-by-letter conversion
const COMMON_WORDS: Record<string, string> = {
  'नहीं': 'nahi', 'नही': 'nahi', 'हाँ': 'haan', 'हां': 'haan', 'मैं': 'main', 'में': 'mein',
  'है': 'hai', 'हैं': 'hain', 'हूँ': 'hoon', 'हूं': 'hoon', 'हो': 'ho', 'था': 'tha', 'थी': 'thi', 'थे': 'the',
  'क्या': 'kya', 'क्यों': 'kyun', 'क्यूं': 'kyun', 'कैसे': 'kaise', 'कैसा': 'kaisa', 'कैसी': 'kaisi',
  'कहाँ': 'kahan', 'कहां': 'kahan', 'कब': 'kab', 'कौन': 'kaun', 'कितना': 'kitna', 'कितने': 'kitne',
  'ठीक': 'theek', 'अच्छा': 'accha', 'अच्छी': 'acchi', 'अच्छे': 'acche', 'बहुत': 'bahut',
  'यह': 'yeh', 'ये': 'ye', 'वह': 'woh', 'वो': 'wo', 'और': 'aur', 'तो': 'to', 'भी': 'bhi', 'ही': 'hi',
  'कुछ': 'kuch', 'सब': 'sab', 'अभी': 'abhi', 'आप': 'aap', 'आपका': 'aapka', 'आपकी': 'aapki', 'आपके': 'aapke',
  'तुम': 'tum', 'हम': 'hum', 'मुझे': 'mujhe', 'तुम्हें': 'tumhe', 'उसे': 'use', 'मेरा': 'mera', 'मेरी': 'meri',
  'मेरे': 'mere', 'तेरा': 'tera', 'का': 'ka', 'की': 'ki', 'के': 'ke', 'को': 'ko', 'से': 'se', 'पर': 'par',
  'जी': 'ji', 'भाई': 'bhai', 'सर': 'sir', 'ओके': 'ok', 'प्लीज': 'please', 'प्लीज़': 'please',
  'थैंक': 'thank', 'यू': 'you', 'सॉरी': 'sorry', 'हेलो': 'hello', 'हैलो': 'hello', 'बाय': 'bye',
  // English words the Hindi recognizer writes in Devanagari
  'ऑफिस': 'office', 'ऑफ़िस': 'office', 'फोन': 'phone', 'फ़ोन': 'phone', 'मैसेज': 'message',
  'कॉल': 'call', 'रिपोर्ट': 'report', 'मीटिंग': 'meeting', 'टाइम': 'time', 'डेट': 'date',
  'प्रोजेक्ट': 'project', 'क्लाइंट': 'client', 'ईमेल': 'email', 'फाइल': 'file', 'फ़ाइल': 'file',
  'पेमेंट': 'payment', 'बिल': 'bill', 'टास्क': 'task', 'अपडेट': 'update', 'डन': 'done',
};

const VOWELS: Record<string, string> = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri',
  'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऑ': 'o', 'ऍ': 'e',
};

// [medial, word-final] spelling of each vowel sign
const MATRAS: Record<string, [string, string]> = {
  'ा': ['a', 'a'], 'ि': ['i', 'i'], 'ी': ['ee', 'i'], 'ु': ['u', 'u'], 'ू': ['oo', 'u'],
  'ृ': ['ri', 'ri'], 'े': ['e', 'e'], 'ै': ['ai', 'ai'], 'ो': ['o', 'o'], 'ौ': ['au', 'au'],
  'ॉ': ['o', 'o'], 'ॅ': ['e', 'e'],
};

const CONSONANTS: Record<string, string> = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  // precomposed nukta letters
  'क़': 'q', 'ख़': 'kh', 'ग़': 'g', 'ज़': 'z', 'ड़': 'r', 'ढ़': 'rh', 'फ़': 'f', 'य़': 'y',
};

// consonant + nukta (़) written as two characters
const NUKTA_FORMS: Record<string, string> = {
  'क': 'q', 'ख': 'kh', 'ग': 'g', 'ज': 'z', 'ड': 'r', 'ढ': 'rh', 'फ': 'f',
};

const VIRAMA = '्';
const NUKTA = '़';
const ANUSVARA = 'ं';
const CHANDRABINDU = 'ँ';
const VISARGA = 'ः';

type Unit = {
  kind: 'C' | 'V' | 'X';   // consonant, independent vowel, other (digit etc.)
  roman: string;
  vowel: string;           // consonants only: 'a' = inherent, '' = virama, else a matra
  inherent: boolean;
  matra?: string;          // raw matra char (to choose medial/final spelling)
  nasal: string;           // anusvara / chandrabindu / visarga output
};

const hasVowel = (u: Unit | undefined) => !!u && (u.kind === 'V' || (u.kind === 'C' && u.vowel !== ''));

const transliterateWord = (word: string): string => {
  if (COMMON_WORDS[word]) return COMMON_WORDS[word];

  const units: Unit[] = [];
  const chars = Array.from(word);

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const last = units[units.length - 1];

    if (CONSONANTS[ch] !== undefined) {
      let roman = CONSONANTS[ch];
      if (chars[i + 1] === NUKTA && NUKTA_FORMS[ch]) { roman = NUKTA_FORMS[ch]; i++; }
      units.push({ kind: 'C', roman, vowel: 'a', inherent: true, nasal: '' });
    } else if (ch === NUKTA) {
      // stray nukta: ignore
    } else if (MATRAS[ch] && last?.kind === 'C') {
      last.vowel = MATRAS[ch][0];
      last.matra = ch;
      last.inherent = false;
    } else if (ch === VIRAMA && last?.kind === 'C') {
      last.vowel = '';
      last.inherent = false;
    } else if ((ch === ANUSVARA || ch === CHANDRABINDU) && last) {
      last.nasal = 'n';
    } else if (ch === VISARGA && last) {
      last.nasal = 'h';
    } else if (VOWELS[ch]) {
      // inside a word long ई/ऊ read short: आऊंगा -> aaunga, आई -> aai
      let roman = VOWELS[ch];
      if (units.length > 0 && ch === 'ऊ') roman = 'u';
      if (units.length > 0 && ch === 'ई') roman = 'i';
      units.push({ kind: 'V', roman, vowel: '', inherent: false, nasal: '' });
    } else if (ch >= '०' && ch <= '९') {
      units.push({ kind: 'X', roman: String(ch.charCodeAt(0) - '०'.charCodeAt(0)), vowel: '', inherent: false, nasal: '' });
    } else {
      units.push({ kind: 'X', roman: ch, vowel: '', inherent: false, nasal: '' });
    }
  }

  // Schwa deletion (Hindi drops many written "a" sounds):
  // 1. the last consonant's inherent "a":  कमल -> kamal (not kamala)
  const lastUnit = units[units.length - 1];
  if (units.length > 1 && lastUnit?.kind === 'C' && lastUnit.inherent && !lastUnit.nasal) {
    lastUnit.vowel = '';
  }
  // 2. a medial inherent "a" between two vowel-carrying syllables, right to left:
  //    करना -> karna, समझना -> samajhna, जानकारी -> jankari
  for (let i = units.length - 2; i >= 1; i--) {
    const u = units[i];
    if (u.kind === 'C' && u.inherent && u.vowel === 'a' && !u.nasal
        && hasVowel(units[i - 1]) && units[i + 1]?.kind === 'C' && hasVowel(units[i + 1])) {
      u.vowel = '';
    }
  }

  let out = '';
  units.forEach((u, idx) => {
    if (u.kind === 'C') {
      let vowel = u.vowel;
      if (u.matra && idx === units.length - 1) vowel = MATRAS[u.matra][1];
      // long "aa" before a word-final consonant: काम -> kaam, नाम -> naam, बार -> baar
      const lastU = units[units.length - 1];
      if (u.matra === 'ा' && idx === units.length - 2 && lastU.kind === 'C' && lastU.vowel === '') vowel = 'aa';
      // anusvara before p/b/m sounds like "m": संबंध -> sambandh
      let nasal = u.nasal;
      const next = units[idx + 1];
      if (nasal === 'n' && next?.kind === 'C' && /^(p|ph|b|bh|m)$/.test(next.roman)) nasal = 'm';
      out += u.roman + vowel + nasal;
    } else {
      out += u.roman + u.nasal;
    }
  });

  // chat-style clean-ups: अच्छा "achchha" -> "accha", repeated "chh" -> "ch"
  return out
    .replace(/chchh/g, 'cch')
    .replace(/chh/g, 'ch');
};

// Devanagari letters/signs/digits (danda । ॥ handled separately)
const DEVANAGARI_RUN = /[ऀ-ॣ०-ॿ]+/g;

export const containsDevanagari = (text: string) => /[ऀ-ॿ]/.test(text);

export const toHinglish = (text: string): string => {
  if (!text || !containsDevanagari(text)) return text;
  const converted = text
    .replace(DEVANAGARI_RUN, (word) => transliterateWord(word))
    .replace(/[।॥]/g, '.')
    .replace(/\s+([.,!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
  // first letter capital, like a normal typed message
  return converted.charAt(0).toUpperCase() + converted.slice(1);
};
