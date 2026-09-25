import 'package:shared_preferences/shared_preferences.dart';

class ApiConfig {
  static const String _defaultLocalIp = '192.168.1.4:3000';
  static const String _defaultUrl = 'http://$_defaultLocalIp/api';
  static const String _prefKey = 'rudraksha_api_base_url';

  static String currentBaseUrl = _defaultUrl;

  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    currentBaseUrl = prefs.getString(_prefKey) ?? _defaultUrl;
  }

  static Future<void> setBaseUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    String formatted = url.trim();
    if (formatted.endsWith('/')) {
      formatted = formatted.substring(0, formatted.length - 1);
    }
    if (!formatted.endsWith('/api')) {
      formatted = '$formatted/api';
    }
    currentBaseUrl = formatted;
    await prefs.setString(_prefKey, currentBaseUrl);
  }

  static Future<void> resetToDefault() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_prefKey);
    currentBaseUrl = _defaultUrl;
  }
}
