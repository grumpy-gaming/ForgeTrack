import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:uuid/uuid.dart';
import 'firebase_options.dart'; 

// --- DATA MODEL ---

class LabSystem {
  final String id;
  final String name;        // Device Name
  final String processor;
  final String ram;         // Installed RAM
  final String os;          // Operating System/Version
  final String status;
  final String role;        // Role/Purpose
  final String ipv4;
  final String ipv6;
  final String macAddress;
  final List<Map<String, dynamic>> customProperties;

  LabSystem({
    required this.id,
    required this.name,
    this.processor = '',
    this.ram = '',
    this.os = '',
    this.status = 'Active',
    this.role = 'Unassigned',
    this.ipv4 = '',
    this.ipv6 = '',
    this.macAddress = '',
    this.customProperties = const [],
  });

  factory LabSystem.fromFirestore(DocumentSnapshot doc) {
    Map data = doc.data() as Map<String, dynamic>;

    // Robust helper to handle legacy data types (e.g., if OS was stored as a List previously)
    String ensureString(dynamic value, {String fallback = ''}) {
      if (value == null) return fallback;
      if (value is List) return value.join(', ');
      return value.toString();
    }

    return LabSystem(
      id: doc.id,
      name: ensureString(data['name'], fallback: 'New Device'),
      processor: ensureString(data['processor']),
      ram: ensureString(data['ram']),
      os: ensureString(data['os']),
      status: ensureString(data['status'], fallback: 'Active'),
      role: ensureString(data['role'], fallback: 'Unassigned'),
      ipv4: ensureString(data['ipv4']),
      ipv6: ensureString(data['ipv6']),
      macAddress: ensureString(data['macAddress']),
      customProperties: List<Map<String, dynamic>>.from(data['customProperties'] ?? []),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'processor': processor,
      'ram': ram,
      'os': os,
      'status': status,
      'role': role,
      'ipv4': ipv4,
      'ipv6': ipv6,
      'macAddress': macAddress,
      'customProperties': customProperties,
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }
}

// --- INITIALIZATION ---

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  bool firebaseReady = false;
  String initError = "";

  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    firebaseReady = true;
  } catch (e) {
    initError = e.toString();
    debugPrint("Firebase Init Error: $e");
  }

  runApp(ForgeTrackApp(isConfigured: firebaseReady, errorMsg: initError));
}

class ForgeTrackApp extends StatelessWidget {
  final bool isConfigured;
  final String errorMsg;
  const ForgeTrackApp({super.key, required this.isConfigured, this.errorMsg = ""});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ForgeTrack',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.blueAccent,
          brightness: Brightness.dark,
          surface: const Color(0xFF1E293B),
        ),
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        cardTheme: CardThemeData( 
          color: const Color(0xFF1E293B),
          elevation: 4,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFF0F172A),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.blueAccent, width: 2)),
          labelStyle: const TextStyle(color: Colors.blueAccent, fontSize: 13),
        ),
      ),
      home: isConfigured 
          ? const AuthWrapper() 
          : SetupErrorScreen(error: errorMsg),
    );
  }
}

// --- ERROR SCREEN ---

class SetupErrorScreen extends StatelessWidget {
  final String error;
  const SetupErrorScreen({super.key, required this.error});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: ListView(
            shrinkWrap: true,
            children: [
              const Icon(Icons.error_outline, size: 80, color: Colors.redAccent),
              const SizedBox(height: 24),
              const Center(child: Text("Firebase Connection Error", style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold))),
              const SizedBox(height: 24),
              const Text("Technical Details:", style: TextStyle(color: Colors.grey, fontSize: 12)),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: Colors.black26, borderRadius: BorderRadius.circular(8)),
                child: Text(error, style: const TextStyle(fontFamily: 'monospace', fontSize: 10, color: Colors.redAccent)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// --- AUTH WRAPPER ---

class AuthWrapper extends StatelessWidget {
  const AuthWrapper({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        return snapshot.hasData ? const DashboardScreen() : const LoginScreen();
      },
    );
  }
}

// --- LOGIN SCREEN ---

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _isShaError = false;

