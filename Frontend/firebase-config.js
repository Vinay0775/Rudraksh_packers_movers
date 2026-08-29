/**
 * Firebase Configuration for Rudraksha Packers & Movers
 * Provides 10,000 Free Phone SMS OTPs per month via Google Firebase Authentication.
 */

window.firebaseConfig = {
  apiKey: "AIzaSyBCuOjfISeJgGymzDD6DYip69BXQK1CFNk",
  authDomain: "rudraksha-packers.firebaseapp.com",
  projectId: "rudraksha-packers",
  storageBucket: "rudraksha-packers.firebasestorage.app",
  messagingSenderId: "705723836607",
  appId: "1:705723836607:web:acdc45c6b45d6ced293e0a",
  measurementId: "G-RLKVCX9Z1C"
};

// Auto-check if Firebase is configured
window.isFirebaseConfigured = function() {
  return window.firebaseConfig && 
         window.firebaseConfig.apiKey && 
         window.firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY" &&
         window.firebaseConfig.projectId === "rudraksha-packers";
};
