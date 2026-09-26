import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';
import '../config/api_config.dart';

class UpdateInfo {
  final bool hasUpdate;
  final String version;
  final int versionCode;
  final String apkUrl;
  final String releaseNotes;
  final bool forceUpdate;
  final String fileSize;

  UpdateInfo({
    required this.hasUpdate,
    required this.version,
    required this.versionCode,
    required this.apkUrl,
    required this.releaseNotes,
    required this.forceUpdate,
    required this.fileSize,
  });
}

class UpdateService {
  // Current App Version Constants
  static const String currentVersion = '1.2.1';
  static const int currentVersionCode = 3;

  /// Check server for latest app version
  static Future<UpdateInfo?> checkForUpdate() async {
    try {
      final url = Uri.parse('${ApiConfig.currentBaseUrl}/app-version');
      final res = await http.get(url).timeout(const Duration(seconds: 6));

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final serverVersionCode = (data['versionCode'] is num)
            ? (data['versionCode'] as num).toInt()
            : 2;
        final serverVersion = data['version'] ?? '1.2.0';
        final apkUrl = data['apkUrl'] ??
            'https://github.com/rudrakshamovers1460-rgb/Rudraksha_packers_movers/releases/latest/download/RudrakshaDriver.apk';
        final releaseNotes = data['releaseNotes'] ?? 'Naye features aur improvements.';
        final forceUpdate = data['forceUpdate'] == true;
        final fileSize = data['fileSizeMB'] ?? '52.5 MB';

        final bool hasNewUpdate = serverVersionCode > currentVersionCode;

        return UpdateInfo(
          hasUpdate: hasNewUpdate,
          version: serverVersion,
          versionCode: serverVersionCode,
          apkUrl: apkUrl,
          releaseNotes: releaseNotes,
          forceUpdate: forceUpdate,
          fileSize: fileSize,
        );
      }
    } catch (e) {
      debugPrint('[UpdateService] Check update error: $e');
    }
    return null;
  }

  /// Automatically prompt user if an update is found
  static Future<void> checkAndPromptUpdate(BuildContext context,
      {bool showNoUpdateToast = false}) async {
    final info = await checkForUpdate();
    if (!context.mounted) return;

    if (info != null && info.hasUpdate) {
      showUpdateDialog(context, info);
    } else if (showNoUpdateToast) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('✓ Aapka app pehle se hi latest version (v1.2.0) par hai!'),
          backgroundColor: Color(0xFF22C55E),
        ),
      );
    }
  }

  /// Show the 1-Click Update Dialog
  static void showUpdateDialog(BuildContext context, UpdateInfo info) {
    showDialog(
      context: context,
      barrierDismissible: !info.forceUpdate,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF0F172A),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(22),
          side: const BorderSide(color: Color(0xFF22C55E), width: 1.5),
        ),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFF22C55E).withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.system_update_rounded,
                  color: Color(0xFF22C55E), size: 24),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Naya Update Available!',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.bold),
                  ),
                  Text(
                    'Version v${info.version} • ${info.fileSize}',
                    style: const TextStyle(
                        color: Color(0xFFF97316),
                        fontSize: 12,
                        fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Naye Features & Improvements:',
              style: TextStyle(
                  color: Colors.white70,
                  fontSize: 12,
                  fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                info.releaseNotes,
                style: const TextStyle(color: Colors.white70, fontSize: 12, height: 1.4),
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'Aapka koi bhi data ya login session delete nahi hoga. Direct update ho jayega.',
              style: TextStyle(color: Colors.white54, fontSize: 11),
            ),
          ],
        ),
        actions: [
          if (!info.forceUpdate)
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Baad Me', style: TextStyle(color: Colors.white54)),
            ),
          ElevatedButton.icon(
            onPressed: () async {
              Navigator.pop(ctx);
              final url = Uri.parse(info.apkUrl);
              try {
                if (await canLaunchUrl(url)) {
                  await launchUrl(url, mode: LaunchMode.externalApplication);
                } else {
                  await launchUrl(url);
                }
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(
                          '📲 Download shuru ho gaya hai! Notification bar par tap karke "Update" karein.'),
                      backgroundColor: Color(0xFF22C55E),
                      duration: Duration(seconds: 5),
                    ),
                  );
                }
              } catch (e) {
                debugPrint('Launch update error: $e');
              }
            },
            icon: const Icon(Icons.download_rounded, color: Colors.black, size: 18),
            label: const Text('Update Now (1-Click)',
                style: TextStyle(
                    color: Colors.black, fontWeight: FontWeight.bold)),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF22C55E),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ],
      ),
    );
  }
}
