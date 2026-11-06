/**
 * Localized assistant voice replies.
 *
 * Gnani.ai TTS synthesizes in 10 Indian languages + Hinglish — but the text
 * must be IN that language for correct pronunciation. This module provides
 * localized templates for D's spoken replies across the supported languages.
 *
 * Chat bubbles stay in English (they're the review/transcript layer);
 * the SPOKEN response is in the user's selected language.
 */

export type ReplyKey =
  | "value_is"          // "Your [label] is [value]"
  | "not_stored"        // "You haven't stored that yet"
  | "saved"             // "Saved"
  | "discarded"        // "Discarded"
  | "confirm_save"      // "Save this?"
  | "confirm_update"    // "Update this?"
  | "found_apps"        // "Found [n] applications"
  | "no_apps"           // "No applications found"
  | "no_match"          // "Couldn't find a matching application"
  | "ref_shown"         // "The reference is shown on screen"
  | "sensitive_masked"  // "Sensitive — shown masked, not spoken in full"
  | "sensitive_spoken"  // "Reading it out per your setting"
  | "using_profile"     // "Using your [type] profile"
  | "microphone_blocked"// "Microphone blocked"
  | "voice_error"       // "Voice provider error"
  | "fill_extension"    // "Use the Chrome extension to fill forms"
  | "save_ext_hint"     // "Save applications from the extension"
  | "error_generic"     // "Something went wrong"
  | "welcome";          // "Your vault is ready"