  Future<void> _signInWithGoogle() async {
    try {
      final GoogleSignIn googleSignIn = GoogleSignIn();
      final GoogleSignInAccount? googleUser = await googleSignIn.signIn();
      
      if (googleUser == null) return;

      final GoogleSignInAuthentication googleAuth = await googleUser.authentication;
      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );
      
      await FirebaseAuth.instance.signInWithCredential(credential);
      
    } catch (e) {
      if (!mounted) return;
      String message = e.toString();
      if (message.contains("10")) setState(() => _isShaError = true);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Login Error: $message')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.build_circle, size: 80, color: Colors.blueAccent),
              const SizedBox(height: 20),
              const Text("FORGETRACK", style: TextStyle(fontSize: 32, fontWeight: FontWeight.w900, letterSpacing: 2)),
              const Text("HomeLab Inventory Tracker", style: TextStyle(color: Colors.grey)),
              const SizedBox(height: 60),
              if (_isShaError) _buildShaFixCard(),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white, 
                  foregroundColor: Colors.black, 
                  minimumSize: const Size(double.infinity, 54), 
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))
                ),
                onPressed: _signInWithGoogle,
                icon: const Icon(Icons.login),
                label: const Text("Continue with Google", style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildShaFixCard() {
    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.redAccent.withValues(alpha: 0.1), border: Border.all(color: Colors.redAccent.withValues(alpha: 0.5)), borderRadius: BorderRadius.circular(12)),
      child: const Text("SHA-1 fingerprint missing. Run './gradlew signingReport' and add SHA1 to Firebase Console.", style: TextStyle(fontSize: 12, color: Colors.redAccent)),
    );
  }
}

// --- DASHBOARD SCREEN ---

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final user = FirebaseAuth.instance.currentUser!;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Inventory", style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        actions: [IconButton(onPressed: () => FirebaseAuth.instance.signOut(), icon: const Icon(Icons.logout))],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addNewSystem,
        label: const Text("New System"),
        icon: const Icon(Icons.add),
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance.collection('artifacts').doc('forgetrack-v2').collection('users').doc(user.uid).collection('systems').snapshots(),
        builder: (context, snapshot) {
          if (snapshot.hasError) return Center(child: Text("Error: ${snapshot.error}"));
          if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
          
          final systems = snapshot.data!.docs.map((doc) => LabSystem.fromFirestore(doc)).toList();

          if (systems.isEmpty) {
             return Center(child: Text("No systems found. Tap '+' to add one.", style: const TextStyle(color: Colors.grey)));
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: systems.length,
            itemBuilder: (context, index) => _buildSystemCard(systems[index]),
          );
        },
      ),
    );
  }

  Widget _buildSystemCard(LabSystem system) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        contentPadding: const EdgeInsets.all(16),
        title: Text(system.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text("${system.role} • ${system.ram}", style: const TextStyle(color: Colors.blueAccent, fontSize: 13)),
            Text("IP: ${system.ipv4.isEmpty ? 'N/A' : system.ipv4}", style: const TextStyle(fontSize: 12, fontFamily: 'monospace', color: Colors.grey)),
          ],
        ),
        trailing: Text(system.status, style: TextStyle(color: _getStatusColor(system.status), fontWeight: FontWeight.bold)),
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (context) => SystemDetailEditor(system: system))),
      ),
    );
  }

  Color _getStatusColor(String status) {
    if (status == 'Maintenance') return Colors.orange;
    if (status == 'Decommissioned') return Colors.red;
    return Colors.green;
  }

  void _addNewSystem() async {
    final id = const Uuid().v4();
    final newSystem = LabSystem(id: id, name: "New Device");
    
    await FirebaseFirestore.instance.collection('artifacts').doc('forgetrack-v2').collection('users').doc(user.uid).collection('systems').doc(id).set(newSystem.toMap());
    
    if (mounted) {
      Navigator.push(context, MaterialPageRoute(builder: (context) => SystemDetailEditor(system: newSystem)));
    }
  }
}

// --- SYSTEM DETAIL EDITOR SCREEN ---

class SystemDetailEditor extends StatefulWidget {
  final LabSystem system;
  const SystemDetailEditor({super.key, required this.system});

  @override
  State<SystemDetailEditor> createState() => _SystemDetailEditorState();
}

class _SystemDetailEditorState extends State<SystemDetailEditor> {
  late TextEditingController _nameController;
  late TextEditingController _processorController;
  late TextEditingController _ramController;
  late TextEditingController _osController;
  late TextEditingController _roleController;
  late TextEditingController _ipv4Controller;
  late TextEditingController _ipv6Controller;
  late TextEditingController _macController;
  late TextEditingController _parserController;
  
