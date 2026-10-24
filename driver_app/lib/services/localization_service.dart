import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class LocalizationService {
  static final LocalizationService _instance = LocalizationService._internal();
  factory LocalizationService() => _instance;
  LocalizationService._internal();

  static const String _prefKey = 'rudraksha_driver_lang';
  final ValueNotifier<String> currentLanguageNotifier = ValueNotifier<String>('en');

  bool get isHindi => currentLanguageNotifier.value == 'hi';
  String get currentLang => currentLanguageNotifier.value;

  Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getString(_prefKey) ?? 'en';
      currentLanguageNotifier.value = saved;
    } catch (_) {}
  }

  Future<void> setLanguage(String lang) async {
    currentLanguageNotifier.value = lang;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefKey, lang);
    } catch (_) {}
  }

  Future<void> toggleLanguage() async {
    final next = isHindi ? 'en' : 'hi';
    await setLanguage(next);
  }

  String tr(String key) {
    final lang = currentLanguageNotifier.value;
    if (lang == 'hi' && _translationsHi.containsKey(key)) {
      return _translationsHi[key]!;
    }
    if (_translationsEn.containsKey(key)) {
      return _translationsEn[key]!;
    }
    return key;
  }

  static const Map<String, String> _translationsEn = {
    // Login Screen
    'app_title': 'RUDRAKSHA RIDER',
    'app_subtitle': 'Delivery Partner Official App',
    'phone_label': 'Registered Mobile Number',
    'phone_hint': 'Enter 10-digit mobile number',
    'pin_label': '4-Digit Security PIN / Password',
    'forgot_pin': 'Forgot PIN? Admin WhatsApp',
    'login_btn': 'LOGIN TO RIDER DASHBOARD',
    'server_settings': 'Server Settings',
    'err_empty_creds': 'Please enter mobile number and password.',
    'err_login_failed': 'Login failed. Please check credentials.',

    // Duty & Navigation
    'on_duty': 'ON DUTY',
    'off_duty': 'OFF DUTY',
    'tab_orders': 'Orders',
    'tab_earnings': 'Earnings',
    'tab_profile': 'Profile',
    'available_orders': 'Available Orders',
    'declined_history': 'Declined History',
    'no_active_orders': 'No active trips at the moment',
    'searching_orders': 'Searching for nearby orders...',
    'duty_off_msg': 'You are currently OFF DUTY. Switch to ON DUTY to receive live order alerts.',

    // Order Card & Actions
    'order_alert': 'NEW ORDER ALERT!',
    'pickup': 'PICKUP',
    'drop': 'DROP',
    'fare': 'Fare',
    'distance': 'Distance',
    'accept': 'ACCEPT ORDER',
    'decline': 'DECLINE',
    'silence': 'SILENCE',
    'active_trip': 'Active Trip',
    'call_sender': 'Call Sender',
    'call_receiver': 'Call Receiver',
    'directions': 'Directions',
    'verify_pickup': 'Verify Pickup OTP',
    'verify_drop': 'Verify Delivery OTP',
    'start_delivery': 'Start Delivery',
    'complete_delivery': 'Complete Delivery',
    'trip_completed': 'Trip Completed Successfully!',

    // Profile & Summary
    'total_trips': 'Total Trips',
    'today_earnings': 'Today\'s Earnings',
    'rating': 'Rating',
    'logout': 'Logout',
    'version': 'Version',
  };

  static const Map<String, String> _translationsHi = {
    // Login Screen
    'app_title': 'रुद्राक्ष राइडर',
    'app_subtitle': 'डिलीवरी पार्टनर ऑफिशियल ऐप',
    'phone_label': 'पंजीकृत मोबाइल नंबर',
    'phone_hint': '10 अंकों का मोबाइल नंबर दर्ज करें',
    'pin_label': '4-अंकों का सिक्योरिटी पिन / पासवर्ड',
    'forgot_pin': 'पिन भूल गए? एडमिन व्हाट्सएप',
    'login_btn': 'राइडर डैशबोर्ड में लॉगिन करें',
    'server_settings': 'सर्वर सेटिंग्स',
    'err_empty_creds': 'कृपया मोबाइल नंबर और पासवर्ड दर्ज करें।',
    'err_login_failed': 'लॉगिन विफल। कृपया सही विवरण जांचें।',

    // Duty & Navigation
    'on_duty': 'ड्यूटी ऑन (चालू)',
    'off_duty': 'ड्यूटी ऑफ (बंद)',
    'tab_orders': 'ऑर्डर्स',
    'tab_earnings': 'कमाई',
    'tab_profile': 'प्रोफाइल',
    'available_orders': 'उपलब्ध ऑर्डर्स',
    'declined_history': 'अस्वीकृत ऑर्डर्स',
    'no_active_orders': 'फिलहाल कोई सक्रिय ट्रिप नहीं है',
    'searching_orders': 'आस-पास के नए ऑर्डर खोजे जा रहे हैं...',
    'duty_off_msg': 'आप अभी ऑफलाइन (ड्यूटी बंद) हैं। नए ऑर्डर अलर्ट प्राप्त करने के लिए ऑन-ड्यूटी स्विच करें।',

    // Order Card & Actions
    'order_alert': 'नया ऑर्डर अलर्ट!',
    'pickup': 'पिकअप स्थान',
    'drop': 'डिलीवरी स्थान',
    'fare': 'किराया',
    'distance': 'दूरी',
    'accept': 'ऑर्डर स्वीकार करें',
    'decline': 'अस्वीकार करें',
    'silence': 'साइलेंट करें',
    'active_trip': 'सक्रिय ट्रिप',
    'call_sender': 'भेजने वाले को कॉल करें',
    'call_receiver': 'पाने वाले को कॉल करें',
    'directions': 'गूगल मैप नेविगेशन',
    'verify_pickup': 'पिकअप ओटीपी सत्यापित करें',
    'verify_drop': 'डिलीवरी ओटीपी सत्यापित करें',
    'start_delivery': 'डिलीवरी शुरू करें',
    'complete_delivery': 'डिलीवरी पूरी करें',
    'trip_completed': 'ट्रिप सफलतापूर्वक पूरी हुई!',

    // Profile & Summary
    'total_trips': 'कुल ट्रिप्स',
    'today_earnings': 'आज की कमाई',
    'rating': 'रेटिंग',
    'logout': 'लॉगआउट',
    'version': 'संस्करण',
  };
}