/** Localized templates — {label} and {value} and {n} are replaced at runtime. */
const REPLIES: Record<string, Partial<Record<ReplyKey, string>>> = {
  // ── Hindi ──────────────────────────────────────────────────────────────
  "hi-IN": {
    value_is: "आपका {label} है: {value}",
    not_stored: "आपने यह अभी तक सहेजा नहीं है।",
    saved: "सहेज लिया।",
    discarded: "हटा दिया गया।",
    confirm_save: "क्या मैं यह सहेज दूँ?",
    confirm_update: "क्या मैं इसे अपडेट कर दूँ?",
    found_apps: "{n} आवेदन मिले।",
    no_apps: "कोई आवेदन नहीं मिला।",
    no_match: "मुझे यह नहीं मिला।",
    ref_shown: "संदर्भ संख्या स्क्रीन पर दिखाई गई है।",
    sensitive_masked: "संवेदनशील जानकारी — स्क्रीन पर छिपी हुई है, बोलकर नहीं बताई जाएगी।",
    sensitive_spoken: "आपकी सेटिंग के अनुसार पूरी जानकारी बोली जा रही है।",
    using_profile: "आपकी {type} प्रोफ़ाइल का उपयोग कर रहा हूँ।",
    microphone_blocked: "माइक्रोफ़ोन ब्लॉक है। कृपया अनुमति दें।",
    voice_error: "आवाज़ सेवा में त्रुटि।",
    fill_extension: "फॉर्म भरने के लिए क्रोम एक्सटेंशन का उपयोग करें।",
    save_ext_hint: "आवेदन सहेजने के लिए एक्सटेंशन पर 'save this application' कहें।",
    error_generic: "कुछ गड़बड़ हुई। कृपया फिर कोशिश करें।",
    welcome: "आपकी वॉल्ट तैयार है।",
  },

  // ── Bengali ─────────────────────────────────────────────────────────────
  "bn-IN": {
    value_is: "আপার {label} হলো: {value}",
    not_stored: "এটি এখনও সংরক্ষণ করা হয়নি।",
    saved: "সংরক্ষিত হয়েছে।",
    discarded: "বাতিল করা হয়েছে।",
    confirm_save: "আমি কি এটি সংরক্ষণ করব?",
    confirm_update: "আমি কি এটি আপডেট করব?",
    found_apps: "{n}টি আবেদন পাওয়া গেছে।",
    no_apps: "কোনো আবেদন পাওয়া যায়নি।",
    no_match: "এটি খুঁজে পাওয়া যায়নি।",
    ref_shown: "রেফারেন্স নম্বর স্ক্রিনে দেখানো হয়েছে।",
    sensitive_masked: "সংবেদনশীল তথ্য — স্ক্রিনে লুকানো, জোরে বলা হবে না।",
    sensitive_spoken: "আপনার সেটিং অনুযায়ী পুরো তথ্য বলা হচ্ছে।",
    using_profile: "আপার {type} প্রোফাইল ব্যবহার করছি।",
    microphone_blocked: "মাইক্রোফোন ব্লকড। অনুমতি দিন।",
    voice_error: "ভয়েস সেবায় ত্রুটি।",
    fill_extension: "ফর্ম পূরণ করতে ক্রোম এক্সটেনশন ব্যবহার করুন।",
    save_ext_hint: "আবেদন সংরক্ষণ করতে এক্সটেনশনে 'save this application' বলুন।",
    error_generic: "কিছু সমস্যা হয়েছে। আবার চেষ্টা করুন।",
    welcome: "আপার ভল্ট প্রস্তুত।",
  },

  // ── Gujarati ─────────────────────────────────────────────────────────────
  "gu-IN": {
    value_is: "તમારું {label} છે: {value}",
    not_stored: "તમે આ હજુ સાચવ્યું નથી.",
    saved: "સાચવી લીધું.",
    discarded: "રદ કરી દીધું.",
    confirm_save: "શું હું આ સાચવી દઉં?",
    confirm_update: "શું હું આ અપડેટ કરી દઉં?",
    found_apps: "{n} એપ્લિકેશન મળી.",
    no_apps: "કોઈ એપ્લિકેશન મળી નથી.",
    no_match: "મને આ નહીં મળ્યું.",
    ref_shown: "રેફરન્સ નંબર સ્ક્રીન પર બતાવ્યો છે.",
    sensitive_masked: "સંવેદનશીલ માહિતી — સ્ક્રીન પર છુપાયેલી છે, બોલીને નહીં કહેવાય.",
    sensitive_spoken: "તમારી સેટિંગ મુજબ આખી માહિતી બોલાઈ રહી છે.",
    using_profile: "તમારી {type} પ્રોફાઇલ વાપરી રહ્યો છું.",
    microphone_blocked: "માઇક્રોફોન બ્લોક છે. પરમિશન આપો.",
    voice_error: "વોઇસ સેવામાં ભૂલ.",
    fill_extension: "ફોર્મ ભરવા ક્રોમ એક્સટેન્શન વાપરો.",
    save_ext_hint: "એપ્લિકેશન સાચવવા એક્સટેન્શન પર 'save this application' કહો.",
    error_generic: "કંઈક ખોટું થયું. ફરી પ્રયત્ન કરો.",
    welcome: "તમારું વોલ્ટ તૈયાર છે.",
  },

  // ── Marathi ──────────────────────────────────────────────────────────────
  "mr-IN": {
    value_is: "तुमचे {label} आहे: {value}",
    not_stored: "तुम्ही हे अजून साठवलेले नाही.",
    saved: "साठवले.",
    discarded: "रद्द केले.",
    confirm_save: "मी हे साठवू का?",
    confirm_update: "मी हे अपडेट करू का?",
    found_apps: "{n} अर्ज सापडले.",
    no_apps: "कोणतेही अर्ज सापडले नाहीत.",
    no_match: "मला हे सापडले नाही.",
    ref_shown: "संदर्भ क्रमांक स्क्रीनवर दाखवला आहे.",
    sensitive_masked: "संवेदनशील माहिती — स्क्रीनवर लपवलेली आहे, मोठ्याने सांगणार नाही.",
    sensitive_spoken: "तुमच्या सेटिंगनुसार संपूर्ण माहिती सांगत आहे.",
    using_profile: "तुमची {type} प्रोफाइल वापरत आहे.",
    microphone_blocked: "मायक्रोफोन ब्लॉक आहे. परवानगी द्या.",
    voice_error: "व्हॉइस सेवेत त्रुटी.",
    fill_extension: "फॉर्म भरण्यासाठी क्रोम एक्सटेंशन वापरा.",
    save_ext_hint: "अर्ज साठवण्यासाठी एक्सटेंशनवर 'save this application' म्हणा.",
    error_generic: "काहीतरी चूक झाली. पुन्हा प्रयत्न करा.",
    welcome: "तुमची वॉल्ट तयार आहे.",
  },

  // ── Tamil ────────────────────────────────────────────────────────────────
  "ta-IN": {
    value_is: "உங்கள் {label}: {value}",
    not_stored: "இது இன்னும் சேமிக்கப்படவில்லை.",
    saved: "சேமிக்கப்பட்டது.",
    discarded: "நிராகரிக்கப்பட்டது.",
    confirm_save: "இதை சேமிக்கவா?",
    confirm_update: "இதை புதுப்பிக்கவா?",
    found_apps: "{n} விண்ணப்பங்கள் கிடைத்தன.",
    no_apps: "விண்ணப்பங்கள் எதுவும் கிடைக்கவில்லை.",
    no_match: "இது கிடைக்கவில்லை.",
    ref_shown: "குறிப்பு எண் திரையில் காட்டப்பட்டது.",
    sensitive_masked: "முக்கியமான தகவல் — திரையில் மறைக்கப்பட்டுள்ளது, சொல்லப்படாது.",
    sensitive_spoken: "உங்கள் அமைப்பின்படி முழு தகவல் சொல்லப்படுகிறது.",
    using_profile: "உங்கள் {type} சுயவிவரம் பயன்படுத்துகிறேன்.",
    microphone_blocked: "மைக்ரோஃபோன் தடுக்கப்பட்டுள்ளது. அனுமதி வழங்கவும்.",
    voice_error: "குரல் சேவையில் பிழை.",
    fill_extension: "படிவத்தை நிரப்ப க்ரோம் எக்ஸ்டென்ஷனை பயன்படுத்துங்கள்.",
    save_ext_hint: "விண்ணப்பத்தை சேமிக்க எக்ஸ்டென்ஷனில் 'save this application' சொல்லுங்கள்.",
    error_generic: "ஏதோ தவறு நடந்தது. மீண்டும் முயற்சிக்கவும்.",
    welcome: "உங்கள் வால்ட் தயார்.",
  },

  // ── Telugu ───────────────────────────────────────────────────────────────
  "te-IN": {
    value_is: "మీ {label}: {value}",
    not_stored: "ఇది ఇంకా నిల్వ చేయబడలేదు.",
    saved: "నిల్వ చేయబడింది.",
    discarded: "రద్దు చేయబడింది.",
    confirm_save: "నేను దీన్ని నిల్వ చేయాలా?",
    confirm_update: "నేను దీన్ని అప్‌డేట్ చేయాలా?",
    found_apps: "{n} దరఖాస్తులు దొరికాయి.",
    no_apps: "ఏ దరఖాస్తులు దొరకలేదు.",
    no_match: "ఇది దొరకలేదు.",
    ref_shown: "రిఫరెన్స్ నంబర్ స్క్రీన్‌పై చూపబడింది.",
    sensitive_masked: "సున్నితమైన సమాచారం — స్క్రీన్‌పై దాచబడింది, చెప్పబడదు.",
    sensitive_spoken: "మీ సెట్టింగ్ ప్రకారం పూర్తి సమాచారం చెప్పబడుతోంది.",
    using_profile: "మీ {type} ప్రొఫైల్ వాడుతున్నాను.",
    microphone_blocked: "మైక్రోఫోన్ బ్లాక్ అయింది. అనుమతి ఇవ్వండి.",
    voice_error: "వాయిస్ సేవలో లోపం.",
    fill_extension: "ఫారం నింపడానికి క్రోమ్ ఎక్స్‌టెన్షన్ వాడండి.",
    save_ext_hint: "దరఖాస్తును నిల్వ చేయడానికి ఎక్స్‌టెన్షన్‌లో 'save this application' చెప్పండి.",
    error_generic: "ఏదో తప్పు జరిగింది. మళ్లీ ప్రయత్నించండి.",
    welcome: "మీ వాల్ట్ సిద్ధం.",
  },

  // ── Kannada ─────────────────────────────────────────────────────────────
  "kn-IN": {
    value_is: "ನಿಮ್ಮ {label}: {value}",
    not_stored: "ಇದನ್ನು ಇನ್ನೂ ಉಳಿಸಲಾಗಿಲ್ಲ.",
    saved: "ಉಳಿಸಲಾಗಿದೆ.",
    discarded: "ರದ್ದು ಮಾಡಲಾಗಿದೆ.",
    confirm_save: "ನಾನು ಇದನ್ನು ಉಳಿಸಬೇಕೆ?",
    confirm_update: "ನಾನು ಇದನ್ನು ಅಪ್‌ಡೇಟ್ ಮಾಡಬೇಕೆ?",
    found_apps: "{n} ಅರ್ಜಿಗಳು ಸಿಕ್ಕಿವೆ.",
    no_apps: "ಯಾವುದೇ ಅರ್ಜಿಗಳು ಸಿಗಲಿಲ್ಲ.",
    no_match: "ಇದು ಸಿಗಲಿಲ್ಲ.",
    ref_shown: "ಉಲ್ಲೇಖ ಸಂಖ್ಯೆ ಸ್ಕ್ರೀನ್‌ನಲ್ಲಿ ತೋರಿಸಲಾಗಿದೆ.",
    sensitive_masked: "ಸೂಕ್ಷ್ಮ ಮಾಹಿತಿ — ಸ್ಕ್ರೀನ್‌ನಲ್ಲಿ ಮರೆಮಾಡಲಾಗಿದೆ, ಹೇಳಲಾಗುವುದಿಲ್ಲ.",
    sensitive_spoken: "ನಿಮ್ಮ ಸೆಟ್ಟಿಂಗ್‌ನಂತೆ ಸಂಪೂರ್ಣ ಮಾಹಿತಿ ಹೇಳಲಾಗುತ್ತಿದೆ.",
    using_profile: "ನಿಮ್ಮ {type} ಪ್ರೊಫೈಲ್ ಬಳಸುತ್ತಿದ್ದೇನೆ.",
    microphone_blocked: "ಮೈಕ್ರೊಫೋನ್ ಬ್ಲಾಕ್ ಆಗಿದೆ. ಅನುಮತಿ ನೀಡಿ.",
    voice_error: "ಧ್ವನಿ ಸೇವೆಯಲ್ಲಿ ದೋಷ.",
    fill_extension: "ಫಾರ್ಮ್ ತುಂಬಲು ಕ್ರೋಮ್ ಎಕ್ಸ್‌ಟೆನ್ಷನ್ ಬಳಸಿ.",
    save_ext_hint: "ಅರ್ಜಿಯನ್ನು ಉಳಿಸಲು ಎಕ್ಸ್‌ಟೆನ್ಷನ್‌ನಲ್ಲಿ 'save this application' ಹೇಳಿ.",
    error_generic: "ಏನೋ ತಪ್ಪಾಗಿದೆ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    welcome: "ನಿಮ್ಮ ವಾಲ್ಟ್ ಸಿದ್ಧವಾಗಿದೆ.",
  },

  // ── Punjabi ──────────────────────────────────────────────────────────────
  "pa-IN": {
    value_is: "ਤੁਹਾਡਾ {label} ਹੈ: {value}",
    not_stored: "ਇਹ ਹਾਲੇ ਸਾਂਭਿਆ ਨਹੀਂ ਗਿਆ.",
    saved: "ਸਾਂਭ ਲਿਆ.",
    discarded: "ਰੱਦ ਕਰ ਦਿੱਤਾ.",
    confirm_save: "ਕੀ ਮੈਂ ਇਹ ਸਾਂਭ ਦਵਾਂ?",
    confirm_update: "ਕੀ ਮੈਂ ਇਹ ਅੱਪਡੇਟ ਕਰ ਦਵਾਂ?",
    found_apps: "{n} ਅਰਜ਼ੀਆਂ ਮਿਲੀਆਂ.",
    no_apps: "ਕੋਈ ਅਰਜ਼ੀ ਨਹੀਂ ਮਿਲੀ.",
    no_match: "ਇਹ ਨਹੀਂ ਮਿਲਿਆ.",
    ref_shown: "ਰੈਫਰੈਂਸ ਨੰਬਰ ਸਕਰੀਨ 'ਤੇ ਦਿਖਾਇਆ ਗਿਆ ਹੈ.",
    sensitive_masked: "ਸੰਵੇਦਨਸ਼ੀਲ ਜਾਣਕਾਰੀ — ਸਕਰੀਨ 'ਤੇ ਲੁਕਾਈ ਹੋਈ ਹੈ, ਬੋਲੀ ਨਹੀਂ ਜਾਵੇਗੀ.",
    sensitive_spoken: "ਤੁਹਾਡੀ ਸੈਟਿੰਗ ਮੁਤਾਬਕ ਪੂਰੀ ਜਾਣਕਾਰੀ ਬੋਲੀ ਜਾ ਰਹੀ ਹੈ.",
    using_profile: "ਤੁਹਾਡੀ {type} ਪ੍ਰੋਫਾਈਲ ਵਰਤ ਰਿਹਾ ਹਾਂ.",
    microphone_blocked: "ਮਾਈਕ੍ਰੋਫੋਨ ਬਲਾਕ ਹੈ. ਇਜਾਜ਼ਤ ਦਿਓ.",
    voice_error: "ਵਾਇਸ ਸੇਵਾ ਵਿੱਚ ਗਲਤੀ.",
    fill_extension: "ਫਾਰਮ ਭਰਨ ਲਈ ਕਰੋਮ ਐਕਸਟੈਨਸ਼ਨ ਵਰਤੋ.",
    save_ext_hint: "ਅਰਜ਼ੀ ਸਾਂਭਣ ਲਈ ਐਕਸਟੈਨਸ਼ਨ 'ਤੇ 'save this application' ਕਹੋ.",
    error_generic: "ਕੁਝ ਗਲਤ ਹੋ ਗਿਆ. ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ.",
    welcome: "ਤੁਹਾਡੀ ਵਾਲਟ ਤਿਆਰ ਹੈ.",
  },

  // ── Malayalam ─────────────────────────────────────────────────────────────
  "ml-IN": {
    value_is: "നിങ്ങളുടെ {label}: {value}",
    not_stored: "ഇത് ഇതുവരെ സൂക്ഷിച്ചിട്ടില്ല.",
    saved: "സൂക്ഷിച്ചു.",
    discarded: "റദ്ദാക്കി.",
    confirm_save: "ഇത് സൂക്ഷിക്കട്ടെ?",
    confirm_update: "ഇത് അപ്ഡേറ്റ് ചെയ്യട്ടെ?",
    found_apps: "{n} അപേക്ഷകൾ ലഭിച്ചു.",
    no_apps: "അപേക്ഷകൾ ലഭിച്ചില്ല.",
    no_match: "ഇത് കണ്ടെത്തിയില്ല.",
    ref_shown: "റഫറൻസ് നമ്പർ സ്ക്രീനിൽ കാണിച്ചു.",
    sensitive_masked: "സെൻസിറ്റീവ് വിവരം — സ്ക്രീനിൽ മറച്ചിരിക്കുന്നു, പറയില്ല.",
    sensitive_spoken: "നിങ്ങളുടെ ക്രമീകരണം പ്രകാരം പൂർണ്ണ വിവരം പറയുന്നു.",
    using_profile: "നിങ്ങളുടെ {type} പ്രൊഫൈൽ ഉപയോഗിക്കുന്നു.",
    microphone_blocked: "മൈക്രോഫോൺ ബ്ലോക്ക് ചെയ്തിരിക്കുന്നു. അനുവാദം നൽകുക.",
    voice_error: "വോയ്സ് സർവീസിൽ പിശക്.",
    fill_extension: "ഫോം നിറയ്ക്കാൻ ക്രോം എക്സ്റ്റൻഷൻ ഉപയോഗിക്കുക.",
    save_ext_hint: "അപേക്ഷ സൂക്ഷിക്കാൻ എക്സ്റ്റൻഷനിൽ 'save this application' പറയുക.",
    error_generic: "എന്തോ പിശക് സംഭവിച്ചു. വീണ്ടും ശ്രമിക്കുക.",
    welcome: "നിങ്ങളുടെ വോൾട്ട് തയ്യാർ.",
  },

  // ── English (default fallback) ──────────────────────────────────────────
  "en-IN": {
    value_is: "Your {label} is {value}",
    not_stored: "You haven't stored that yet.",
    saved: "Saved.",
    discarded: "Discarded.",
    confirm_save: "Save this?",
    confirm_update: "Update this?",
    found_apps: "Found {n} applications.",
    no_apps: "No applications found.",
    no_match: "I couldn't find that.",
    ref_shown: "The reference number is shown on screen.",
    sensitive_masked: "Sensitive — shown masked, not spoken in full.",
    sensitive_spoken: "Reading it out per your setting.",
    using_profile: "Using your {type} profile.",
    microphone_blocked: "Microphone blocked. Allow access.",
    voice_error: "Voice service error.",
    fill_extension: "To fill a live form, use the Chrome extension on that page.",
    save_ext_hint: "Say save this application on the extension.",
    error_generic: "Something went wrong. Please try again.",
    welcome: "Your vault is ready.",
  },
};