  late List<Map<String, dynamic>> _customProps;
  String _status = 'Active';

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.system.name);
    _processorController = TextEditingController(text: widget.system.processor);
    _ramController = TextEditingController(text: widget.system.ram);
    _osController = TextEditingController(text: widget.system.os);
    _roleController = TextEditingController(text: widget.system.role);
    _ipv4Controller = TextEditingController(text: widget.system.ipv4);
    _ipv6Controller = TextEditingController(text: widget.system.ipv6);
    _macController = TextEditingController(text: widget.system.macAddress);
    _parserController = TextEditingController();
    _status = widget.system.status;
    _customProps = List.from(widget.system.customProperties);
  }

  void _save() async {
    final user = FirebaseAuth.instance.currentUser!;
    final updatedSystem = LabSystem(
      id: widget.system.id,
      name: _nameController.text,
      processor: _processorController.text,
      ram: _ramController.text,
      os: _osController.text,
      status: _status,
      role: _roleController.text,
      ipv4: _ipv4Controller.text,
      ipv6: _ipv6Controller.text,
      macAddress: _macController.text,
      customProperties: _customProps,
    );

    await FirebaseFirestore.instance.collection('artifacts').doc('forgetrack-v2').collection('users').doc(user.uid).collection('systems').doc(widget.system.id).set(updatedSystem.toMap(), SetOptions(merge: true));
    if (mounted) Navigator.pop(context);
  }

  void _delete() async {
      final confirm = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text("Delete System?"),
          content: const Text("This will permanently remove this device from your inventory."),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text("Cancel")),
            TextButton(onPressed: () => Navigator.pop(context, true), child: const Text("Delete", style: TextStyle(color: Colors.redAccent))),
          ],
        ),
      );

      if (confirm == true) {
        final user = FirebaseAuth.instance.currentUser!;
        await FirebaseFirestore.instance.collection('artifacts').doc('forgetrack-v2').collection('users').doc(user.uid).collection('systems').doc(widget.system.id).delete();
        if (mounted) Navigator.pop(context);
      }
  }

  void _parseText() {
    final text = _parserController.text;
    if (text.isEmpty) return;

    // Improved Multi-format Parser Logic
    // Using (?::|\s{2,}) to handle both "Key: Value" and "Key   Value" (Windows About screen format)
    final hostRegex = RegExp(r'(?:Device name|Host Name|Computer Name)(?::|\s{2,})\s*(.*)', caseSensitive: false);
    final cpuRegex = RegExp(r'(?:Processor|CPU|Architecture)(?::|\s{2,})\s*(.*)', caseSensitive: false);
    final ramRegex = RegExp(r'(?:Installed RAM|RAM)(?::|\s{2,})\s*(.*)', caseSensitive: false);
    final osRegex = RegExp(r'(?:Edition|OS Name|System type|OS Version)(?::|\s{2,})\s*(.*)', caseSensitive: false);
    final versionRegex = RegExp(r'(?:Version)(?::|\s{2,})\s*(.*)', caseSensitive: false);
    final ipv4Regex = RegExp(r'(?:IPv4 Address|IP Address|IP)(?::|\s{2,})\s*([0-9.]+)', caseSensitive: false);
    final ipv6Regex = RegExp(r'(?:IPv6 Address)(?::|\s{2,})\s*([a-fA-F0-9:]+)', caseSensitive: false);
    final macRegex = RegExp(r'(?:MAC Address|Physical Address|HWaddr)(?::|\s{2,})\s*([0-9A-F:]{17})|([0-9A-F]{2}[:-]){5}([0-9A-F]{2})', caseSensitive: false);

    setState(() {
      final hostMatch = hostRegex.firstMatch(text);
      final cpuMatch = cpuRegex.firstMatch(text);
      final ramMatch = ramRegex.firstMatch(text);
      final osMatch = osRegex.firstMatch(text);
      final verMatch = versionRegex.firstMatch(text);
      final ipv4Match = ipv4Regex.firstMatch(text);
      final ipv6Match = ipv6Regex.firstMatch(text);
      final macMatch = macRegex.firstMatch(text);

      if (hostMatch != null) _nameController.text = hostMatch.group(1)?.trim() ?? _nameController.text;
      if (cpuMatch != null) _processorController.text = cpuMatch.group(1)?.trim() ?? _processorController.text;
      if (ramMatch != null) _ramController.text = ramMatch.group(1)?.trim() ?? _ramController.text;
      
      String fullOs = osMatch?.group(1)?.trim() ?? '';
      if (verMatch != null) fullOs += (fullOs.isEmpty ? "" : " ") + verMatch.group(1)!.trim();
      if (fullOs.isNotEmpty) _osController.text = fullOs;

      if (ipv4Match != null) _ipv4Controller.text = ipv4Match.group(1)?.trim() ?? _ipv4Controller.text;
      if (ipv6Match != null) _ipv6Controller.text = ipv6Match.group(1)?.trim() ?? _ipv6Controller.text;
      if (macMatch != null) _macController.text = macMatch.group(0)?.toUpperCase() ?? _macController.text;
      
      // Secondary fallback for raw addresses without labels
      if (ipv4Match == null) {
          final rawIp = RegExp(r'(\d{1,3}\.){3}\d{1,3}').firstMatch(text);
          if (rawIp != null) _ipv4Controller.text = rawIp.group(0)!;
      }
      if (macMatch == null) {
          final rawMac = RegExp(r'([0-9A-F]{2}[:-]){5}([0-9A-F]{2})', caseSensitive: false).firstMatch(text);
          if (rawMac != null) _macController.text = rawMac.group(0)!.toUpperCase();
      }
    });

    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Information Extracted!")));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("System Details"),
        actions: [
          IconButton(onPressed: _delete, icon: const Icon(Icons.delete_outline, color: Colors.redAccent)),
          IconButton(onPressed: _save, icon: const Icon(Icons.check, color: Colors.greenAccent)),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _buildSectionHeader("CORE IDENTITY"),
          TextField(controller: _nameController, decoration: const InputDecoration(labelText: "Device Name")),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _status, 
            items: ['Active', 'Maintenance', 'Decommissioned'].map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
            onChanged: (val) => setState(() => _status = val!),
            decoration: const InputDecoration(labelText: "Status"),
          ),
          const SizedBox(height: 12),
          TextField(controller: _roleController, decoration: const InputDecoration(labelText: "Role / Purpose")),
          
          const SizedBox(height: 24),
          _buildSectionHeader("HARDWARE & OS"),
          TextField(controller: _processorController, decoration: const InputDecoration(labelText: "Processor")),
          const SizedBox(height: 12),
          TextField(controller: _ramController, decoration: const InputDecoration(labelText: "Installed RAM")),
          const SizedBox(height: 12),
          TextField(controller: _osController, decoration: const InputDecoration(labelText: "Operating System/Version")),
          
          const SizedBox(height: 24),
          _buildSectionHeader("NETWORK CONFIG"),
          TextField(controller: _ipv4Controller, decoration: const InputDecoration(labelText: "IPv4 Address")),
          const SizedBox(height: 12),
          TextField(controller: _ipv6Controller, decoration: const InputDecoration(labelText: "IPv6 Address")),
          const SizedBox(height: 12),
          TextField(controller: _macController, decoration: const InputDecoration(labelText: "MAC Address")),
          
          const SizedBox(height: 24),
          _buildSectionHeader("CUSTOM PROPERTIES"),
          ..._customProps.asMap().entries.map((entry) => Padding(
            padding: const EdgeInsets.only(bottom: 8.0),
            child: Row(
              children: [
                Expanded(child: TextField(
                  decoration: const InputDecoration(hintText: "Key"),
                  onChanged: (v) => _customProps[entry.key]['key'] = v,
                  controller: TextEditingController(text: entry.value['key'] ?? ''),
                )),
                const SizedBox(width: 8),
                Expanded(child: TextField(
                  decoration: const InputDecoration(hintText: "Value"),
                  onChanged: (v) => _customProps[entry.key]['value'] = v,
                  controller: TextEditingController(text: entry.value['value'] ?? ''),
                )),
                IconButton(onPressed: () => setState(() => _customProps.removeAt(entry.key)), icon: const Icon(Icons.remove_circle_outline, color: Colors.red)),
              ],
            ),
          )),
          TextButton.icon(onPressed: () => setState(() => _customProps.add({'key': '', 'value': ''})), icon: const Icon(Icons.add), label: const Text("Add Property")),

          const Divider(height: 60),
          _buildSectionHeader("QUICK AUTO-FILL (BETA)"),
          const Text("Paste Windows 'About' or 'ipconfig' info here.", style: TextStyle(fontSize: 11, color: Colors.grey)),
          const SizedBox(height: 12),
          TextField(
            controller: _parserController,
            maxLines: 4,
            decoration: InputDecoration(
              hintText: "Device name: MY-PC\nProcessor: AMD Ryzen...",
              filled: true,
              fillColor: Colors.black26,
              suffixIcon: IconButton(onPressed: _parseText, icon: const Icon(Icons.auto_fix_high, color: Colors.orangeAccent)),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Text(title, style: const TextStyle(color: Colors.blueAccent, fontWeight: FontWeight.bold, fontSize: 12, letterSpacing: 1.2)),
    );
  }
}