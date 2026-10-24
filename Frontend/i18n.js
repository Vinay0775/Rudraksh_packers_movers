/**
 * Rudraksha Packers & Movers - Enterprise Dual Language (i18n) Engine
 * Supports seamless switching between English and Hindi with ZERO layout shift.
 */

(function () {
  'use strict';

  const translations = {
    en: {
      // Common & Navigation
      "brand_title": "OM Rudraksha",
      "brand_subtitle": "Packers & Movers",
      "nav_home": "Home",
      "nav_services": "Services",
      "nav_how_it_works": "How It Works",
      "nav_rates": "Rates",
      "nav_about": "About Us",
      "nav_download_app": "Download App",
      "nav_send_parcel": "Send Parcel",
      "nav_track": "Track Move",
      "nav_calc": "Cost Calculator",
      "lang_label": "हिन्दी",

      // Hero Section
      "hero_title_prefix": "Move Anything.",
      "hero_title_suffix": "Send Anything. Anywhere.",
      "hero_subtitle": "India's most trusted door-to-door relocation and instant parcel delivery portal.",
      "tab_packers_title": "Packers & Movers",
      "tab_packers_sub": "Move your Home or Office",
      "tab_parcel_title": "Send a Parcel",
      "tab_parcel_sub": "Hyperlocal & City Courier",
      "trust_rating": "4.9/5 Rating (15,000+ Moves)",
      "trust_quotes": "100% Free Transparent Quotes",
      "trust_crew": "Verified Drivers & Crew",

      // Hero Feature Cards
      "feat_household_title": "Household Shifting",
      "feat_household_sub": "1BHK, 2BHK, 3BHK & Villas with multi-layer safe packing",
      "feat_office_title": "Office Relocation",
      "feat_office_sub": "Zero-downtime desks, server racks & corporate setups",
      "feat_vehicle_title": "Vehicle Transport",
      "feat_vehicle_sub": "Enclosed hydraulic car carrier & scratch-free bike shifting",
      "feat_storage_title": "Secure Warehousing",
      "feat_storage_sub": "24/7 CCTV monitored climate-controlled storage",

      // Calculator Section
      "calc_badge": "INSTANT ACCURATE ESTIMATE",
      "calc_title": "Check Your Shifting Price in 30 Seconds",
      "calc_sub": "No hidden charges. Transparent volume and distance-based rates.",
      "calc_from_label": "Moving From (City / Location)",
      "calc_from_ph": "Enter Pickup City (e.g. Jaipur)",
      "calc_to_label": "Moving To (City / Location)",
      "calc_to_ph": "Enter Destination City (e.g. Delhi)",
      "calc_move_type_label": "Select Move Type",
      "calc_opt_1bhk": "1 BHK Apartment",
      "calc_opt_2bhk": "2 BHK Apartment",
      "calc_opt_3bhk": "3 BHK / Villa",
      "calc_opt_office": "Office / Commercial",
      "calc_opt_vehicle": "Bike / Car Only",
      "calc_date_label": "Shifting Date",
      "calc_btn_calculate": "Calculate Estimate",
      "calc_btn_instant_quote": "Get Instant Booking Call",
      "calc_est_label": "Estimated Cost Range",

      // Popular Services Section
      "services_badge": "COMPREHENSIVE LOGISTICS",
      "services_title": "Our Specialized Relocation Services",
      "services_sub": "Professional handling by trained teams with high-grade packaging materials.",
      "service_home_move": "Complete Home Shifting",
      "service_home_move_desc": "Multi-layer bubble wrap, carton boxes, edge guards and careful handling for all furniture and appliances.",
      "service_packing": "Packing & Unpacking",
      "service_packing_desc": "Complete unpacking and room-by-room furniture assembly by our trained relocation crew.",
      "service_intercity": "All-India Intercity Moving",
      "service_intercity_desc": "Door-to-door pan-India transit with live GPS tracking and dedicated delivery manager.",

      // How it Works
      "how_badge": "SEAMLESS 4-STEP PROCESS",
      "how_title": "How Rudraksha Relocation Works",
      "how_step1_title": "1. Share Requirements",
      "how_step1_desc": "Select your move type and locations to receive a free, itemized estimate instantly.",
      "how_step2_title": "2. High-Grade Packing",
      "how_step2_desc": "Our certified team arrives with premium packaging materials to secure every item.",
      "how_step3_title": "3. Safe Transportation",
      "how_step3_desc": "Dispatched via verified container trucks with real-time tracking from origin to destination.",
      "how_step4_title": "4. On-Time Delivery",
      "how_step4_desc": "Careful unloading, unpacking and arrangement at your new destination.",

      // Rates Section
      "rates_badge": "FAIR & TRANSPARENT PRICING",
      "rates_title": "Standard Relocation Tariff Rates",
      "rates_sub": "Honest pricing with no last-minute surprises.",
      "rate_col_type": "Movement Size",
      "rate_col_local": "Within City (Local)",
      "rate_col_intercity": "Intercity (100 - 500 km)",
      "rate_col_long": "Long Distance (500+ km)",

      // Reviews / Testimonials
      "reviews_badge": "CUSTOMER STORIES",
      "reviews_title": "Loved by 15,000+ Happy Families",
      "reviews_sub": "Real experiences from satisfied customers across India.",

      // Footer
      "footer_tagline": "India's premier relocation and on-demand parcel logistics network.",
      "footer_quick_links": "Quick Links",
      "footer_services": "Services",
      "footer_contact": "Contact Us",
      "footer_rights": "All rights reserved.",

      // Parcel Booking Page (parcel.html)
      "parcel_badge": "ON-DEMAND COURIER & LOGISTICS",
      "parcel_title": "Instant City Parcel & Tempo Delivery",
      "parcel_sub": "Reliable goods delivery in 15 minutes. Two-wheelers to multi-ton trucks.",
      "parcel_tab_intracity": "Within City (Instant)",
      "parcel_tab_intercity": "Intercity Courier",
      "parcel_pickup_label": "Pickup Address",
      "parcel_pickup_ph": "Enter full pickup address or landmark",
      "parcel_drop_label": "Drop Address",
      "parcel_drop_ph": "Enter delivery address or landmark",
      "parcel_sender_name": "Sender Name",
      "parcel_sender_phone": "Sender Phone (10 digits)",
      "parcel_receiver_name": "Receiver Name",
      "parcel_receiver_phone": "Receiver Phone (10 digits)",
      "parcel_package_type": "Item / Package Type",
      "parcel_weight_label": "Approx. Weight (kg)",
      "parcel_choose_vehicle": "Select Vehicle Type",
      "parcel_v_bike": "2-Wheeler (Documents & Small Boxes up to 20kg)",
      "parcel_v_3w": "3-Wheeler Auto (Up to 500kg)",
      "parcel_v_tata": "Tata Ace / Chhota Hathi (Up to 750kg)",
      "parcel_v_pickup": "Pickup 8ft (Up to 1.2 Ton)",
      "parcel_summary_title": "Fare Summary",
      "parcel_btn_book": "Confirm & Dispatch Driver",

      // Tracking Page (track.html)
      "track_badge": "LIVE CONSIGNMENT TRACKING",
      "track_title": "Track Your Shifting / Parcel",
      "track_sub": "Enter your 10-digit mobile number or Tracking/Order ID.",
      "track_input_ph": "e.g. 7296831460 or RPM-84920",
      "track_btn": "Track Now",
      "track_status_assigned": "Driver Assigned",
      "track_status_pickup": "Driver En Route to Pickup",
      "track_status_transit": "In Transit",
      "track_status_delivered": "Successfully Delivered",

      // Admin Dashboard (admin.html)
      "admin_brand": "Rudraksha Admin",
      "admin_nav_dashboard": "Overview Dashboard",
      "admin_nav_parcels": "Parcel Orders",
      "admin_nav_packers": "Packers & Movers Inquiries",
      "admin_nav_drivers": "Driver Fleet",
      "admin_nav_tariffs": "Tariff & Rates",
      "admin_nav_settings": "Admin Settings",
      "admin_stat_total_orders": "Total Orders",
      "admin_stat_revenue": "Total Revenue",
      "admin_stat_active_drivers": "Active Drivers",
      "admin_stat_pending": "Pending Dispatch",
      "admin_btn_refresh": "Refresh Data",
      "admin_btn_assign": "Assign Driver",
      "admin_btn_change_driver": "Change Driver",
      "admin_filter_all": "All Orders",
      "admin_filter_pending": "Pending",
      "admin_filter_assigned": "Driver Assigned",
      "admin_filter_transit": "In Transit",
      "admin_filter_completed": "Completed",
      "admin_filter_declined": "Declined",
      "admin_th_id": "Order ID",
      "admin_th_customer": "Customer",
      "admin_th_route": "Route (Pickup ➔ Drop)",
      "admin_th_fare": "Fare",
      "admin_th_driver": "Assigned Driver",
      "admin_th_status": "Status",
      "admin_th_actions": "Actions"
    },

    hi: {
      // Common & Navigation
      "brand_title": "ओम रुद्राक्ष",
      "brand_subtitle": "पैकर्स एंड मूवर्स",
      "nav_home": "होम",
      "nav_services": "सेवाएं",
      "nav_how_it_works": "प्रक्रिया",
      "nav_rates": "रेट चार्ट",
      "nav_about": "हमारे बारे में",
      "nav_download_app": "ऐप डाउनलोड करें",
      "nav_send_parcel": "पार्सल भेजें",
      "nav_track": "ट्रैक करें",
      "nav_calc": "खर्च कैलकुलेटर",
      "lang_label": "English",

      // Hero Section
      "hero_title_prefix": "कुछ भी शिफ्ट करें।",
      "hero_title_suffix": "कहीं भी पार्सल भेजें।",
      "hero_subtitle": "भारत का सबसे भरोसेमंद डोर-टू-डोर शिफ्टिंग और इंस्टेंट पार्सल डिलीवरी पोर्टल।",
      "tab_packers_title": "पैकर्स एंड मूवर्स",
      "tab_packers_sub": "घर या ऑफिस सुरक्षित शिफ्ट करें",
      "tab_parcel_title": "पार्सल भेजें",
      "tab_parcel_sub": "लोकल व इंटरसिटी तुरंत डिलीवरी",
      "trust_rating": "4.9/5 रेटिंग (15,000+ सफल शिफ्टिंग)",
      "trust_quotes": "100% फ्री पारदर्शी कोटेशन",
      "trust_crew": "वेरिफाइड ड्राइवर्स व प्रोफेशनल क्रू",

      // Hero Feature Cards
      "feat_household_title": "घरेलू सामान शिफ्टिंग",
      "feat_household_sub": "1BHK, 2BHK, 3BHK व विला मल्टी-लेयर सेफ पैकिंग के साथ",
      "feat_office_title": "ऑफिस रिलोकेशन",
      "feat_office_sub": "बिना रुकावट वर्कस्टेशन, सर्वर व कॉर्पोरेट सेटअप की शिफ्टिंग",
      "feat_vehicle_title": "गाड़ी व बाइक ट्रांसपोर्ट",
      "feat_vehicle_sub": "हाइड्रोलिक क्लोज्ड कंटेनर से स्क्रैच-फ्री कार व बाइक डिलीवरी",
      "feat_storage_title": "सुरक्षित वेयरहाउसिंग",
      "feat_storage_sub": "24/7 CCTV निगरानी वाला सेफ स्टोरेज स्पेस",

      // Calculator Section
      "calc_badge": "तुरंत सटीक अनुमान",
      "calc_title": "30 सेकंड में अपनी शिफ्टिंग का खर्च जानें",
      "calc_sub": "कोई छुपा हुआ चार्ज नहीं। दूरी और सामान के हिसाब से सही रेट।",
      "calc_from_label": "कहाँ से शिफ्ट करना है (पिकअप शहर)",
      "calc_from_ph": "पिकअप शहर दर्ज करें (उदा. जयपुर)",
      "calc_to_label": "कहाँ ले जाना है (डिलीवरी शहर)",
      "calc_to_ph": "डिलीवरी शहर दर्ज करें (उदा. दिल्ली)",
      "calc_move_type_label": "शिफ्टिंग का प्रकार चुनें",
      "calc_opt_1bhk": "1 BHK अपार्टमेंट",
      "calc_opt_2bhk": "2 BHK अपार्टमेंट",
      "calc_opt_3bhk": "3 BHK / विला",
      "calc_opt_office": "ऑफिस / दुकान",
      "calc_opt_vehicle": "केवल बाइक / कार",
      "calc_date_label": "शिफ्टिंग की तारीख",
      "calc_btn_calculate": "खर्च कैलकुलेट करें",
      "calc_btn_instant_quote": "तुरंत बुकिंग कॉल प्राप्त करें",
      "calc_est_label": "अनुमानित खर्च",

      // Popular Services Section
      "services_badge": "सम्पूर्ण लॉजिस्टिक्स समाधान",
      "services_title": "हमारी विशेष रिलोकेशन सेवाएं",
      "services_sub": "प्रशिक्षित टीम और उच्च गुणवत्ता वाली पैकिंग सामग्री द्वारा सुरक्षित सेवा।",
      "service_home_move": "कम्प्लीट होम शिफ्टिंग",
      "service_home_move_desc": "फर्नीचर और इलेक्ट्रॉनिक सामान के लिए बबल रैप, मजबूत बॉक्स और कॉर्नर गार्ड के साथ सुरक्षित पैकिंग।",
      "service_packing": "पैकिंग और अनपैकिंग सेवा",
      "service_packing_desc": "नए घर में सामान की पूरी अनपैकिंग और कमरे के अनुसार फर्नीचर असेंबल करने की सुविधा।",
      "service_intercity": "ऑल-इंडिया इंटरसिटी शिफ्टिंग",
      "service_intercity_desc": "लाइव जीपीएस ट्रैकिंग और समर्पित मैनेजर के साथ पूरे भारत में सुरक्षित ट्रांसपोर्ट।",

      // How it Works
      "how_badge": "आसान 4-स्टेप प्रक्रिया",
      "how_title": "रुद्राक्ष रिलोकेशन कैसे काम करता है",
      "how_step1_title": "1. जानकारी साझा करें",
      "how_step1_desc": "सामान और लोकेशन चुनें और तुरंत फ्री एस्टीमेट प्राप्त करें।",
      "how_step2_title": "2. प्रीमियम पैकिंग",
      "how_step2_desc": "हमारी टीम उच्च-स्तरीय पैकिंग मटेरियल के साथ सुरक्षित पैकिंग करती है।",
      "how_step3_title": "3. सुरक्षित ट्रांसपोर्टेशन",
      "how_step3_desc": "जीपीएस युक्त क्लोज्ड कंटेनर ट्रकों से सुरक्षित और समय पर डिलीवरी।",
      "how_step4_title": "4. सही समय पर डिलीवरी",
      "how_step4_desc": "नए स्थान पर सावधानीपूर्वक अनलोडिंग, अनपैकिंग और उचित व्यवस्था।",

      // Rates Section
      "rates_badge": "पारदर्शी और उचित रेट्स",
      "rates_title": "मानक शिफ्टिंग रेट चार्ट",
      "rates_sub": "ईमानदार और स्पष्ट दरें, बिना किसी हिडन चार्ज के।",
      "rate_col_type": "सामान का आकार",
      "rate_col_local": "शहर के अंदर (लोकल)",
      "rate_col_intercity": "इंटरसिटी (100 - 500 किमी)",
      "rate_col_long": "लंबी दूरी (500+ किमी)",

      // Reviews / Testimonials
      "reviews_badge": "ग्राहकों का भरोसा",
      "reviews_title": "15,000+ संतुष्ट परिवारों की पसंद",
      "reviews_sub": "पूरे भारत से हमारे खुशहाल ग्राहकों के वास्तविक अनुभव।",

      // Footer
      "footer_tagline": "भारत का अग्रणी रिलोकेशन और ऑन-डिमांड पार्सल लॉजिस्टिक्स नेटवर्क।",
      "footer_quick_links": "महत्वपूर्ण लिंक्स",
      "footer_services": "सेवाएं",
      "footer_contact": "संपर्क करें",
      "footer_rights": "सर्वाधिकार सुरक्षित।",

      // Parcel Booking Page (parcel.html)
      "parcel_badge": "ऑन-डिमांड कूरियर व लॉजिस्टिक्स",
      "parcel_title": "शहर में तुरंत पार्सल व टेम्पो डिलीवरी",
      "parcel_sub": "15 मिनट में सुरक्षित डिलीवरी। बाइक से लेकर बड़े ट्रकों तक उपलब्ध।",
      "parcel_tab_intracity": "शहर के अंदर (तुरंत)",
      "parcel_tab_intercity": "इंटरसिटी कूरियर",
      "parcel_pickup_label": "पिकअप का पता",
      "parcel_pickup_ph": "पूरा पिकअप पता या लैंडमार्क दर्ज करें",
      "parcel_drop_label": "डिलीवरी का पता",
      "parcel_drop_ph": "पूरा डिलीवरी पता या लैंडमार्क दर्ज करें",
      "parcel_sender_name": "भेजने वाले का नाम",
      "parcel_sender_phone": "भेजने वाले का मोबाइल (10 अंक)",
      "parcel_receiver_name": "पाने वाले का नाम",
      "parcel_receiver_phone": "पाने वाले का मोबाइल (10 अंक)",
      "parcel_package_type": "सामान / पार्सल का प्रकार",
      "parcel_weight_label": "अनुमानित वजन (किलो)",
      "parcel_choose_vehicle": "गाड़ी का प्रकार चुनें",
      "parcel_v_bike": "टू-व्हीलर बाइक (दस्तावेज व छोटे बॉक्स 20 किग्रा तक)",
      "parcel_v_3w": "थ्री-व्हीलर ऑटो (500 किग्रा तक)",
      "parcel_v_tata": "टाटा ऐस / छोटा हाथी (750 किग्रा तक)",
      "parcel_v_pickup": "पिकअप 8 फीट (1.2 टन तक)",
      "parcel_summary_title": "किराया विवरण",
      "parcel_btn_book": "कन्फर्म करें और ड्राइवर बुलाएं",

      // Tracking Page (track.html)
      "track_badge": "लाइव कंसाइनमेंट ट्रैकिंग",
      "track_title": "अपनी शिफ्टिंग / पार्सल ट्रैक करें",
      "track_sub": "अपना 10 अंकों का मोबाइल नंबर या ट्रैकिंग/ऑर्डर आईडी दर्ज करें।",
      "track_input_ph": "उदा. 7296831460 या RPM-84920",
      "track_btn": "अभी ट्रैक करें",
      "track_status_assigned": "ड्राइवर असाइन हुआ",
      "track_status_pickup": "ड्राइवर पिकअप के लिए निकल चुका है",
      "track_status_transit": "रास्ते में है (In Transit)",
      "track_status_delivered": "सफलतापूर्वक डिलीवर हो गया",

      // Admin Dashboard (admin.html)
      "admin_brand": "रुद्राक्ष एडमिन",
      "admin_nav_dashboard": "डैशबोर्ड ओवरव्यू",
      "admin_nav_parcels": "पार्सल ऑर्डर्स",
      "admin_nav_packers": "पैकर्स एंड मूवर्स पूछताछ",
      "admin_nav_drivers": "ड्राइवर फ्लीट",
      "admin_nav_tariffs": "टैरिफ व रेट्स",
      "admin_nav_settings": "एडमिन सेटिंग्स",
      "admin_stat_total_orders": "कुल ऑर्डर्स",
      "admin_stat_revenue": "कुल रेवेन्यू",
      "admin_stat_active_drivers": "एक्टिव ड्राइवर्स",
      "admin_stat_pending": "पेंडिंग डिस्पैच",
      "admin_btn_refresh": "डेटा रीफ्रेश करें",
      "admin_btn_assign": "ड्राइवर असाइन करें",
      "admin_btn_change_driver": "ड्राइver बदलें",
      "admin_filter_all": "सभी ऑर्डर्स",
      "admin_filter_pending": "पेंडिंग",
      "admin_filter_assigned": "ड्राइवर असाइंड",
      "admin_filter_transit": "रास्ते में",
      "admin_filter_completed": "पूर्ण (Delivered)",
      "admin_filter_declined": "ड्राइवर डिक्लाइन",
      "admin_th_id": "ऑर्डर आईडी",
      "admin_th_customer": "ग्राहक",
      "admin_th_route": "रूट (पिकअप ➔ ड्रॉप)",
      "admin_th_fare": "किराया",
      "admin_th_driver": "असाइंड ड्राइवर",
      "admin_th_status": "स्थिति",
      "admin_th_actions": "एक्शन"
    }
  };

  const STORAGE_KEY = 'rudraksha_preferred_lang';

  function getCurrentLanguage() {
    return localStorage.getItem(STORAGE_KEY) || 'en';
  }

  function t(key, lang) {
    const l = lang || getCurrentLanguage();
    if (translations[l] && translations[l][key] !== undefined) {
      return translations[l][key];
    }
    if (translations.en && translations.en[key] !== undefined) {
      return translations.en[key];
    }
    return key;
  }

  function applyLanguage(lang) {
    if (!translations[lang]) lang = 'en';
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;

    // 1. Text elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key && translations[lang][key] !== undefined) {
        // Keep child icons if any
        const icon = el.querySelector('i');
        if (icon) {
          const iconClone = icon.cloneNode(true);
          el.textContent = ' ';
          el.prepend(iconClone);
          el.appendChild(document.createTextNode(' ' + translations[lang][key]));
        } else {
          el.textContent = translations[lang][key];
        }
      }
    });

    // 2. Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key && translations[lang][key] !== undefined) {
        el.setAttribute('placeholder', translations[lang][key]);
      }
    });

    // 3. Titles / Tooltips
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key && translations[lang][key] !== undefined) {
        el.setAttribute('title', translations[lang][key]);
      }
    });

    // 4. Update all switcher buttons on the page
    document.querySelectorAll('.lang-switcher-pill').forEach(pill => {
      const enSpan = pill.querySelector('.lang-en');
      const hiSpan = pill.querySelector('.lang-hi');
      if (enSpan && hiSpan) {
        if (lang === 'hi') {
          enSpan.classList.remove('active');
          hiSpan.classList.add('active');
        } else {
          enSpan.classList.add('active');
          hiSpan.classList.remove('active');
        }
      }
    });

    // 5. Update single toggle buttons (like in mobile dropdown or header)
    document.querySelectorAll('.lang-toggle-btn-label').forEach(lbl => {
      lbl.textContent = lang === 'hi' ? 'English' : 'हिन्दी';
    });

    // 6. Dispatch custom event for dynamic components (like admin tables)
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
  }

  function toggleLanguage() {
    const current = getCurrentLanguage();
    const next = current === 'en' ? 'hi' : 'en';
    applyLanguage(next);
  }

  // Export to global scope
  window.i18n = {
    t: t,
    applyLanguage: applyLanguage,
    toggleLanguage: toggleLanguage,
    getCurrentLanguage: getCurrentLanguage,
    translations: translations
  };
  window.toggleLanguage = toggleLanguage;

  // Auto initialize on load
  document.addEventListener('DOMContentLoaded', () => {
    const saved = getCurrentLanguage();
    if (saved === 'hi') {
      applyLanguage('hi');
    }
  });

})();