// ── Hinglish maps to hi-IN (Gnani handles code-mixed input with the
//    hi-en code, but our reply templates work with either) ──
REPLIES["hi-en"] = REPLIES["en-IN"];

/** Localized field labels for voice replies. */
const FIELD_LABELS: Record<string, Partial<Record<string, string>>> = {
  "hi-IN": {
    "personal.full_name": "नाम",
    "identity.aadhaar": "आधार संख्या",
    "identity.pan": "पैन नंबर",
    "contact.email": "ईमेल",
    "contact.phone": "फ़ोन नंबर",
    "family.father_name": "पिता का नाम",
    "family.mother_name": "माता का नाम",
    "business.company_name": "कंपनी का नाम",
    "business.team_size": "टीम का आकार",
    "contact.current_address": "पता",
    "personal.dob": "जन्म तिथि",
  },
  "bn-IN": {
    "personal.full_name": "নাম",
    "identity.aadhaar": "আধার নম্বর",
    "identity.pan": "পান নম্বর",
    "contact.email": "ইমেইল",
    "contact.phone": "ফোন নম্বর",
    "family.father_name": "বাবার নাম",
    "family.mother_name": "মায়ের নাম",
    "business.company_name": "কোম্পানির নাম",
    "contact.current_address": "ঠিকানা",
    "personal.dob": "জন্ম তারিখ",
  },
  "gu-IN": {
    "personal.full_name": "નામ",
    "identity.aadhaar": "આધાર નંબર",
    "identity.pan": "પાન નંબર",
    "contact.email": "ઈમેલ",
    "contact.phone": "ફોન નંબર",
    "family.father_name": "પિતાનું નામ",
    "family.mother_name": "માતાનું નામ",
    "business.company_name": "કંપનીનું નામ",
    "contact.current_address": "સરનામું",
    "personal.dob": "જન્મ તારીખ",
  },
  "mr-IN": {
    "personal.full_name": "नाव",
    "identity.aadhaar": "आधार क्रमांक",
    "identity.pan": "पॅन क्रमांक",
    "contact.email": "ईमेल",
    "contact.phone": "फोन नंबर",
    "family.father_name": "वडिलांचे नाव",
    "family.mother_name": "आईचे नाव",
    "business.company_name": "कंपनीचे नाव",
    "contact.current_address": "पत्ता",
    "personal.dob": "जन्म तारीख",
  },
  "ta-IN": {
    "personal.full_name": "பெயர்",
    "identity.aadhaar": "ஆதார் எண்",
    "identity.pan": "பான் எண்",
    "contact.email": "மின்னஞ்சல்",
    "contact.phone": "தொலைபேசி எண்",
    "family.father_name": "தந்தை பெயர்",
    "family.mother_name": "தாய் பெயர்",
    "business.company_name": "நிறுவனத்தின் பெயர்",
    "contact.current_address": "முகவரி",
    "personal.dob": "பிறந்த தேதி",
  },
  "te-IN": {
    "personal.full_name": "పేరు",
    "identity.aadhaar": "ఆధార్ నంబర్",
    "identity.pan": "పాన్ నంబర్",
    "contact.email": "ఇమెయిల్",
    "contact.phone": "ఫోన్ నంబర్",
    "family.father_name": "తండ్రి పేరు",
    "family.mother_name": "తల్లి పేరు",
    "business.company_name": "కంపెనీ పేరు",
    "contact.current_address": "చిరునామా",
    "personal.dob": "పుట్టిన తేదీ",
  },
  "kn-IN": {
    "personal.full_name": "ಹೆಸರು",
    "identity.aadhaar": "ಆಧಾರ್ ಸಂಖ್ಯೆ",
    "identity.pan": "ಪಾನ್ ಸಂಖ್ಯೆ",
    "contact.email": "ಇಮೇಲ್",
    "contact.phone": "ದೂರವಾಣಿ ಸಂಖ್ಯೆ",
    "family.father_name": "ತಂದೆಯ ಹೆಸರು",
    "family.mother_name": "ತಾಯಿಯ ಹೆಸರು",
    "business.company_name": "ಕಂಪನಿಯ ಹೆಸರು",
    "contact.current_address": "ವಿಳಾಸ",
    "personal.dob": "ಹುಟ್ಟಿದ ದಿನಾಂಕ",
  },
  "pa-IN": {
    "personal.full_name": "ਨਾਮ",
    "identity.aadhaar": "ਆਧਾਰ ਨੰਬਰ",
    "identity.pan": "ਪਾਨ ਨੰਬਰ",
    "contact.email": "ਈਮੇਲ",
    "contact.phone": "ਫੋਨ ਨੰਬਰ",
    "family.father_name": "ਪਿਤਾ ਦਾ ਨਾਮ",
    "family.mother_name": "ਮਾਤਾ ਦਾ ਨਾਮ",
    "business.company_name": "ਕੰਪਨੀ ਦਾ ਨਾਮ",
    "contact.current_address": "ਪਤਾ",
    "personal.dob": "ਜਨਮ ਤਾਰੀਖ",
  },
  "ml-IN": {
    "personal.full_name": "പേര്",
    "identity.aadhaar": "ആധാർ നമ്പർ",
    "identity.pan": "പാൻ നമ്പർ",
    "contact.email": "ഇമെയിൽ",
    "contact.phone": "ഫോൺ നമ്പർ",
    "family.father_name": "പിതാവിന്റെ പേര്",
    "family.mother_name": "അമ്മയുടെ പേര്",
    "business.company_name": "കമ്പനിയുടെ പേര്",
    "contact.current_address": "വിലാസം",
    "personal.dob": "ജനന തീയതി",
  },
};
FIELD_LABELS["en-IN"] = {}; // English uses the English labels from vault-schema
FIELD_LABELS["hi-en"] = FIELD_LABELS["hi-IN"];

/**
 * Get a localized reply template.
 * Falls back to English when the language has no translation for a key.
 */
export function localizedReply(
  key: ReplyKey,
  language: string,
  params?: { label?: string; value?: string; n?: number; type?: string },
): string {
  const table = REPLIES[language] ?? REPLIES["en-IN"];
  let template = table[key] ?? REPLIES["en-IN"][key] ?? key;

  if (params) {
    // localize the field label too
    const labelTable = FIELD_LABELS[language] ?? {};
    if (params.label) {
      template = template.replace("{label}", labelTable[params.label] ?? params.label);
    }
    if (params.value !== undefined) template = template.replace("{value}", params.value);
    if (params.n !== undefined) template = template.replace("{n}", String(params.n));
    if (params.type) template = template.replace("{type}", params.type);
  }
  return template;
}

/** Get the localized field label for voice replies. */
export function localizedFieldLabel(fieldKey: string, language: string, englishFallback: string): string {
  const table = FIELD_LABELS[language] ?? {};
  return table[fieldKey] ?? englishFallback;
}

/** Languages that have localized replies available. */
export const LOCALIZED_LANGUAGES = Object.keys(REPLIES);
