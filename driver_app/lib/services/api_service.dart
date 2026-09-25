import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';
import '../models/driver_model.dart';
import '../models/order_model.dart';

class ApiService {
  static const String _tokenKey = 'rudraksha_driver_token';
  static const String _sessionKey = 'rudraksha_driver_session';

  static String? _cachedToken;
  static DriverModel? currentDriver;

  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _cachedToken = prefs.getString(_tokenKey);
    final rawSession = prefs.getString(_sessionKey);
    if (rawSession != null) {
      try {
        final Map<String, dynamic> json = jsonDecode(rawSession);
        currentDriver = DriverModel.fromJson(json, token: _cachedToken);
      } catch (e) {
        debugPrint('Failed to parse cached session: $e');
      }
    }
  }

  static Map<String, String> _getHeaders() {
    final headers = {'Content-Type': 'application/json'};
    if (_cachedToken != null && _cachedToken!.isNotEmpty) {
      headers['Authorization'] = 'Bearer $_cachedToken';
    }
    return headers;
  }

  // 1. Rider Login
  static Future<Map<String, dynamic>> login(String phone, String password) async {
    try {
      final url = Uri.parse('${ApiConfig.currentBaseUrl}/rider/login');
      final cleanPhone = phone.trim().replaceAll(RegExp(r'\D'), '');
      final cleanPin = password.trim();

      final res = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'phone': cleanPhone,
          'pin': cleanPin,
          'password': cleanPin,
        }),
      ).timeout(const Duration(seconds: 15));

      final data = jsonDecode(res.body);

      if (res.statusCode == 200 && data['success'] == true) {
        _cachedToken = data['token'];
        final riderData = data['driver'] ?? data['rider'] ?? {};
        currentDriver = DriverModel.fromJson(riderData, token: _cachedToken);

        final prefs = await SharedPreferences.getInstance();
        if (_cachedToken != null) {
          await prefs.setString(_tokenKey, _cachedToken!);
        }
        await prefs.setString(_sessionKey, jsonEncode(currentDriver!.toJson()));

        return {'success': true, 'rider': currentDriver};
      } else {
        return {'success': false, 'error': data['error'] ?? 'Login failed. Please check credentials.'};
      }
    } catch (e) {
      return {'success': false, 'error': 'Network connection error: $e'};
    }
  }

  // 2. Validate Profile / Me
  static Future<bool> checkAuth() async {
    if (_cachedToken == null || _cachedToken!.isEmpty) return false;
    try {
      final url = Uri.parse('${ApiConfig.currentBaseUrl}/rider/me');
      final res = await http.get(url, headers: _getHeaders()).timeout(const Duration(seconds: 6));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data['success'] == true && data['rider'] != null) {
          currentDriver = DriverModel.fromJson(data['rider'], token: _cachedToken);
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString(_sessionKey, jsonEncode(currentDriver!.toJson()));
          return true;
        }
      }
      return false;
    } catch (e) {
      // Offline fallback: if cached session exists, let user in
      return currentDriver != null;
    }
  }

  // 3. Toggle Duty (Online / Offline)
  static Future<bool> toggleDuty(bool onDuty) async {
    if (currentDriver != null) {
      currentDriver!.onDuty = onDuty;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_sessionKey, jsonEncode(currentDriver!.toJson()));
    }

    try {
      final url = Uri.parse('${ApiConfig.currentBaseUrl}/rider/duty');
      final res = await http.patch(
        url,
        headers: _getHeaders(),
        body: jsonEncode({'onDuty': onDuty}),
      ).timeout(const Duration(seconds: 5));
      return res.statusCode == 200;
    } catch (_) {
      return true; // Keep local toggle alive
    }
  }

  // 4. Fetch Driver Live Feed (Active Trip & Available Jobs)
  static Future<Map<String, dynamic>> fetchFeed() async {
    try {
      final url = Uri.parse('${ApiConfig.currentBaseUrl}/rider/jobs');
      final res = await http.get(url, headers: _getHeaders()).timeout(const Duration(seconds: 6));

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);

        OrderModel? activeTrip;
        if (data['activeTrip'] != null) {
          activeTrip = OrderModel.fromJson(data['activeTrip'], isDirect: true);
        }

        final List<OrderModel> availableJobs = [];
        if (data['availableJobs'] != null && data['availableJobs'] is List) {
          for (var item in data['availableJobs']) {
            availableJobs.add(OrderModel.fromJson(item, isDirect: false));
          }
        }

        return {
          'success': true,
          'activeTrip': activeTrip,
          'availableJobs': availableJobs,
        };
      }
      return {'success': false, 'error': 'Server error: ${res.statusCode}'};
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  // 5. Accept Job
  static Future<Map<String, dynamic>> acceptJob(String parcelId) async {
    try {
      final url = Uri.parse('${ApiConfig.currentBaseUrl}/rider/jobs/$parcelId/accept');
      final res = await http.post(url, headers: _getHeaders()).timeout(const Duration(seconds: 8));

      final data = jsonDecode(res.body);
      if (res.statusCode == 200 && data['success'] == true) {
        return {'success': true, 'parcel': data['parcel']};
      }
      return {'success': false, 'error': data['error'] ?? 'Could not accept order.'};
    } catch (e) {
      return {'success': false, 'error': 'Connection failed: $e'};
    }
  }

  // 6. Verify Pickup OTP
  static Future<Map<String, dynamic>> verifyPickupOtp(String parcelId, String otp) async {
    try {
      final url = Uri.parse('${ApiConfig.currentBaseUrl}/parcels/$parcelId/verify-pickup-otp');
      final res = await http.post(
        url,
        headers: _getHeaders(),
        body: jsonEncode({'otp': otp}),
      ).timeout(const Duration(seconds: 8));

      final data = jsonDecode(res.body);
      if (res.statusCode == 200 && data['success'] == true) {
        return {'success': true, 'message': data['message'] ?? 'Pickup verified!'};
      }
      return {'success': false, 'error': data['error'] ?? 'Invalid Pickup PIN'};
    } catch (e) {
      return {'success': false, 'error': 'Connection failed: $e'};
    }
  }

  // 7. Verify Delivery OTP & Complete Trip
  static Future<Map<String, dynamic>> verifyDeliveryOtp(String parcelId, String otp) async {
    try {
      final url = Uri.parse('${ApiConfig.currentBaseUrl}/parcels/$parcelId/verify-delivery-otp');
      final res = await http.post(
        url,
        headers: _getHeaders(),
        body: jsonEncode({'otp': otp}),
      ).timeout(const Duration(seconds: 8));

      final data = jsonDecode(res.body);
      if (res.statusCode == 200 && data['success'] == true) {
        return {'success': true, 'message': data['message'] ?? 'Trip completed successfully!'};
      }
      return {'success': false, 'error': data['error'] ?? 'Invalid Delivery PIN'};
    } catch (e) {
      return {'success': false, 'error': 'Connection failed: $e'};
    }
  }

  // 8. Fetch Rider Earnings
  static Future<Map<String, dynamic>> fetchEarnings() async {
    try {
      final url = Uri.parse('${ApiConfig.currentBaseUrl}/rider/earnings');
      final res = await http.get(url, headers: _getHeaders()).timeout(const Duration(seconds: 6));

      if (res.statusCode == 200) {
        return jsonDecode(res.body);
      }
      return {'totalEarnings': 0, 'completedTrips': 0, 'trips': []};
    } catch (_) {
      return {'totalEarnings': 0, 'completedTrips': 0, 'trips': []};
    }
  }

  // Logout
  static Future<void> logout() async {
    _cachedToken = null;
    currentDriver = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_sessionKey);
  }
}
