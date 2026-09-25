import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'config/api_config.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'services/alert_manager.dart';
import 'services/api_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Set status bar theme
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ),
  );

  // Initialize Core Services
  await ApiConfig.init();
  await ApiService.init();
  await AlertManager().init();

  final bool isAuth = await ApiService.checkAuth();

  runApp(RudrakshaDriverApp(isAuth: isAuth));
}

class RudrakshaDriverApp extends StatelessWidget {
  final bool isAuth;
  const RudrakshaDriverApp({super.key, required this.isAuth});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Rudraksha Driver',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF090D16),
        primaryColor: const Color(0xFF22C55E),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF22C55E),
          secondary: Color(0xFFF97316),
          surface: Color(0xFF0F172A),
        ),
        textTheme: GoogleFonts.outfitTextTheme(ThemeData.dark().textTheme),
      ),
      home: isAuth ? const HomeScreen() : const LoginScreen(),
    );
  }
}
