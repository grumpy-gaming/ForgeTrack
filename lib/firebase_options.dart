// lib/firebase_options.dart
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    return android; // We default to Android for your emulator
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyAjg6n2KYy0_TtKoZZJ4k8n4RzAvdYlyrs',
    appId: '1:696986958204:android:d545b68b97d45d1d458cf9',
    messagingSenderId: '696986958204',
    projectId: 'forgetrack-7b8a5',
    storageBucket: 'forgetrack-7b8a5.firebasestorage.app',
  );
}